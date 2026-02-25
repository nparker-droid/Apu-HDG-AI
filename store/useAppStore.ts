import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Project, Chapter, APU, HistoryItem } from '../types';

const LIB_KEY = 'apu_engine_library';
const PROJECT_PREFIX = 'apu_engine_project_';

interface AppContextType {
  projects: Project[];
  chapters: Chapter[];
  apus: APU[];
  activeProjectId: string | null;
  lastSaved: number | null;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  setActiveProjectId: (id: string | null) => void;
  loadProject: (id: string) => void;
  saveActiveProject: () => boolean;
  moveChapter: (id: string, direction: 'up' | 'down') => void;
  updateApu: (apu: APU) => void;
  deleteChapter: (id: string) => void;
  deleteApu: (id: string) => void;
  addChapter: (chapter: Chapter) => void;
  addHistoryItem: (item: HistoryItem) => void;
  history: HistoryItem[];
  deleteProject: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem(LIB_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [apus, setApus] = useState<APU[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  useEffect(() => { localStorage.setItem(LIB_KEY, JSON.stringify(projects)); }, [projects]);

  const loadProject = useCallback((id: string) => {
    const savedData = localStorage.getItem(`${PROJECT_PREFIX}${id}`);
    if (savedData) {
      const parsed = JSON.parse(savedData);
      setChapters(parsed.chapters || []);
      setApus(parsed.apus || []);
      setActiveProjectId(id);
      setLastSaved(parsed.metadata?.updatedAt || null);
    }
  }, []);

  const saveActiveProject = useCallback(() => {
    if (!activeProjectId) return false;
    const timestamp = Date.now();
    const activeMeta = projects.find(p => p.id === activeProjectId);
    if (!activeMeta) return false;
    const updatedMeta = { ...activeMeta, updatedAt: timestamp };
    localStorage.setItem(`${PROJECT_PREFIX}${activeProjectId}`, JSON.stringify({ chapters, apus, metadata: updatedMeta }));
    setProjects(prev => prev.map(p => p.id === activeProjectId ? updatedMeta : p));
    setLastSaved(timestamp);
    return true;
  }, [activeProjectId, projects, chapters, apus]);

  const moveChapter = useCallback((id: string, direction: 'up' | 'down') => {
    setChapters(prev => {
      const projChapters = prev.filter(c => c.projectId === activeProjectId);
      const others = prev.filter(c => c.projectId !== activeProjectId);
      const index = projChapters.findIndex(c => c.id === id);
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= projChapters.length) return prev;
      const newList = [...projChapters];
      const temp = newList[index];
      newList[index] = newList[target];
      newList[target] = temp;
      return [...others, ...newList];
    });
  }, [activeProjectId]);

  const updateApu = (apu: APU) => setApus(prev => prev.map(a => a.id === apu.id ? apu : a));
  const deleteChapter = (id: string) => setChapters(prev => prev.filter(c => c.id !== id));
  const deleteApu = (id: string) => setApus(prev => prev.filter(a => a.id !== id));
  const addChapter = (c: Chapter) => setChapters(prev => [...prev, c]);
  const addHistoryItem = (i: HistoryItem) => setHistory(prev => [i, ...prev].slice(0, 500));
  const deleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    localStorage.removeItem(`${PROJECT_PREFIX}${id}`);
    if (activeProjectId === id) setActiveProjectId(null);
  };

  return (
    <AppContext.Provider 
      value={{ 
        projects, setProjects, chapters, apus, activeProjectId, setActiveProjectId, 
        loadProject, saveActiveProject, moveChapter, updateApu, deleteChapter, deleteApu, 
        addChapter, addHistoryItem, history, lastSaved, deleteProject 
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppStore must be used within AppProvider');
  return context;
};