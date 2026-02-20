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

  const loadProject = useCallback((id: string) => {
    const dataKey = `${PROJECT_PREFIX}${id}`;
    const savedData = localStorage.getItem(dataKey);
    
    if (savedData) {
      const parsed = JSON.parse(savedData);
      setChapters(parsed.chapters || []);
      setApus(parsed.apus || []);
      setActiveProjectId(id);
      setLastSaved(parsed.metadata?.updatedAt || null);
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
    const activeProjectMeta = projects.find(p => p.id === activeProjectId);
    if (!activeProjectMeta) return null;

    const updatedMeta = { ...activeProjectMeta, updatedAt: timestamp };
    const projectData = {
      chapters,
      apus,
      metadata: updatedMeta
    };
    localStorage.setItem(`${PROJECT_PREFIX}${activeProjectId}`, JSON.stringify(projectData));
    setProjects(prev => prev.map(p => p.id === activeProjectId ? updatedMeta : p));
    setLastSaved(timestamp);
    return timestamp;
  }, [activeProjectId, projects, chapters, apus]);

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
      // Filtrar solo capítulos del proyecto actual para el movimiento
      const otherProjectsChapters = prev.filter(c => c.projectId !== activeProjectId);
      const currentProjectChapters = prev.filter(c => c.projectId === activeProjectId);
      
      const currentIndex = currentProjectChapters.findIndex(c => c.id === chapterId);
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      
      if (targetIndex < 0 || targetIndex >= currentProjectChapters.length) return prev;
      
      const newCurrentProjectChapters = [...currentProjectChapters];
      const [movedItem] = newCurrentProjectChapters.splice(currentIndex, 1);
      newCurrentProjectChapters.splice(targetIndex, 0, movedItem);
      
      return [...otherProjectsChapters, ...newCurrentProjectChapters];
    });
  }, [activeProjectId]);

  const deleteChapter = useCallback((id: string) => {
    setChapters(prev => prev.filter(c => c.id !== id));
    setApus(prev => prev.filter(a => a.chapterId !== id));
  }, []);

  const addApu = useCallback((apu: APU) => {
    setApus(prev => [...prev, apu]);
  }, []);

  const updateApu = useCallback((updatedApu: APU) => {
    setApus(prev => prev.map(a => a.id === updatedApu.id ? updatedApu : a));
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

  return {
    projects, setProjects,
    chapters, setChapters, addChapter, moveChapter, deleteChapter,
    apus, setApus, addApu, updateApu, deleteApu,
    history, addHistoryItem,
    activeProjectId, setActiveProjectId, loadProject, saveActiveProject,
    deleteProject, duplicateProject, lastSaved
  };
};