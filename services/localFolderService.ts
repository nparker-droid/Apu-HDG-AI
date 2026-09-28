import { Project } from '../types';
import {
  BackupFile, RemoteBackupInfo, BackupGuardError, buildBackup, collectBackupData, applyBackup,
  backupInfo, isValidBackup, isSuspiciousShrink, formatBackupStamp
} from './backupData';

/*
 * Respaldo en una carpeta del equipo elegida por el usuario (File System Access API).
 * Disponible en Chrome y Edge de escritorio. La carpeta puede estar sincronizada con
 * OneDrive, Dropbox o Google Drive para escritorio, lo que da respaldo en la nube sin APIs.
 *
 * Estructura en la carpeta:
 *   apu-hdg-respaldo.json            respaldo vigente
 *   versiones/apu-hdg-respaldo_<fecha>.json   últimas MAX_VERSIONS copias anteriores
 */

const FILE_NAME = 'apu-hdg-respaldo.json';
const VERSIONS_DIR = 'versiones';
const VERSION_PREFIX = 'apu-hdg-respaldo_';
const VERSION_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MAX_VERSIONS = 15;

// savedAt del respaldo que este equipo escribió o restauró por última vez en la carpeta
const LAST_KNOWN_KEY = 'apu_folder_last_known';
const LAST_SYNC_KEY = 'apu_folder_last_sync';

const DB_NAME = 'apu-hdg';
const STORE = 'handles';
const HANDLE_KEY = 'backupFolder';

let lastWrittenPayload: string | null = null;

export const isFolderBackupSupported = (): boolean =>
  typeof window !== 'undefined' && 'showDirectoryPicker' in window;

