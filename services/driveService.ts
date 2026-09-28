import { Project } from '../types';
import {
  BackupFile, RemoteBackupInfo, BackupGuardError, buildBackup, collectBackupData, applyBackup,
  backupInfo, isSuspiciousShrink, formatBackupStamp
} from './backupData';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = 'APU Hidrogestion';
const FILE_NAME = 'apu-engine-backup.json';
const SYNC_TIMESTAMP_KEY = 'apu_drive_last_sync';
const FOLDER_ID_CACHE_KEY = 'apu_drive_folder_id';
// Persistencia del token entre recargas de página
const TOKEN_KEY = 'apu_drive_token';
const TOKEN_EXPIRY_KEY = 'apu_drive_token_expiry';
const WANTS_CONNECTED_KEY = 'apu_drive_wants_connected';
// savedAt del respaldo remoto que este equipo escribió o restauró por última vez.
// Si el respaldo en Drive tiene otro savedAt, lo escribió otro equipo (o es un equipo nuevo).
const LAST_KNOWN_REMOTE_KEY = 'apu_drive_last_known_remote';

// Versiones rotativas: copia del respaldo anterior antes de sobrescribirlo
const SNAPSHOT_PREFIX = 'apu-engine-backup_';
const SNAPSHOT_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MAX_SNAPSHOTS = 15;

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

/** La sesión de Drive expiró: requiere un clic del usuario para renovarla (popup de Google). */
export class DriveAuthRequiredError extends Error {
  constructor() {
    super('La sesión de Google Drive expiró. Vuelve a conectar Drive.');
    this.name = 'DriveAuthRequiredError';
  }
}

let tokenClient: any = null;
let accessToken: string | null = null;
let tokenExpiry = 0;
let pendingAuth: { resolve: () => void; reject: (e: Error) => void } | null = null;
// Último contenido subido (sin savedAt), para no reescribir Drive si nada cambió
let lastUploadedPayload: string | null = null;

// Carga el token guardado en localStorage al iniciar
const loadSavedToken = (): void => {
  try {
    const saved = localStorage.getItem(TOKEN_KEY);
    const expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0', 10);
    if (saved && expiry && Date.now() < expiry) {
      accessToken = saved;
      tokenExpiry = expiry;
    }
  } catch { /**/ }
};

// Guarda el token en localStorage para sobrevivir recargas
const persistToken = (token: string, expiresIn: number): void => {
  const expiry = Date.now() + expiresIn * 1000 - 60_000;
  accessToken = token;
  tokenExpiry = expiry;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiry.toString());
    localStorage.setItem(WANTS_CONNECTED_KEY, 'true');
  } catch { /**/ }
};

const clearToken = (): void => {
  accessToken = null;
  tokenExpiry = 0;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem(FOLDER_ID_CACHE_KEY);
  } catch { /**/ }
};

const isTokenValid = () => !!(accessToken && Date.now() < tokenExpiry);

const parseDriveError = async (response: Response): Promise<string> => {
  try {
    const data = await response.json();
    const err = data?.error;
    if (!err) return `Error ${response.status}`;

    if (response.status === 403 && err.errors?.[0]?.reason === 'SERVICE_DISABLED') {
      return 'Google Drive API no está habilitada en tu proyecto de Google Cloud. Ve a: console.cloud.google.com → APIs y servicios → Busca "Google Drive API" → Habilitar. Luego espera 1-2 minutos y reintenta.';
    }
    if (response.status === 403) {
      return 'Permiso denegado. Asegúrate de que el Client ID tenga el scope de Drive habilitado y que el dominio esté autorizado.';
    }
    if (response.status === 401) {
      clearToken();
      return 'Sesión expirada. Intenta conectar de nuevo.';
    }
    if (response.status === 404) {
      // Carpeta o archivo eliminado: invalida la carpeta cacheada para recrearla en el próximo intento
      try { localStorage.removeItem(FOLDER_ID_CACHE_KEY); } catch { /**/ }
    }
    return err.message || `Error ${response.status}`;
  } catch {
    return `Error ${response.status}: ${response.statusText}`;
  }
};

const loadGis = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services. Verifica tu conexión a internet.'));
    document.head.appendChild(script);
  });

const settleAuth = (error?: Error) => {
  const pending = pendingAuth;
  pendingAuth = null;
  if (!pending) return;
  if (error) pending.reject(error); else pending.resolve();
};

export const initDriveAuth = async (): Promise<void> => {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('VITE_GOOGLE_CLIENT_ID no configurado. Agrega tu OAuth2 Client ID en las variables de entorno de Vercel.');
  }
  await loadGis();
  if (tokenClient) return;
  tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: (response: any) => {
      if (response.error) {
        settleAuth(new Error(response.error === 'access_denied'
          ? 'Acceso denegado por el usuario. Debes aceptar los permisos de Drive para usar esta función.'
          : (response.error_description || response.error)));
        return;
      }
      persistToken(response.access_token, response.expires_in);
      settleAuth();
    },
    // Sin esto, un popup bloqueado o cerrado deja la promesa colgada para siempre
    error_callback: (err: any) => {
      settleAuth(new Error(err?.type === 'popup_failed_to_open'
        ? 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes para este sitio y reintenta.'
        : 'Se cerró la ventana de Google antes de completar la conexión.'));
    }
  });
};

