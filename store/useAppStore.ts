import { useState, useCallback, useEffect } from 'react';
import { Project, Chapter, APU, HistoryItem } from '../types';

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

const safeSetItem = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('[APU Store] localStorage lleno o no disponible:', e);
  }
};

export const useAppStore = () => {
  const [projects, setProjects] = useState<Project[]>(() => safeGetItem<Project[]>(LIB_KEY, []));
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [apus, setApus] = useState<APU[]>([]);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(() => safeGetItem<HistoryItem[]>('apu_history', []));

  useEffect(() => { safeSetItem(LIB_KEY, projects); }, [projects]);
  useEffect(() => { safeSetItem('apu_history', history); }, [history]);

  // Persistencia inmediata del proyecto activo en cada cambio de estado
  useEffect(() => {
    if (!activeProjectId) return;
    const activeProjectMeta = projects.find(p => p.id === activeProjectId);
    if (!activeProjectMeta) return;
    safeSetItem(`${PROJECT_PREFIX}${activeProjectId}`, { chapters, apus, metadata: activeProjectMeta });
  }, [chapters, apus, activeProjectId, projects]);

  // Detección de cambios en otra pestaña: recarga el proyecto activo si fue modificado
  useEffect(() => {
    const onStorageChange = (e: StorageEvent) => {
      if (!activeProjectId) return;
      if (e.key === `${PROJECT_PREFIX}${activeProjectId}` && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setChapters(parsed.chapters || []);
          setApus(parsed.apus || []);
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
    const data = safeGetItem<{ chapters?: Chapter[]; apus?: APU[]; metadata?: Project } | null>(
      `${PROJECT_PREFIX}${id}`, null
    );
    if (data) {
      setChapters(data.chapters || []);
      setApus(data.apus || []);
      setLastSaved(data.metadata?.updatedAt || Date.now());
    } else {
      setChapters([]);
      setApus([]);
      setLastSaved(null);
    }
    setActiveProjectId(id);
  }, []);

  const saveActiveProject = useCallback(() => {
    if (!activeProjectId) return null;
    const timestamp = Date.now();
    setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, updatedAt: timestamp } : p));
    setLastSaved(timestamp);
    return timestamp;
  }, [activeProjectId]);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    try { localStorage.removeItem(`${PROJECT_PREFIX}${id}`); } catch { /**/ }
    if (activeProjectId === id) {
      setActiveProjectId(null);
      setChapters([]);
      setApus([]);
    }
  }, [activeProjectId]);

  const duplicateProject = useCallback((id: string) => {
    const sourceProject = projects.find(p => p.id === id);
    if (!sourceProject) return;

    const sourceData = safeGetItem<{ chapters?: Chapter[]; apus?: APU[] } | null>(
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
      const exists = prev.find(h => h.description.toLowerCase() === item.description.toLowerCase());
      if (exists) return prev;
      return [item, ...prev].slice(0, 500);
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
    setLastSaved(null);
  }, []);

  return {
    projects, setProjects,
    chapters, setChapters, addChapter, moveChapter, deleteChapter,
    apus, setApus, addApu, updateApu, deleteApu, moveApu, moveApuToChapter,
    history, addHistoryItem,
    activeProjectId, setActiveProjectId, loadProject, saveActiveProject,
    deleteProject, duplicateProject, lastSaved,
    reloadFromStorage
  };
};
