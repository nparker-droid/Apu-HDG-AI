import { useState, useCallback, useEffect } from 'react';
import { Project, Chapter, APU, HistoryItem } from '../types';

// Prefijos para localStorage
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

  // Persistencia de proyectos base
  useEffect(() => {
    localStorage.setItem(LIB_KEY, JSON.stringify(projects));
  }, [projects]);

  // Carga de datos del proyecto activo
  const loadProject = useCallback((id: string) => {
    const dataKey = `${PROJECT_PREFIX}${id}`;
    const savedData = localStorage.getItem(dataKey);
    if (savedData) {
      const parsed = JSON.parse(savedData);
      setChapters(parsed.chapters || []);
      setApus(parsed.apus || []);
      setActiveProjectId(id);
      setLastSaved(parsed.metadata?.updatedAt || null);
    }
  }, []);

  // Guardado manual/automático
  const saveActiveProject = useCallback(() => {
    if (!activeProjectId) return false;
    const timestamp = Date.now();
    const activeProjectMeta = projects.find(p => p.id === activeProjectId);
    if (!activeProjectMeta) return false;

    const updatedMeta = { ...activeProjectMeta, updatedAt: timestamp };
    const projectData = { chapters, apus, metadata: updatedMeta };
    
    localStorage.setItem(`${PROJECT_PREFIX}${activeProjectId}`, JSON.stringify(projectData));
    setProjects(prev => prev.map(p => p.id === activeProjectId ? updatedMeta : p));
    setLastSaved(timestamp);
    return true;
  }, [activeProjectId, projects, chapters, apus]);

  // LÓGICA CORREGIDA: Intercambio físico de posiciones para renumeración
  const moveChapter = useCallback((id: string, direction: 'up' | 'down') => {
    setChapters(prev => {
      const projectChapters = prev.filter(c => c.projectId === activeProjectId);
      const otherChapters = prev.filter(c => c.projectId !== activeProjectId);
      
      const index = projectChapters.findIndex(c => c.id === id);
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      
      if (targetIndex < 0 || targetIndex >= projectChapters.length) return prev;

      const newProjectChapters = [...projectChapters];
      const temp = newProjectChapters[index];
      newProjectChapters[index] = newProjectChapters[targetIndex];
      newProjectChapters[targetIndex] = temp;

      return [...otherChapters, ...newProjectChapters];
    });
  }, [activeProjectId]);

  return {
    projects, setProjects,
    chapters, setChapters, moveChapter,
    apus, setApus,
    history, setHistory,
    activeProjectId, setActiveProjectId, loadProject, saveActiveProject,
    lastSaved
  };
};