/**
 * Solicita un token a Google. Abre un popup, por lo que SOLO debe llamarse
 * desde una acción directa del usuario (clic); desde un temporizador el navegador lo bloquea.
 */
export const requestDriveAccess = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (!tokenClient) { reject(new Error('Drive no inicializado. Llama a initDriveAuth primero.')); return; }
    if (isTokenValid()) { resolve(); return; }
    settleAuth(new Error('Solicitud de acceso reemplazada por una nueva.'));
    pendingAuth = { resolve, reject };
    tokenClient.requestAccessToken({ prompt: '' });
  });

/**
 * Al cargar la página: recupera el token guardado si sigue vigente.
 * No intenta renovar un token vencido, porque eso abre un popup que el navegador bloquea
 * sin un clic del usuario. 'expired' indica que el usuario tenía Drive conectado y debe reconectar.
 */
export const autoReconnectDrive = async (): Promise<'connected' | 'expired' | 'off'> => {
  if (!GOOGLE_CLIENT_ID) return 'off';
  let wantsConnected = false;
  try { wantsConnected = localStorage.getItem(WANTS_CONNECTED_KEY) === 'true'; } catch { /**/ }
  if (!wantsConnected) return 'off';

  loadSavedToken();
  return isTokenValid() ? 'connected' : 'expired';
};

export const isDriveConnected = () => isTokenValid();

export const disconnectDrive = () => {
  if (accessToken) {
    (window as any).google?.accounts?.oauth2?.revoke?.(accessToken);
  }
  clearToken();
  lastUploadedPayload = null;
  try { localStorage.removeItem(WANTS_CONNECTED_KEY); } catch { /**/ }
};

const driveRequest = async (url: string, options: RequestInit = {}): Promise<Response> => {
  if (!isTokenValid()) throw new DriveAuthRequiredError();
  const response = await fetch(url, {
    ...options,
    headers: { 'Authorization': `Bearer ${accessToken}`, ...options.headers }
  });
  if (!response.ok) {
    const msg = await parseDriveError(response.clone());
    if (response.status === 401) throw new DriveAuthRequiredError();
    throw new Error(msg);
  }
  return response;
};

const getOrCreateFolder = async (): Promise<string> => {
  const cached = localStorage.getItem(FOLDER_ID_CACHE_KEY);
  if (cached) return cached;

  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const res = await driveRequest(`${DRIVE_API}/files?q=${q}&fields=files(id,name)&spaces=drive`);
  const data = await res.json();

  if (data.files?.length > 0) {
    const id = data.files[0].id;
    localStorage.setItem(FOLDER_ID_CACHE_KEY, id);
    return id;
  }

  const createRes = await driveRequest(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
  });
  const folder = await createRes.json();
  localStorage.setItem(FOLDER_ID_CACHE_KEY, folder.id);
  return folder.id;
};

interface BackupFileMeta {
  id: string;
  info: RemoteBackupInfo;
}

const findBackupFile = async (folderId: string): Promise<BackupFileMeta | null> => {
  const q = encodeURIComponent(`name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`);
  const res = await driveRequest(`${DRIVE_API}/files?q=${q}&fields=files(id,modifiedTime,appProperties)&spaces=drive`);
  const data = await res.json();
  const file = data.files?.[0];
  if (!file) return null;

  const props = file.appProperties || {};
  if (props.savedAt) {
    return { id: file.id, info: { savedAt: props.savedAt, projectCount: Number(props.projectCount) || 0 } };
  }
  // Respaldo antiguo sin appProperties: se lee el contenido para conocer fecha y n° de proyectos
  const contentRes = await driveRequest(`${DRIVE_API}/files/${file.id}?alt=media`);
  const backup: Partial<BackupFile> = await contentRes.json().catch(() => ({}));
  return { id: file.id, info: backupInfo(backup, file.modifiedTime || '') };
};

const getLastKnownRemote = (): string | null => {
  try { return localStorage.getItem(LAST_KNOWN_REMOTE_KEY); } catch { return null; }
};

const setLastKnownRemote = (savedAt: string) => {
  try { localStorage.setItem(LAST_KNOWN_REMOTE_KEY, savedAt); } catch { /**/ }
};

/** true si el respaldo remoto lo escribió o restauró este mismo equipo */
const isRemoteKnown = (remote: RemoteBackupInfo): boolean => {
  const known = getLastKnownRemote();
  if (known) return known === remote.savedAt;
  // Migración desde versiones sin LAST_KNOWN_REMOTE_KEY: se acepta si este equipo ya había
  // sincronizado y el respaldo remoto no es posterior a esa sincronización.
  const lastSync = getLastSyncTime();
  if (!lastSync || !remote.savedAt) return false;
  return new Date(remote.savedAt).getTime() <= new Date(lastSync).getTime();
};

