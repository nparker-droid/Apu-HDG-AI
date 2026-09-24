import { useState, useCallback, useEffect } from 'react';
import { Project, Chapter, APU, HistoryItem, ProjectSheet } from '../types';
import { normalizeApu } from '../lib/apuCalculations';

const LIB_KEY = 'apu_engine_library';
const PROJECT_PREFIX = 'apu_engine_project_';

const safeGetItem = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export const STORAGE_ERROR_EVENT = 'apu-storage-error';
export const STORAGE_QUOTA_BYTES = 5 * 1024 * 1024; // límite típico de localStorage por origen

const safeSetItem = (key: string, value: unknown): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('[APU Store] localStorage lleno o no disponible:', e);
    window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: { key } }));
    return false;
  }
};

/** Bytes aproximados usados por la app en localStorage (UTF-16 → 2 bytes/char). */
export const getStorageUsage = (): number => {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      total += (k.length + (localStorage.getItem(k) || '').length) * 2;
    }
  } catch { /**/ }
  return total;
};

export const useAppStore = () => {
  const [projects, setProjects] = useState<Project[]>(() => safeGetItem<Project[]>(LIB_KEY, []));
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [apus, setApus] = useState<APU[]>([]);
  const [sheet, setSheet] = useState<ProjectSheet>({ cells: {} });
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(() => safeGetItem<HistoryItem[]>('apu_history', []));

  useEffect(() => { safeSetItem(LIB_KEY, projects); }, [projects]);
  useEffect(() => { safeSetItem('apu_history', history); }, [history]);

  // Persistencia inmediata del proyecto activo en cada cambio de estado
  useEffect(() => {
    if (!activeProjectId) return;
    const activeProjectMeta = projects.find(p => p.id === activeProjectId);
    if (!activeProjectMeta) return;
    safeSetItem(`${PROJECT_PREFIX}${activeProjectId}`, { chapters, apus, sheet, metadata: activeProjectMeta });
  }, [chapters, apus, sheet, activeProjectId, projects]);

  // Detección de cambios en otra pestaña: recarga el proyecto activo si fue modificado
  useEffect(() => {
    const onStorageChange = (e: StorageEvent) => {
      if (!activeProjectId) return;
      if (e.key === `${PROJECT_PREFIX}${activeProjectId}` && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setChapters(parsed.chapters || []);
          setApus(parsed.apus || []);
          setSheet(parsed.sheet || { cells: {} });
        } catch { /* ignore corrupted data from other tab */ }
      }
      if (e.key === LIB_KEY && e.newValue) {
        try { setProjects(JSON.parse(e.newValue)); } catch { /**/ }
      }
    };
    window.addEventListener('storage', onStorageChange);
    return () => window.removeEventListener('storage', onStorageChange);
  }, [activeProjectId]);

  const loadProject = useCallback((id: string) => {
    const data = safeGetItem<{ chapters?: Chapter[]; apus?: APU[]; metadata?: Project; sheet?: ProjectSheet } | null>(
      `${PROJECT_PREFIX}${id}`, null
    );
    if (data) {
      const meta = data.metadata || safeGetItem<Project[]>(LIB_KEY, []).find(p => p.id === id) || null;
      setChapters(data.chapters || []);
      setApus((data.apus || []).map(a => normalizeApu(a, meta)));
      setSheet(data.sheet || { cells: {} });
      setLastSaved(data.metadata?.updatedAt || Date.now());
    } else {
      setChapters([]);
      setApus([]);
      setSheet({ cells: {} });
      setLastSaved(null);
    }
    setActiveProjectId(id);
  }, []);

  const saveActiveProject = useCallback(() => {
    if (!activeProjectId) return null;
    const timestamp = Date.now();
    const meta = projects.find(p => p.id === activeProjectId);
    const ok = meta ? safeSetItem(`${PROJECT_PREFIX}${activeProjectId}`, { chapters, apus, sheet, metadata: { ...meta, updatedAt: timestamp } }) : false;
    if (!ok) return null;
    setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, updatedAt: timestamp } : p));
    setLastSaved(timestamp);
    return timestamp;
  }, [activeProjectId, projects, chapters, apus, sheet]);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    try { localStorage.removeItem(`${PROJECT_PREFIX}${id}`); } catch { /**/ }
    if (activeProjectId === id) {
      setActiveProjectId(null);
      setChapters([]);
      setApus([]);
      setSheet({ cells: {} });
    }
  }, [activeProjectId]);

  const duplicateProject = useCallback((id: string) => {
    const sourceProject = projects.find(p => p.id === id);
    if (!sourceProject) return;

    const sourceData = safeGetItem<{ chapters?: Chapter[]; apus?: APU[]; sheet?: ProjectSheet } | null>(
      `${PROJECT_PREFIX}${id}`, null
    );
    if (!sourceData) return;

    const newId = crypto.randomUUID();
    const timestamp = Date.now();

    const newMetadata: Project = { ...sourceProject, id: newId, name: `${sourceProject.name} (Copia)`, createdAt: timestamp, updatedAt: timestamp };

    const chapterIdMap = new Map<string, string>();
    const duplicatedChapters = (sourceData.chapters || []).map((c: Chapter) => {
      const newChapterId = crypto.randomUUID();
      chapterIdMap.set(c.id, newChapterId);
      return { ...c, id: newChapterId, projectId: newId };
    });

    const duplicatedApus = (sourceData.apus || []).map((a: APU) => ({
      ...a,
      id: crypto.randomUUID(),
      projectId: newId,
      chapterId: chapterIdMap.get(a.chapterId) || a.chapterId
    }));

    safeSetItem(`${PROJECT_PREFIX}${newId}`, { ...sourceData, chapters: duplicatedChapters, apus: duplicatedApus, metadata: newMetadata });
    setProjects(prev => [newMetadata, ...prev]);
    return newId;
  }, [projects]);

  const addChapter = useCallback((chapter: Chapter) => {
    setChapters(prev => [...prev, chapter]);
  }, []);

  const moveChapter = useCallback((chapterId: string, direction: 'up' | 'down') => {
    setChapters(prev => {
      const idx = prev.findIndex(c => c.id === chapterId);
      if (idx === -1) return prev;
      const newChapters = [...prev];
      const findNextIdx = () => {
        let current = direction === 'up' ? idx - 1 : idx + 1;
        while (current >= 0 && current < newChapters.length) {
          if (newChapters[current].projectId === prev[idx].projectId) return current;
          current += direction === 'up' ? -1 : 1;
        }
        return -1;
      };
      const targetIdx = findNextIdx();
      if (targetIdx === -1) return prev;
      [newChapters[idx], newChapters[targetIdx]] = [newChapters[targetIdx], newChapters[idx]];
      return newChapters;
    });
  }, []);

  /** Reordena un proyecto en la biblioteca, insertándolo antes de `beforeProjectId` (o al final si es null). */
  const reorderProject = useCallback((projectId: string, beforeProjectId: string | null) => {
    setProjects(prev => {
      const project = prev.find(p => p.id === projectId);
      if (!project || projectId === beforeProjectId) return prev;
      const without = prev.filter(p => p.id !== projectId);
      const insertIdx = beforeProjectId !== null ? without.findIndex(p => p.id === beforeProjectId) : -1;
      const result = [...without];
      result.splice(insertIdx !== -1 ? insertIdx : result.length, 0, project);
      return result;
    });
  }, []);

  /** Reordena un capítulo dentro de su proyecto, insertándolo antes de `beforeChapterId` (o al final si es null). */
  const reorderChapter = useCallback((chapterId: string, beforeChapterId: string | null) => {
    setChapters(prev => {
      const chapter = prev.find(c => c.id === chapterId);
      if (!chapter || chapterId === beforeChapterId) return prev;
      const without = prev.filter(c => c.id !== chapterId);
      if (beforeChapterId !== null) {
        const insertIdx = without.findIndex(c => c.id === beforeChapterId);
        if (insertIdx !== -1) {
          const result = [...without];
          result.splice(insertIdx, 0, chapter);
          return result;
        }
      }
      let insertPos = without.length;
      for (let i = without.length - 1; i >= 0; i--) {
        if (without[i].projectId === chapter.projectId) { insertPos = i + 1; break; }
      }
      const result = [...without];
      result.splice(insertPos, 0, chapter);
      return result;
    });
  }, []);

  const deleteChapter = useCallback((id: string) => {
    setChapters(prev => prev.filter(c => c.id !== id));
    setApus(prev => prev.filter(a => a.chapterId !== id));
  }, []);

  const addApu = useCallback((apu: APU) => {
    setApus(prev => [...prev, { ...apu, createdAt: Date.now() }]);
  }, []);

  const updateApu = useCallback((updatedApu: APU) => {
    setApus(prev => prev.map(a => a.id === updatedApu.id ? { ...updatedApu, updatedAt: Date.now() } : a));
  }, []);

  const deleteApu = useCallback((id: string) => {
    setApus(prev => prev.filter(a => a.id !== id));
  }, []);

  const addHistoryItem = useCallback((item: HistoryItem) => {
    if (!item.description || item.description.trim() === '') return;
    setHistory(prev => {
      // Mantiene el valor más reciente por descripción+categoría (antes quedaba congelado el primero)
      const key = item.description.toLowerCase().trim();
      const idx = prev.findIndex(h => h.category === item.category && h.description.toLowerCase().trim() === key);
      if (idx === 0 && prev[0].unitPrice === item.unitPrice && prev[0].unit === item.unit && prev[0].performance === item.performance) return prev;
      const rest = idx === -1 ? prev : prev.filter((_, i) => i !== idx);
      return [item, ...rest].slice(0, 500);
    });
  }, []);

  const moveApu = useCallback((apuId: string, direction: 'up' | 'down') => {
    setApus(prev => {
      const idx = prev.findIndex(a => a.id === apuId);
      if (idx === -1) return prev;
      const newApus = [...prev];
      const findNextIdx = () => {
        let current = direction === 'up' ? idx - 1 : idx + 1;
        while (current >= 0 && current < newApus.length) {
          if (newApus[current].chapterId === prev[idx].chapterId) return current;
          current += direction === 'up' ? -1 : 1;
        }
        return -1;
      };
      const targetIdx = findNextIdx();
      if (targetIdx === -1) return prev;
      [newApus[idx], newApus[targetIdx]] = [newApus[targetIdx], newApus[idx]];
      return newApus;
    });
  }, []);

  const moveApuToChapter = useCallback((apuId: string, toChapterId: string, beforeApuId: string | null) => {
    setApus(prev => {
      const apu = prev.find(a => a.id === apuId);
      if (!apu || (apu.chapterId === toChapterId && beforeApuId === apuId)) return prev;
      const withoutApu = prev.filter(a => a.id !== apuId);
      const updatedApu = { ...apu, chapterId: toChapterId };
      if (beforeApuId !== null) {
        const insertIdx = withoutApu.findIndex(a => a.id === beforeApuId);
        if (insertIdx !== -1) {
          const result = [...withoutApu];
          result.splice(insertIdx, 0, updatedApu);
          return result;
        }
      }
      let insertPos = withoutApu.length;
      for (let i = withoutApu.length - 1; i >= 0; i--) {
        if (withoutApu[i].chapterId === toChapterId) { insertPos = i + 1; break; }
      }
      const result = [...withoutApu];
      result.splice(insertPos, 0, updatedApu);
      return result;
    });
  }, []);

  // Método para restaurar estado React después de una carga desde Drive
  const reloadFromStorage = useCallback(() => {
    const storedProjects = safeGetItem<Project[]>(LIB_KEY, []);
    setProjects(storedProjects);
    setActiveProjectId(null);
    setChapters([]);
    setApus([]);
    setSheet({ cells: {} });
    setLastSaved(null);
  }, []);

  return {
    sheet, setSheet,
    projects, setProjects, reorderProject,
    chapters, setChapters, addChapter, moveChapter, reorderChapter, deleteChapter,
    apus, setApus, addApu, updateApu, deleteApu, moveApu, moveApuToChapter,
    history, addHistoryItem,
    activeProjectId, setActiveProjectId, loadProject, saveActiveProject,
    deleteProject, duplicateProject, lastSaved,
    reloadFromStorage
  };
};
