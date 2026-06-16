import { Project, Chapter, APU, HistoryItem } from '../types';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME = 'apu-engine-backup.json';
const LIB_KEY = 'apu_engine_library';
const PROJECT_PREFIX = 'apu_engine_project_';
const HISTORY_KEY = 'apu_history';
const RESOURCES_KEY = 'apu_user_resource_library';
const SYNC_TIMESTAMP_KEY = 'apu_drive_last_sync';

// Configura tu OAuth2 Client ID de Google Cloud Console:
// 1. Ve a console.cloud.google.com → APIs y servicios → Credenciales
// 2. Crea credencial OAuth 2.0 (Aplicacion web)
// 3. Agrega tu dominio en "Origenes de JavaScript autorizados"
// 4. Copia el Client ID aqui o en la variable de entorno VITE_GOOGLE_CLIENT_ID
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

const loadGis = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services'));
    document.head.appendChild(script);
  });

export const initDriveAuth = async (): Promise<void> => {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('VITE_GOOGLE_CLIENT_ID no configurado. Agrega tu OAuth2 Client ID de Google Cloud Console en .env.local');
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
    if (!tokenClient) { reject(new Error('Drive no inicializado')); return; }
    if (isTokenValid()) { resolve(); return; }

    tokenClient.callback = (response: any) => {
      if (response.error) { reject(new Error(response.error_description || response.error)); return; }
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
};

const driveRequest = async (url: string, options: RequestInit = {}): Promise<Response> => {
  if (!isTokenValid()) await requestDriveAccess();
  const response = await fetch(url, {
    ...options,
    headers: { 'Authorization': `Bearer ${accessToken}`, ...options.headers }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Drive API ${response.status}: ${text}`);
  }
  return response;
};

const findBackupFileId = async (): Promise<string | null> => {
  const url = `${DRIVE_API}/files?spaces=appDataFolder&q=name%3D'${FILE_NAME}'&fields=files(id)`;
  const res = await driveRequest(url);
  const data = await res.json();
  return data.files?.[0]?.id || null;
};

export const saveAllToDrive = async (projects: Project[]): Promise<void> => {
  const projectData: DriveBackup['projectData'] = {};
  for (const p of projects) {
    try {
      const raw = localStorage.getItem(`${PROJECT_PREFIX}${p.id}`);
      if (raw) projectData[p.id] = JSON.parse(raw);
    } catch { /* skip corrupted entries */ }
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

  const content = JSON.stringify(backup);
  const metadataPart = new Blob([JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] })], { type: 'application/json' });
  const filePart = new Blob([content], { type: 'application/json' });

  const form = new FormData();
  form.append('metadata', metadataPart);
  form.append('file', filePart);

  const existingId = await findBackupFileId();

  if (existingId) {
    await driveRequest(`${DRIVE_UPLOAD}/files/${existingId}?uploadType=multipart`, {
      method: 'PATCH',
      body: form
    });
  } else {
    await driveRequest(`${DRIVE_UPLOAD}/files?uploadType=multipart`, {
      method: 'POST',
      body: form
    });
  }

  localStorage.setItem(SYNC_TIMESTAMP_KEY, new Date().toISOString());
};

export const loadFromDrive = async (): Promise<DriveBackup | null> => {
  const fileId = await findBackupFileId();
  if (!fileId) return null;

  const res = await driveRequest(`${DRIVE_API}/files/${fileId}?alt=media`);
  const backup: DriveBackup = await res.json();

  // Restore all data to localStorage
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
