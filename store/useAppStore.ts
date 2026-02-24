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
    }
  }, []);

  const saveActiveProject = useCallback(() => {
    if (!activeProjectId) return null;
    const timestamp = Date.now();
    const activeProjectMeta = projects.find(p => p.id === activeProjectId);
    if (!activeProjectMeta) return null;

    const updatedMeta = { ...activeProjectMeta, updatedAt: timestamp };
    const projectData = { chapters, apus, metadata: updatedMeta };
    localStorage.setItem(`${PROJECT_PREFIX}${activeProjectId}`, JSON.stringify(projectData));
    setProjects(prev => prev.map(p => p.id === activeProjectId ? updatedMeta : p));
    setLastSaved(timestamp);
    return timestamp;
  }, [activeProjectId, projects, chapters, apus]);

  const moveChapter = useCallback((chapterId: string, direction: 'up' | 'down') => {
    setChapters(prev => {
      const currentProjectChapters = prev.filter(c => c.projectId === activeProjectId);
      const otherChapters = prev.filter(c => c.projectId !== activeProjectId);
      const currentIndex = currentProjectChapters.findIndex(c => c.id === chapterId);
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= currentProjectChapters.length) return prev;
      const newOrder = [...currentProjectChapters];
      const [movedItem] = newOrder.splice(currentIndex, 1);
      newOrder.splice(targetIndex, 0, movedItem);
      return [...otherChapters, ...newOrder];
    });
  }, [activeProjectId]);

  // LOGICA PARA MOVER SUBPARTIDAS
  const moveApu = useCallback((apuId: string, direction: 'up' | 'down') => {
    setApus(prev => {
      const apuToMove = prev.find(a => a.id === apuId);
      if (!apuToMove) return prev;
      
      const chapterApus = prev
        .filter(a => a.chapterId === apuToMove.chapterId)
        .sort((a, b) => a.createdAt - b.createdAt);

      const currentIndex = chapterApus.findIndex(a => a.id === apuId);
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      if (targetIndex < 0 || targetIndex >= chapterApus.length) return prev;

      const newApus = [...prev];
      const itemA = newApus.find(a => a.id === apuId)!;
      const itemB = newApus.find(a => a.id === chapterApus[targetIndex].id)!;
      
      const tempDate = itemA.createdAt;
      itemA.createdAt = itemB.createdAt;
      itemB.createdAt = tempDate;

      return [...newApus];
    });
  }, []);

  return {
    projects, setProjects, chapters, setChapters, addChapter: (c: Chapter) => setChapters(prev => [...prev, c]),
    moveChapter, moveApu, deleteChapter: (id: string) => { setChapters(prev => prev.filter(c => c.id !== id)); setApus(prev => prev.filter(a => a.chapterId !== id)); },
    apus, setApus, updateApu: (ua: APU) => setApus(prev => prev.map(a => a.id === ua.id ? ua : a)),
    deleteApu: (id: string) => setApus(prev => prev.filter(a => a.id !== id)),
    history, addHistoryItem: (item: HistoryItem) => setHistory(prev => [item, ...prev.filter(h => h.description !== item.description)].slice(0, 500)),
    activeProjectId, setActiveProjectId, loadProject, saveActiveProject, deleteProject, duplicateProject, lastSaved
  };
};