import { useState, useCallback, useEffect } from 'react';
import { Project, Chapter, APU, HistoryItem, ProjectSheet } from '../types';
import { normalizeApu } from '../lib/apuCalculations';
import { getDescendantChapterIds, getChapterChildren, insertInOrder } from '../lib/chapters';

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
    (sourceData.chapters || []).forEach((c: Chapter) => chapterIdMap.set(c.id, crypto.randomUUID()));
    const apuIdMap = new Map<string, string>();
    (sourceData.apus || []).forEach((a: APU) => apuIdMap.set(a.id, crypto.randomUUID()));
    const duplicatedChapters = (sourceData.chapters || []).map((c: Chapter) => ({
      ...c,
      id: chapterIdMap.get(c.id)!,
      projectId: newId,
      parentChapterId: c.parentChapterId ? (chapterIdMap.get(c.parentChapterId) || c.parentChapterId) : c.parentChapterId,
      ...(c.childOrder ? { childOrder: c.childOrder.map(id => chapterIdMap.get(id) || apuIdMap.get(id) || id) } : {})
    }));

    const duplicatedApus = (sourceData.apus || []).map((a: APU) => ({
      ...a,
      id: apuIdMap.get(a.id)!,
      projectId: newId,
      chapterId: chapterIdMap.get(a.chapterId) || a.chapterId
    }));

    safeSetItem(`${PROJECT_PREFIX}${newId}`, { ...sourceData, chapters: duplicatedChapters, apus: duplicatedApus, metadata: newMetadata });
    setProjects(prev => [newMetadata, ...prev]);
    return newId;
  }, [projects]);

  const addChapter = useCallback((chapter: Chapter) => {
    setChapters(prev => {
      if (chapter.parentChapterId) {
        const parent = prev.find(c => c.id === chapter.parentChapterId);
        if (!parent || parent.parentChapterId) return prev; // el padre debe ser un capítulo raíz (un solo nivel)
        // el subcapítulo nuevo queda al final del capítulo (después de sus partidas actuales), no arriba
        const order = [...getChapterChildren(parent, prev, apus).map(c => c.id), chapter.id];
        return [...prev.map(c => c.id === parent.id ? { ...c, childOrder: order } : c), chapter];
      }
      return [...prev, chapter];
    });
  }, [apus]);

  /** Mueve un hijo (partida propia o subcapítulo) dentro del orden mezclado de un capítulo raíz, antes de `beforeId` o al final. */
  const moveChildInChapter = useCallback((parentId: string, childId: string, beforeId: string | null, apusOverride?: APU[]) => {
    setChapters(prev => {
      const parent = prev.find(c => c.id === parentId);
      if (!parent || parent.parentChapterId || childId === beforeId) return prev;
      const ids = getChapterChildren(parent, prev, apusOverride || apus).map(c => c.id);
      if (!ids.includes(childId)) return prev;
      return prev.map(c => c.id === parentId ? { ...c, childOrder: insertInOrder(ids, childId, beforeId) } : c);
    });
  }, [apus]);

  /** Sube/baja un hijo de un capítulo raíz un lugar dentro del orden mezclado (una partida puede saltar un subcapítulo completo). */
  const stepChildInChapter = useCallback((parentId: string, childId: string, direction: 'up' | 'down') => {
    setChapters(prev => {
      const parent = prev.find(c => c.id === parentId);
      if (!parent) return prev;
      const ids = getChapterChildren(parent, prev, apus).map(c => c.id);
      const idx = ids.indexOf(childId);
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (idx === -1 || target < 0 || target >= ids.length) return prev;
      [ids[idx], ids[target]] = [ids[target], ids[idx]];
      return prev.map(c => c.id === parentId ? { ...c, childOrder: ids } : c);
    });
  }, [apus]);

  const moveChapter = useCallback((chapterId: string, direction: 'up' | 'down') => {
    const sub = chapters.find(c => c.id === chapterId && c.parentChapterId);
    if (sub) { stepChildInChapter(sub.parentChapterId!, chapterId, direction); return; }
    setChapters(prev => {
      const idx = prev.findIndex(c => c.id === chapterId);
      if (idx === -1) return prev;
      const newChapters = [...prev];
      const findNextIdx = () => {
        let current = direction === 'up' ? idx - 1 : idx + 1;
        while (current >= 0 && current < newChapters.length) {
          if (newChapters[current].projectId === prev[idx].projectId &&
              (newChapters[current].parentChapterId ?? null) === (prev[idx].parentChapterId ?? null)) return current;
          current += direction === 'up' ? -1 : 1;
        }
        return -1;
      };
      const targetIdx = findNextIdx();
      if (targetIdx === -1) return prev;
      [newChapters[idx], newChapters[targetIdx]] = [newChapters[targetIdx], newChapters[idx]];
      return newChapters;
    });
  }, [chapters, stepChildInChapter]);

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
    const sub = chapters.find(c => c.id === chapterId && c.parentChapterId);
    if (sub) {
      const target = beforeChapterId !== null ? chapters.find(c => c.id === beforeChapterId) : null;
      if (target && target.parentChapterId !== sub.parentChapterId) return; // no reparenting silencioso por drag-and-drop
      moveChildInChapter(sub.parentChapterId!, chapterId, beforeChapterId);
      return;
    }
    setChapters(prev => {
      const chapter = prev.find(c => c.id === chapterId);
      if (!chapter || chapterId === beforeChapterId) return prev;
      const sameGroup = (c: Chapter) =>
        c.projectId === chapter.projectId && (c.parentChapterId ?? null) === (chapter.parentChapterId ?? null);
      const without = prev.filter(c => c.id !== chapterId);
      if (beforeChapterId !== null) {
        const target = without.find(c => c.id === beforeChapterId);
        if (!target || !sameGroup(target)) return prev; // no reparenting silencioso por drag-and-drop
        const insertIdx = without.findIndex(c => c.id === beforeChapterId);
        const result = [...without];
        result.splice(insertIdx, 0, chapter);
        return result;
      }
      let insertPos = without.length;
      for (let i = without.length - 1; i >= 0; i--) {
        if (sameGroup(without[i])) { insertPos = i + 1; break; }
      }
      const result = [...without];
      result.splice(insertPos, 0, chapter);
      return result;
    });
  }, [chapters, moveChildInChapter]);

  const deleteChapter = useCallback((id: string) => {
    const idsToDelete = new Set(getDescendantChapterIds(chapters, id));
    setChapters(prev => prev.filter(c => !idsToDelete.has(c.id)));
    setApus(prev => prev.filter(a => !idsToDelete.has(a.chapterId)));
  }, [chapters]);

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
    const apu = apus.find(a => a.id === apuId);
    const parent = apu && chapters.find(c => c.id === apu.chapterId && !c.parentChapterId);
    if (parent) { stepChildInChapter(parent.id, apuId, direction); return; }
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
  }, [apus, chapters, stepChildInChapter]);

  /** Mueve una partida a otro capítulo/subcapítulo (o dentro del mismo), antes de `beforeId` o al final. En un capítulo raíz `beforeId` puede ser una partida propia o un subcapítulo. */
  const moveApuToChapter = useCallback((apuId: string, toChapterId: string, beforeId: string | null) => {
    const apu = apus.find(a => a.id === apuId);
    if (!apu || apuId === beforeId) return;
    const withoutApu = apus.filter(a => a.id !== apuId);
    const updatedApu = { ...apu, chapterId: toChapterId };
    const beforeApuIdx = beforeId !== null ? withoutApu.findIndex(a => a.id === beforeId && a.chapterId === toChapterId) : -1;
    let insertPos = beforeApuIdx;
    if (insertPos === -1) {
      insertPos = withoutApu.length;
      for (let i = withoutApu.length - 1; i >= 0; i--) {
        if (withoutApu[i].chapterId === toChapterId) { insertPos = i + 1; break; }
      }
    }
    const nextApus = [...withoutApu];
    nextApus.splice(insertPos, 0, updatedApu);
    setApus(nextApus);
    if (chapters.some(c => c.id === toChapterId && !c.parentChapterId)) moveChildInChapter(toChapterId, apuId, beforeId, nextApus);
  }, [apus, chapters, moveChildInChapter]);

  /** Duplica una partida y deja la copia inmediatamente después del original. */
  const duplicateApu = useCallback((source: APU, newId: string) => {
    const dup: APU = { ...JSON.parse(JSON.stringify(source)), id: newId, createdAt: Date.now() };
    const i = apus.findIndex(a => a.id === source.id);
    const nextApus = [...apus];
    nextApus.splice(i === -1 ? nextApus.length : i + 1, 0, dup);
    setApus(nextApus);
    const parent = chapters.find(c => c.id === source.chapterId && !c.parentChapterId);
    if (parent) {
      const ids = getChapterChildren(parent, chapters, nextApus).map(c => c.id);
      const next = ids[ids.indexOf(source.id) + 1] ?? null;
      moveChildInChapter(parent.id, newId, next === newId ? null : next, nextApus);
    }
  }, [apus, chapters, moveChildInChapter]);

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
    chapters, setChapters, addChapter, moveChapter, reorderChapter, moveChildInChapter, deleteChapter,
    apus, setApus, addApu, updateApu, deleteApu, moveApu, moveApuToChapter, duplicateApu,
    history, addHistoryItem,
    activeProjectId, setActiveProjectId, loadProject, saveActiveProject,
    deleteProject, duplicateProject, lastSaved,
    reloadFromStorage
  };
};
