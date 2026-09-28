import { Project, Chapter, APU, HistoryItem } from '../types';

/*
 * Contenido y formato del respaldo, común a todos los destinos (carpeta local, Google Drive
 * o archivo descargado). Un mismo archivo sirve para restaurar desde cualquiera de ellos.
 */

const LIB_KEY = 'apu_engine_library';
const PROJECT_PREFIX = 'apu_engine_project_';
const HISTORY_KEY = 'apu_history';
const RESOURCES_KEY = 'apu_user_resource_library';

export interface BackupFile {
  version: string;
  savedAt: string;
  library: Project[];
  projectData: Record<string, { metadata: Project; chapters: Chapter[]; apus: APU[] }>;
  history: HistoryItem[];
  userResources: any[];
}

/** Estado de un respaldo existente en el destino */
export interface RemoteBackupInfo {
  savedAt: string;
  projectCount: number;
}

export type BackupTargetKind = 'folder' | 'drive';

/**
 * Se bloqueó una escritura que podría destruir un respaldo existente:
 * - 'foreign': el respaldo del destino no lo escribió ni restauró este equipo.
 * - 'shrink': la copia local tiene muchos menos proyectos que el respaldo.
 */
export class BackupGuardError extends Error {
  constructor(
    public target: BackupTargetKind,
    public reason: 'foreign' | 'shrink',
    public remote: RemoteBackupInfo,
    public localCount: number
  ) {
    super(reason === 'foreign'
      ? 'El respaldo existente fue guardado desde otro equipo o sesión.'
      : 'La copia local tiene muchos menos proyectos que el respaldo existente.');
    this.name = 'BackupGuardError';
  }
}

/** Datos a respaldar, sin la fecha (sirve para detectar si hubo cambios) */
export const collectBackupData = (projects: Project[]) => {
  const projectData: BackupFile['projectData'] = {};
  for (const p of projects) {
    try {
      const raw = localStorage.getItem(`${PROJECT_PREFIX}${p.id}`);
      if (raw) projectData[p.id] = JSON.parse(raw);
    } catch { /**/ }
  }
  let history: HistoryItem[] = [];
  let userResources: any[] = [];
  try { history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { /**/ }
  try { userResources = JSON.parse(localStorage.getItem(RESOURCES_KEY) || '[]'); } catch { /**/ }
  return { library: projects, projectData, history, userResources };
};

export const buildBackup = (projects: Project[], savedAt = new Date().toISOString()): BackupFile => ({
  version: '2.0',
  savedAt,
  ...collectBackupData(projects)
});

export const isValidBackup = (data: any): data is BackupFile =>
  !!data && typeof data === 'object' && Array.isArray(data.library) &&
  typeof data.projectData === 'object' && data.projectData !== null;

export const backupInfo = (backup: Partial<BackupFile>, fallbackDate = ''): RemoteBackupInfo => ({
  savedAt: backup.savedAt || fallbackDate,
  projectCount: Array.isArray(backup.library) ? backup.library.length : 0
});

/** Escribe el respaldo en el almacenamiento del navegador (la app debe recargar su estado después) */
export const applyBackup = (backup: BackupFile) => {
  try { localStorage.setItem(LIB_KEY, JSON.stringify(backup.library || [])); } catch { /**/ }
  for (const [id, data] of Object.entries(backup.projectData || {})) {
    try { localStorage.setItem(`${PROJECT_PREFIX}${id}`, JSON.stringify(data)); } catch { /**/ }
  }
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(backup.history || [])); } catch { /**/ }
  try { localStorage.setItem(RESOURCES_KEY, JSON.stringify(backup.userResources || [])); } catch { /**/ }
};

/** Protección contra respaldos locales vacíos o truncados */
export const isSuspiciousShrink = (localCount: number, remoteCount: number): boolean =>
  remoteCount > 0 && (localCount === 0 || (remoteCount >= 4 && localCount <= remoteCount / 2));

export const formatBackupStamp = (iso: string) => {
  const d = new Date(iso);
  const date = isNaN(d.getTime()) ? new Date() : d;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

/** Descarga el respaldo completo como archivo .json (formato restaurable) */
export const downloadBackupFile = (projects: Project[]) => {
  const backup = buildBackup(projects);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `apu-hdg-respaldo_${formatBackupStamp(backup.savedAt)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

// ── Destino de respaldo elegido por el usuario ─────────────────────────────────

const TARGET_KEY = 'apu_backup_target';

/** 'folder' carpeta del equipo · 'drive' Google Drive · 'none' sin respaldo automático */
export type BackupTarget = 'folder' | 'drive' | 'none';

export const getBackupTarget = (): BackupTarget | null => {
  try {
    const v = localStorage.getItem(TARGET_KEY);
    return v === 'folder' || v === 'drive' || v === 'none' ? v : null;
  } catch { return null; }
};

export const setBackupTarget = (target: BackupTarget) => {
  try { localStorage.setItem(TARGET_KEY, target); } catch { /**/ }
};
