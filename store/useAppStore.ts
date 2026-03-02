import { useState, useCallback, useEffect } from 'react';
import { Project, Chapter, APU, HistoryItem } from '../types';

const LIB_KEY = 'apu_engine_library';
const PROJECT_PREFIX = 'apu_engine_project_';

export const useAppStore = () => {
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem(LIB_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [apus, setApus] = useState<APU[]>([]);
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('apu_history');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(LIB_KEY, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('apu_history', JSON.stringify(history));
  }, [history]);

  // Save active project whenever it changes
  useEffect(() => {
    if (activeProjectId) {
      const activeProjectMeta = projects.find(p => p.id === activeProjectId);
      if (activeProjectMeta) {
        const projectData = {
          chapters,
          apus,
          metadata: activeProjectMeta
        };
        localStorage.setItem(`${PROJECT_PREFIX}${activeProjectId}`, JSON.stringify(projectData));
      }
    }
  }, [chapters, apus, activeProjectId, projects]);

  const loadProject = useCallback((id: string) => {
    const dataKey = `${PROJECT_PREFIX}${id}`;
    const savedData = localStorage.getItem(dataKey);

    if (savedData) {
      const parsed = JSON.parse(savedData);
      // We don't setProjects here to avoid trigger the save effect immediately
      setChapters(parsed.chapters || []);
      setApus(parsed.apus || []);
      setActiveProjectId(id);
      setLastSaved(parsed.metadata?.updatedAt || Date.now());
    } else {
      setChapters([]);
      setApus([]);
      setActiveProjectId(id);
      setLastSaved(null);
    }
  }, []);

  const saveActiveProject = useCallback(() => {
    if (!activeProjectId) return null;
    const timestamp = Date.now();

    setProjects(prev => prev.map(p => {
      if (p.id === activeProjectId) {
        return { ...p, updatedAt: timestamp };
      }
      return p;
    }));

    setLastSaved(timestamp);
    return timestamp;
  }, [activeProjectId]);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    localStorage.removeItem(`${PROJECT_PREFIX}${id}`);
    if (activeProjectId === id) {
      setActiveProjectId(null);
      setChapters([]);
      setApus([]);
    }
  }, [activeProjectId]);

  const duplicateProject = useCallback((id: string) => {
    const sourceProject = projects.find(p => p.id === id);
    if (!sourceProject) return;
    const sourceDataRaw = localStorage.getItem(`${PROJECT_PREFIX}${id}`);
    if (!sourceDataRaw) return;

    const sourceData = JSON.parse(sourceDataRaw);
    const newId = crypto.randomUUID();
    const timestamp = Date.now();

    const newMetadata: Project = {
      ...sourceProject,
      id: newId,
      name: `${sourceProject.name} (Copia)`,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const newData = {
      ...sourceData,
      chapters: sourceData.chapters.map((c: Chapter) => ({ ...c, id: crypto.randomUUID(), projectId: newId })),
      apus: sourceData.apus.map((a: APU) => ({ ...a, id: crypto.randomUUID(), projectId: newId })),
      metadata: newMetadata
    };

    setProjects(prev => [newMetadata, ...prev]);
    localStorage.setItem(`${PROJECT_PREFIX}${newId}`, JSON.stringify(newData));
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
    if (!item.description || item.description.trim() === "") return;
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

  return {
    projects, setProjects,
    chapters, setChapters, addChapter, moveChapter, deleteChapter,
    apus, setApus, addApu, updateApu, deleteApu, moveApu,
    history, addHistoryItem,
    activeProjectId, setActiveProjectId, loadProject, saveActiveProject,
    deleteProject, duplicateProject, lastSaved
  };
};