/**
 * Revisa el respaldo en Drive sin modificarlo. Devuelve null si no existe
 * y `foreign: true` si no proviene de este equipo (p.ej. equipo nuevo o navegador limpio).
 */
export const inspectDriveBackup = async (): Promise<(RemoteBackupInfo & { foreign: boolean }) | null> => {
  const folderId = await getOrCreateFolder();
  const existing = await findBackupFile(folderId);
  if (!existing) return null;
  return { ...existing.info, foreign: !isRemoteKnown(existing.info) };
};

/**
 * Copia el respaldo actual como versión con fecha antes de sobrescribirlo y conserva las
 * últimas MAX_SNAPSHOTS. Se copia como máximo cada SNAPSHOT_INTERVAL_MS, o siempre si `force`.
 */
const snapshotBeforeOverwrite = async (folderId: string, existing: BackupFileMeta, force: boolean) => {
  const q = encodeURIComponent(`name contains '${SNAPSHOT_PREFIX}' and '${folderId}' in parents and trashed=false`);
  const res = await driveRequest(`${DRIVE_API}/files?q=${q}&orderBy=${encodeURIComponent('createdTime desc')}&pageSize=100&fields=files(id,name,createdTime)&spaces=drive`);
  const snapshots: { id: string; name: string; createdTime: string }[] = ((await res.json()).files || [])
    .filter((f: { name?: string }) => f.name?.startsWith(SNAPSHOT_PREFIX));

  const latest = snapshots[0] ? new Date(snapshots[0].createdTime).getTime() : 0;
  let current = snapshots;
  if (force || Date.now() - latest >= SNAPSHOT_INTERVAL_MS) {
    const copyRes = await driveRequest(`${DRIVE_API}/files/${existing.id}/copy?fields=id,name,createdTime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${SNAPSHOT_PREFIX}${formatBackupStamp(existing.info.savedAt)}.json`,
        parents: [folderId],
        appProperties: { savedAt: existing.info.savedAt, projectCount: String(existing.info.projectCount) }
      })
    });
    current = [await copyRes.json(), ...snapshots];
  }

  for (const old of current.slice(MAX_SNAPSHOTS)) {
    try { await driveRequest(`${DRIVE_API}/files/${old.id}`, { method: 'DELETE' }); } catch { /* se reintenta en el próximo guardado */ }
  }
};

const buildMultipart = (metadata: object, content: string) => {
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'application/json' }));
  return form;
};

/**
 * Sube el respaldo completo a Drive.
 * Sin `force`, lanza BackupGuardError si el respaldo remoto no proviene de este equipo
 * o si la copia local es sospechosamente menor. Con `force` (tras confirmación del usuario)
 * sobrescribe, guardando antes una versión con fecha del respaldo anterior.
 * Devuelve false si no había cambios que subir.
 */
export const saveAllToDrive = async (projects: Project[], opts: { force?: boolean } = {}): Promise<boolean> => {
  const force = !!opts.force;
  const payload = JSON.stringify(collectBackupData(projects));
  if (!force && payload === lastUploadedPayload) return false;

  const folderId = await getOrCreateFolder();
  const existing = await findBackupFile(folderId);

  if (existing && !force) {
    if (!isRemoteKnown(existing.info)) throw new BackupGuardError('drive', 'foreign', existing.info, projects.length);
    if (isSuspiciousShrink(projects.length, existing.info.projectCount)) {
      throw new BackupGuardError('drive', 'shrink', existing.info, projects.length);
    }
  }

  const savedAt = new Date().toISOString();
  const backup = buildBackup(projects, savedAt);
  const content = JSON.stringify(backup, null, 2);
  const appProperties = { savedAt, projectCount: String(projects.length) };

  if (existing) {
    await snapshotBeforeOverwrite(folderId, existing, force);
    await driveRequest(`${DRIVE_UPLOAD}/files/${existing.id}?uploadType=multipart`, {
      method: 'PATCH',
      body: buildMultipart({ appProperties }, content)
    });
  } else {
    await driveRequest(`${DRIVE_UPLOAD}/files?uploadType=multipart`, {
      method: 'POST',
      body: buildMultipart({ name: FILE_NAME, parents: [folderId], appProperties }, content)
    });
  }

  lastUploadedPayload = payload;
  setLastKnownRemote(savedAt);
  localStorage.setItem(SYNC_TIMESTAMP_KEY, savedAt);
  return true;
};

export const loadFromDrive = async (): Promise<BackupFile | null> => {
  const folderId = await getOrCreateFolder();
  const file = await findBackupFile(folderId);
  if (!file) return null;

  const res = await driveRequest(`${DRIVE_API}/files/${file.id}?alt=media`);
  const backup: BackupFile = await res.json();

  applyBackup(backup);

  // A partir de aquí este equipo queda sincronizado con ese respaldo
  setLastKnownRemote(file.info.savedAt);
  lastUploadedPayload = null;
  localStorage.setItem(SYNC_TIMESTAMP_KEY, new Date().toISOString());

  return backup;
};

export const getLastSyncTime = (): string | null => {
  try { return localStorage.getItem(SYNC_TIMESTAMP_KEY); } catch { return null; }
};
