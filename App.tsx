import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Menu, Save, Loader2, Download, Plus, Check, Clock, Database } from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import Sidebar from './components/Layout/Sidebar';
import APUEditor from './components/APUEditor';
import ProjectModal from './components/ProjectModal';
import ChapterModal from './components/ChapterModal';
import LibraryModal from './components/LibraryModal';
import ProjectGeneralView from './components/ProjectGeneralView';
import { exportProjectToExcel } from './services/excelExportService';
import { Project, APU, Chapter, ItemCategory } from './types';
import { Toaster, toast } from 'sonner';

const safeUUID = () => crypto.randomUUID();

const App: React.FC = () => {
  const {
    projects, setProjects,
    chapters, setChapters, addChapter, moveChapter, deleteChapter,
    apus, setApus, updateApu, addApu, deleteApu,
    history, addHistoryItem,
    activeProjectId, setActiveProjectId, loadProject, saveActiveProject,
    deleteProject, duplicateProject, lastSaved
  } = useAppStore();

  const [currentApuId, setCurrentApuId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [chapterModalProjectId, setChapterModalProjectId] = useState<string | null>(null);
  const [libraryChapterId, setLibraryChapterId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // LÓGICA DE RENUMERACIÓN AUTOMÁTICA PROFUNDA
  useEffect(() => {
    if (!activeProjectId) return;

    // 1. Filtrar y ordenar capítulos por su posición actual en el estado
    const currentProjectChapters = chapters.filter(c => c.projectId === activeProjectId);
    
    // Solo procedemos si hay capítulos
    if (currentProjectChapters.length === 0) return;

    let needsUpdate = false;
    
    const renumberedChapters = chapters.map(ch => {
      if (ch.projectId !== activeProjectId) return ch;
      const newCode = (currentProjectChapters.indexOf(ch) + 1).toString();
      if (ch.code !== newCode) {
        needsUpdate = true;
        return { ...ch, code: newCode };
      }
      return ch;
    });

    const renumberedApus = apus.map(apu => {
      if (apu.projectId !== activeProjectId) return apu;
      const parentChapter = renumberedChapters.find(c => c.id === apu.chapterId);
      if (!parentChapter) return apu;

      const siblings = apus
        .filter(a => a.chapterId === apu.chapterId)
        .sort((a, b) => a.createdAt - b.createdAt);
      
      const apuIndex = siblings.indexOf(apu) + 1;
      const newCode = `${parentChapter.code}.${apuIndex}`;
      
      if (apu.code !== newCode) {
        needsUpdate = true;
        return { ...apu, code: newCode };
      }
      return apu;
    });

    if (needsUpdate) {
      setChapters(renumberedChapters);
      setApus(renumberedApus);
    }
  }, [chapters, apus, activeProjectId]);

  // Autoguardado cada 60 segundos
  const saveRef = useRef(saveActiveProject);
  useEffect(() => { saveRef.current = saveActiveProject; }, [saveActiveProject]);

  useEffect(() => {
    if (!activeProjectId) return;
    const timer = setInterval(() => {
      const result = saveRef.current();
      if (result) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [activeProjectId]);

  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId), [projects, activeProjectId]);
  const activeApu = useMemo(() => apus.find(a => a.id === currentApuId), [apus, currentApuId]);
  const activeChapter = useMemo(() => chapters.find(c => c.id === activeApu?.chapterId), [chapters, activeApu]);

  const currentProjectApus = useMemo(() => {
    if (!activeProjectId) return [];
    return apus.filter(a => a.projectId === activeProjectId);
  }, [apus, activeProjectId]);

  const handleManualSave = () => {
    setSaveStatus('saving');
    setTimeout(() => {
      const result = saveActiveProject();
      if (result) {
        setSaveStatus('saved');
        toast.success(`Proyecto guardado`);
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('idle');
      }
    }, 400);
  };

  const handleProjectSubmit = (data: any) => {
    if (editingProject) {
      const updatedMeta = { ...editingProject, ...data, updatedAt: Date.now() };
      setProjects(projects.map(p => p.id === editingProject.id ? updatedMeta : p));
      setEditingProject(null);
    } else {
      const newId = safeUUID();
      const timestamp = Date.now();
      const newProject: Project = { ...data, id: newId, createdAt: timestamp, updatedAt: timestamp };
      localStorage.setItem(`apu_engine_project_${newId}`, JSON.stringify({ metadata: newProject, chapters: [], apus: [] }));
      setProjects([newProject, ...projects]);
      loadProject(newId);
      setCurrentApuId(null);
    }
    setIsProjectModalOpen(false);
  };

  const handleCreateChapter = (name: string) => {
    if (!activeProjectId) return;
    const newChapter = {
      id: safeUUID(),
      projectId: activeProjectId,
      code: (chapters.filter(c => c.projectId === activeProjectId).length + 1).toString(),
      name: name
    };
    addChapter(newChapter);
    setChapterModalProjectId(null);
  };

  const createNewApu = (projectId: string, chapterId: string, baseApu?: Partial<APU>) => {
    const proj = projects.find(p => p.id === projectId);
    const newApu: APU = {
      id: safeUUID(), projectId, chapterId,
      code: '', 
      name: baseApu?.name || 'Nueva Partida', 
      unit: baseApu?.unit || 'GL', 
      quantity: 1,
      items: baseApu?.items ? JSON.parse(JSON.stringify(baseApu.items)) : { 
        [ItemCategory.MATERIAL]: [], [ItemCategory.MANO_DE_OBRA]: [], [ItemCategory.EQUIPO]: [], [ItemCategory.OTROS]: [] 
      },
      useProjectGlobalRates: true, 
      socialLawsPercentage: proj?.globalSocialLaws || 30, 
      overheadPercentage: proj?.globalOverhead || 15, 
      utilityPercentage: proj?.globalUtility || 10,
      createdAt: Date.now(),
    };
    setApus([...apus, newApu]);
    setCurrentApuId(newApu.id);
    setLibraryChapterId(null);
  };

  return (
    <div className="flex h-screen bg-[#F1F5F9] overflow-hidden text-slate-800 font-sans">
      <Toaster position="top-right" theme="light" expand={false} richColors />
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        projects={projects}
        chapters={chapters}
        apus={apus}
        moveChapter={moveChapter}
        deleteChapter={deleteChapter}
        currentProjectId={activeProjectId}
        setCurrentProjectId={(id) => {
          if (id) { loadProject(id); setCurrentApuId(null); }
          else setActiveProjectId(null);
        }}
        currentApuId={currentApuId}
        setCurrentApuId={setCurrentApuId}
        onNewProject={() => { setEditingProject(null); setIsProjectModalOpen(true); }}
        onEditProject={(p) => { setEditingProject(p); setIsProjectModalOpen(true); }}
        onNewChapter={() => activeProjectId && setChapterModalProjectId(activeProjectId)}
        onLibraryOpen={(cid) => setLibraryChapterId(cid)}
        onCreateApu={createNewApu}
        onDuplicateApu={(a) => {
          const dup = { ...JSON.parse(JSON.stringify(a)), id: safeUUID(), createdAt: Date.now() };
          setApus([...apus, dup]);
        }}
        onDeleteApu={(id) => {
          deleteApu(id);
          if (currentApuId === id) setCurrentApuId(null);
        }}
        onShareProject={() => {}}
        handleImport={() => {}}
        onDeleteProject={(id) => {
          deleteProject(id);
          if (activeProjectId === id) {
            setActiveProjectId(null);
            setCurrentApuId(null);
          }
          toast.error('Proyecto eliminado');
        }}
        onDuplicateProject={(id) => {
          const newId = duplicateProject(id);
          if (newId) toast.success('Proyecto duplicado con éxito');
        }}
      />

      <main className="flex-1 overflow-y-auto relative flex flex-col no-scrollbar">
        {activeProject ? (
          <>
            <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-6">
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 rounded-lg text-[#004071]">
                  <Menu className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-lg font-black text-[#004071] uppercase truncate max-w-md">
                    {activeApu ? activeApu.name : `VISTA GENERAL: ${activeProject.name}`}
                  </h2>
                  <p className="text-[9px] text-[#88C13E] font-black uppercase tracking-widest">{activeProject.name} • {activeProject.code}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleManualSave} disabled={saveStatus === 'saving'} className="flex items-center gap-2 text-[8px] font-black px-4 py-2 rounded-xl bg-slate-100 text-slate-600 uppercase tracking-widest">
                  {saveStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : saveStatus === 'saved' ? <Check className="w-3 h-3 text-green-600" /> : <Save className="w-3 h-3" />} 
                  {saveStatus === 'saved' ? 'Guardado' : 'Guardar'}
                </button>
                <button onClick={() => exportProjectToExcel(activeProject, chapters, apus)} className="flex items-center gap-2 text-[8px] font-black text-white bg-green-600 px-4 py-2 rounded-xl shadow-lg uppercase tracking-widest">
                  <Download className="w-3 h-3" /> Excel
                </button>
              </div>
            </header>
            <div className="p-8">
              {activeApu && activeChapter ? (
                <APUEditor apu={activeApu} onUpdate={updateApu} history={history} project={activeProject} chapter={activeChapter} onRegisterResource={addHistoryItem} />
              ) : (
                <ProjectGeneralView project={activeProject} chapters={chapters} apus={apus} />
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-screen text-center max-w-xl mx-auto space-y-12 animate-in fade-in duration-500">
             {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="fixed top-4 left-4 p-3 bg-white shadow-lg rounded-xl text-[#004071] z-50 border border-slate-100"><Menu className="w-6 h-6" /></button>}
             <h1 className="text-4xl font-black text-[#004071] uppercase leading-none">Hidrogestión APU ENGINE</h1>
             <button onClick={() => { setEditingProject(null); setIsProjectModalOpen(true); }} className="bg-[#004071] text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Nuevo Proyecto</button>
          </div>
        )}
      </main>

      {isProjectModalOpen && <ProjectModal initialData={editingProject || undefined} onClose={() => { setIsProjectModalOpen(false); setEditingProject(null); }} onSubmit={handleProjectSubmit} />}
      {chapterModalProjectId && <ChapterModal onClose={() => setChapterModalProjectId(null)} onSubmit={handleCreateChapter} />}
      {libraryChapterId && (
        <LibraryModal onClose={() => setLibraryChapterId(null)} projectApus={currentProjectApus} onSelect={(libApu) => { if (activeProject) createNewApu(activeProject.id, libraryChapterId, libApu); }} />
      )}
    </div>
  );
};

export default App;