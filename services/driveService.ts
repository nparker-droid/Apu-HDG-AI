import { Project, Chapter, APU, HistoryItem } from '../types';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
// drive.file: solo accede a archivos que la app crea — carpeta visible en "Mi unidad"
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = 'APU Hidrogestion';
const FILE_NAME = 'apu-engine-backup.json';
const LIB_KEY = 'apu_engine_library';
const PROJECT_PREFIX = 'apu_engine_project_';
const HISTORY_KEY = 'apu_history';
const RESOURCES_KEY = 'apu_user_resource_library';
const SYNC_TIMESTAMP_KEY = 'apu_drive_last_sync';
const FOLDER_ID_CACHE_KEY = 'apu_drive_folder_id';

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

interface DriveBackup {
  version: string;
  savedAt: string;
  library: Project[];
  projectData: Record<string, { metadata: Project; chapters: Chapter[]; apus: APU[] }>;
  history: HistoryItem[];
  userResources: any[];
}

let tokenClient: any = null;
let accessToken: string | null = null;
let tokenExpiry = 0;

const isTokenValid = () => !!(accessToken && Date.now() < tokenExpiry);

const parseDriveError = async (response: Response): Promise<string> => {
  try {
    const data = await response.json();
    const err = data?.error;
    if (!err) return `Error ${response.status}`;

    // 403 Drive API no habilitada
    if (response.status === 403 && err.errors?.[0]?.reason === 'SERVICE_DISABLED') {
      return 'Google Drive API no está habilitada en tu proyecto de Google Cloud. Ve a: console.cloud.google.com → APIs y servicios → Busca "Google Drive API" → Habilitar. Luego espera 1-2 minutos y reintenta.';
    }

    // 403 acceso denegado genérico
    if (response.status === 403) {
      return 'Permiso denegado. Asegúrate de que el Client ID tenga el scope de Drive habilitado y que el dominio esté autorizado.';
    }

    // 401 token inválido
    if (response.status === 401) {
      accessToken = null;
      tokenExpiry = 0;
      return 'Sesión expirada. Intenta conectar de nuevo.';
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

export const initDriveAuth = async (): Promise<void> => {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('VITE_GOOGLE_CLIENT_ID no configurado. Agrega tu OAuth2 Client ID en las variables de entorno de Vercel.');
  }
  await loadGis();
  tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: () => {}
  });
};

export const requestDriveAccess = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (!tokenClient) { reject(new Error('Drive no inicializado. Llama a initDriveAuth primero.')); return; }
    if (isTokenValid()) { resolve(); return; }

    tokenClient.callback = (response: any) => {
      if (response.error) {
        if (response.error === 'access_denied') {
          reject(new Error('Acceso denegado por el usuario. Debes aceptar los permisos de Drive para usar esta función.'));
        } else {
          reject(new Error(response.error_description || response.error));
        }
        return;
      }
      accessToken = response.access_token;
      tokenExpiry = Date.now() + response.expires_in * 1000 - 60_000;
      resolve();
    };
    tokenClient.requestAccessToken({ prompt: '' });
  });

export const isDriveConnected = () => isTokenValid();

export const disconnectDrive = () => {
  if (accessToken) {
    (window as any).google?.accounts?.oauth2?.revoke?.(accessToken);
  }
  accessToken = null;
  tokenExpiry = 0;
  localStorage.removeItem(FOLDER_ID_CACHE_KEY);
};

const driveRequest = async (url: string, options: RequestInit = {}): Promise<Response> => {
  if (!isTokenValid()) await requestDriveAccess();
  const response = await fetch(url, {
    ...options,
    headers: { 'Authorization': `Bearer ${accessToken}`, ...options.headers }
  });
  if (!response.ok) {
    const msg = await parseDriveError(response.clone());
    throw new Error(msg);
  }
  return response;
};

