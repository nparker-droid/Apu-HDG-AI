import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Project, Chapter, APU, HistoryItem } from '../types';

interface AppState {
  projects: Project[];
  chapters: Chapter[];
  apus: APU[];
  history: HistoryItem[];
  activeProjectId: string | null;
  lastSaved: number | null;
  
  setProjects: (projects: Project[]) => void;
  setChapters: (chapters: Chapter[]) => void;
  setApus: (apus: APU[]) => void;
  setHistory: (history: HistoryItem[]) => void;
  setActiveProjectId: (id: string | null) => void;
  
  addChapter: (chapter: Chapter) => void;
  deleteChapter: (id: string) => void;
  moveChapter: (id: string, direction: 'up' | 'down') => void;
  
  updateApu: (apu: APU) => void;
  deleteApu: (id: string) => void;
  addHistoryItem: (item: HistoryItem) => void;
  
  loadProject: (id: string) => void;
  saveActiveProject: () => boolean;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      projects: [],
      chapters: [],
      apus: [],
      history: [],
      activeProjectId: null,
      lastSaved: null,

      setProjects: (projects) => set({ projects }),
      setChapters: (chapters) => set({ chapters }),
      setApus: (apus) => set({ apus }),
      setHistory: (history) => set({ history }),
      setActiveProjectId: (id) => set({ activeProjectId: id }),

      addChapter: (chapter) => set((state) => ({ 
        chapters: [...state.chapters, chapter] 
      })),

      deleteChapter: (id) => set((state) => ({
        chapters: state.chapters.filter((c) => c.id !== id),
        apus: state.apus.filter((a) => a.chapterId !== id)
      })),

      moveChapter: (id, direction) => set((state) => {
        const activeId = state.activeProjectId;
        if (!activeId) return state;

        // 1. Obtener todos los capítulos
        const allChapters = [...state.chapters];
        
        // 2. Identificar los que pertenecen al proyecto activo para saber el orden relativo
        const projectChapters = allChapters.filter(c => c.projectId === activeId);
        const indexInProject = projectChapters.findIndex(c => c.id === id);
        
        if (indexInProject === -1) return state;

        const targetIndexInProject = direction === 'up' ? indexInProject - 1 : indexInProject + 1;
        
        if (targetIndexInProject < 0 || targetIndexInProject >= projectChapters.length) return state;

        // 3. Encontrar los índices reales en el array global (allChapters)
        const id1 = projectChapters[indexInProject].id;
        const id2 = projectChapters[targetIndexInProject].id;
        
        const realIdx1 = allChapters.findIndex(c => c.id === id1);
        const realIdx2 = allChapters.findIndex(c => c.id === id2);

        // 4. Intercambiar físicamente
        const temp = allChapters[realIdx1];
        allChapters[realIdx1] = allChapters[realIdx2];
        allChapters[realIdx2] = temp;

        return { chapters: allChapters };
      }),

      updateApu: (updatedApu) => set((state) => ({
        apus: state.apus.map((a) => (a.id === updatedApu.id ? updatedApu : a))
      })),

      deleteApu: (id) => set((state) => ({
        apus: state.apus.filter((a) => a.id !== id)
      })),

      addHistoryItem: (item) => set((state) => {
        const cleanDescription = item.description.trim().toLowerCase();
        const filteredHistory = state.history.filter(
          (h) => h.description.trim().toLowerCase() !== cleanDescription || h.category !== item.category
        );
        return { history: [item, ...filteredHistory].slice(0, 500) };
      }),

      loadProject: (id) => set({ activeProjectId: id }),

      saveActiveProject: () => {
        set({ lastSaved: Date.now() });
        return true;
      },

      deleteProject: (id) => set((state) => ({
        projects: state.projects.filter(p => p.id !== id),
        chapters: state.chapters.filter(c => c.projectId !== id),
        apus: state.apus.filter(a => a.projectId !== id),
        activeProjectId: state.activeProjectId === id ? null : state.activeProjectId
      })),

      duplicateProject: (id) => set((state) => {
        const project = state.projects.find(p => p.id === id);
        if (!project) return state;

        const newProjectId = crypto.randomUUID();
        const newProject = { 
          ...project, 
          id: newProjectId, 
          name: `${project.name} (Copia)`,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        const projectChapters = state.chapters.filter(c => c.projectId === id);
        const newChapters = projectChapters.map(c => ({
          ...c,
          id: crypto.randomUUID(),
          projectId: newProjectId
        }));

        const projectApus = state.apus.filter(a => a.projectId === id);
        const newApus = projectApus.map(a => {
          const oldChapter = projectChapters.find(c => c.id === a.chapterId);
          const newChapter = newChapters.find(c => oldChapter && c.name === oldChapter.name);
          return {
            ...a,
            id: crypto.randomUUID(),
            projectId: newProjectId,
            chapterId: newChapter?.id || a.chapterId
          };
        });

        return {
          projects: [newProject, ...state.projects],
          chapters: [...state.chapters, ...newChapters],
          apus: [...state.apus, ...newApus]
        };
      })
    }),
    {
      name: 'apu-engine-storage',
    }
  )
);