// ── Persistencia del acceso a la carpeta (IndexedDB) ───────────────────────────

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const idb = async <T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest): Promise<T> => {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = op(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
};

/** Carpeta elegida anteriormente (null si no hay o el navegador no lo permite) */
export const getSavedFolder = async (): Promise<any | null> => {
  if (!isFolderBackupSupported()) return null;
  try { return (await idb<any>('readonly', s => s.get(HANDLE_KEY))) || null; } catch { return null; }
};

export const forgetFolder = async () => {
  try { await idb('readwrite', s => s.delete(HANDLE_KEY)); } catch { /**/ }
};

/** Estado del permiso de escritura: 'granted' listo · 'prompt' requiere un clic · 'denied' */
export const folderPermission = async (handle: any): Promise<'granted' | 'prompt' | 'denied'> => {
  try { return await handle.queryPermission({ mode: 'readwrite' }); } catch { return 'denied'; }
};

/** Pide permiso para una carpeta ya elegida. Requiere una acción directa del usuario (clic). */
export const requestFolderPermission = async (handle: any): Promise<boolean> => {
  try { return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted'; } catch { return false; }
};

/**
 * Abre el selector de carpetas del sistema. Requiere una acción directa del usuario (clic).
 * Devuelve null si el usuario cancela.
 */
export const pickBackupFolder = async (): Promise<any | null> => {
  try {
    const handle = await (window as any).showDirectoryPicker({ id: 'apu-hdg-respaldo', mode: 'readwrite', startIn: 'documents' });
    await idb('readwrite', s => s.put(handle, HANDLE_KEY));
    lastWrittenPayload = null;
    return handle;
  } catch (e: any) {
    if (e?.name === 'AbortError') return null;
    throw new Error(e?.name === 'SecurityError' || e?.name === 'NotAllowedError'
      ? 'El navegador no permitió usar esa carpeta. Elige otra (por ejemplo, una dentro de Documentos).'
      : (e?.message || 'No se pudo abrir el selector de carpetas.'));
  }
};

// ── Lectura y escritura ────────────────────────────────────────────────────────

const readJson = async (dir: any, name: string): Promise<any | null> => {
  try {
    const file = await (await dir.getFileHandle(name)).getFile();
    return JSON.parse(await file.text());
  } catch (e: any) {
    if (e?.name === 'NotFoundError') return null;
    if (e instanceof SyntaxError) throw new Error(`El archivo ${name} de la carpeta de respaldo está dañado.`);
    throw e;
  }
};

const writeText = async (dir: any, name: string, content: string) => {
  const fileHandle = await dir.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
};

const getLastKnown = () => { try { return localStorage.getItem(LAST_KNOWN_KEY); } catch { return null; } };
const setLastKnown = (savedAt: string) => {
  try {
    localStorage.setItem(LAST_KNOWN_KEY, savedAt);
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch { /**/ }
};

export const getLastFolderSync = (): string | null => {
  try { return localStorage.getItem(LAST_SYNC_KEY); } catch { return null; }
};

/** Revisa el respaldo existente en la carpeta. `foreign` si no proviene de este equipo. */
export const inspectFolderBackup = async (dir: any): Promise<(RemoteBackupInfo & { foreign: boolean }) | null> => {
  const existing = await readJson(dir, FILE_NAME);
  if (!existing) return null;
  const info = backupInfo(existing);
  return { ...info, foreign: getLastKnown() !== info.savedAt };
};

/** Guarda una copia con fecha del respaldo anterior y conserva las últimas MAX_VERSIONS */
const saveVersion = async (dir: any, previous: string, previousSavedAt: string, force: boolean) => {
  const versions = await dir.getDirectoryHandle(VERSIONS_DIR, { create: true });
  const names: string[] = [];
  for await (const [name, handle] of versions.entries()) {
    if (handle.kind === 'file' && name.startsWith(VERSION_PREFIX)) names.push(name);
  }
  names.sort().reverse();

  let latest = 0;
  if (names[0]) {
    try { latest = (await (await versions.getFileHandle(names[0])).getFile()).lastModified; } catch { /**/ }
  }
  if (force || Date.now() - latest >= VERSION_INTERVAL_MS) {
    const name = `${VERSION_PREFIX}${formatBackupStamp(previousSavedAt)}.json`;
    await writeText(versions, name, previous);
    if (!names.includes(name)) names.unshift(name);
    names.sort().reverse();
  }
  for (const old of names.slice(MAX_VERSIONS)) {
    try { await versions.removeEntry(old); } catch { /* se reintenta en el próximo guardado */ }
  }
};

/**
 * Guarda el respaldo en la carpeta. Sin `force` lanza BackupGuardError si el respaldo existente
 * no lo escribió este equipo o si la copia local es sospechosamente menor.
 * Devuelve false si no había cambios que guardar.
 */
export const saveToFolder = async (dir: any, projects: Project[], opts: { force?: boolean } = {}): Promise<boolean> => {
  const force = !!opts.force;
  const payload = JSON.stringify(collectBackupData(projects));
  if (!force && payload === lastWrittenPayload) return false;

  const existing = await readJson(dir, FILE_NAME).catch((e: any) => { if (force) return null; throw e; });
  if (existing && !force) {
    const info = backupInfo(existing);
    if (getLastKnown() !== info.savedAt) throw new BackupGuardError('folder', 'foreign', info, projects.length);
    if (isSuspiciousShrink(projects.length, info.projectCount)) throw new BackupGuardError('folder', 'shrink', info, projects.length);
  }

  if (existing) await saveVersion(dir, JSON.stringify(existing, null, 2), backupInfo(existing).savedAt, force);

  const backup = buildBackup(projects);
  await writeText(dir, FILE_NAME, JSON.stringify(backup, null, 2));
  lastWrittenPayload = payload;
  setLastKnown(backup.savedAt);
  return true;
};

/** Restaura el respaldo vigente de la carpeta. Devuelve null si no existe. */
export const loadFromFolder = async (dir: any): Promise<BackupFile | null> => {
  const backup = await readJson(dir, FILE_NAME);
  if (!backup) return null;
  if (!isValidBackup(backup)) throw new Error('El archivo de respaldo de la carpeta no tiene un formato válido.');
  applyBackup(backup);
  setLastKnown(backup.savedAt);
  lastWrittenPayload = null;
  return backup;
};