// Busca o crea la carpeta "APU Hidrogestion" visible en Mi unidad
const getOrCreateFolder = async (): Promise<string> => {
  // Revisar caché local primero
  const cached = localStorage.getItem(FOLDER_ID_CACHE_KEY);
  if (cached) return cached;

  // Buscar carpeta existente
  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const res = await driveRequest(`${DRIVE_API}/files?q=${q}&fields=files(id,name)&spaces=drive`);
  const data = await res.json();

  if (data.files?.length > 0) {
    const id = data.files[0].id;
    localStorage.setItem(FOLDER_ID_CACHE_KEY, id);
    return id;
  }

  // Crear carpeta nueva
  const createRes = await driveRequest(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });
  const folder = await createRes.json();
  localStorage.setItem(FOLDER_ID_CACHE_KEY, folder.id);
  return folder.id;
};

const findBackupFileId = async (folderId: string): Promise<string | null> => {
  const q = encodeURIComponent(`name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`);
  const res = await driveRequest(`${DRIVE_API}/files?q=${q}&fields=files(id)&spaces=drive`);
  const data = await res.json();
  return data.files?.[0]?.id || null;
};

export const saveAllToDrive = async (projects: Project[]): Promise<void> => {
  const projectData: DriveBackup['projectData'] = {};
  for (const p of projects) {
    try {
      const raw = localStorage.getItem(`${PROJECT_PREFIX}${p.id}`);
      if (raw) projectData[p.id] = JSON.parse(raw);
    } catch { /* skip corrupted */ }
  }

  let history: HistoryItem[] = [];
  let userResources: any[] = [];
  try { history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { /**/ }
  try { userResources = JSON.parse(localStorage.getItem(RESOURCES_KEY) || '[]'); } catch { /**/ }

  const backup: DriveBackup = {
    version: '2.0',
    savedAt: new Date().toISOString(),
    library: projects,
    projectData,
    history,
    userResources
  };

  const folderId = await getOrCreateFolder();
  const existingId = await findBackupFileId(folderId);
  const content = JSON.stringify(backup, null, 2);

  if (existingId) {
    // Actualizar archivo existente (solo contenido, sin cambiar carpeta)
    await driveRequest(`${DRIVE_UPLOAD}/files/${existingId}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: content
    });
  } else {
    // Crear archivo nuevo en la carpeta
    const metadataPart = new Blob(
      [JSON.stringify({ name: FILE_NAME, parents: [folderId] })],
      { type: 'application/json' }
    );
    const filePart = new Blob([content], { type: 'application/json' });
    const form = new FormData();
    form.append('metadata', metadataPart);
    form.append('file', filePart);

    await driveRequest(`${DRIVE_UPLOAD}/files?uploadType=multipart`, {
      method: 'POST',
      body: form
    });
  }

  localStorage.setItem(SYNC_TIMESTAMP_KEY, new Date().toISOString());
};

export const loadFromDrive = async (): Promise<DriveBackup | null> => {
  const folderId = await getOrCreateFolder();
  const fileId = await findBackupFileId(folderId);
  if (!fileId) return null;

  const res = await driveRequest(`${DRIVE_API}/files/${fileId}?alt=media`);
  const backup: DriveBackup = await res.json();

  try { localStorage.setItem(LIB_KEY, JSON.stringify(backup.library || [])); } catch { /**/ }
  for (const [id, data] of Object.entries(backup.projectData || {})) {
    try { localStorage.setItem(`${PROJECT_PREFIX}${id}`, JSON.stringify(data)); } catch { /**/ }
  }
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(backup.history || [])); } catch { /**/ }
  try { localStorage.setItem(RESOURCES_KEY, JSON.stringify(backup.userResources || [])); } catch { /**/ }
  localStorage.setItem(SYNC_TIMESTAMP_KEY, new Date().toISOString());

  return backup;
};

export const getLastSyncTime = (): string | null => localStorage.getItem(SYNC_TIMESTAMP_KEY);
