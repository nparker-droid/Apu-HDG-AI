import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Menu, Save, Loader2, Download, Plus, Check, Clock } from 'lucide-react';
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
    apus, setApus, updateApu, deleteApu,
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

  // --- Lógica de renumeración segura ---
  useEffect(() => {
    if (!activeProjectId || chapters.length === 0) return;

    const currentProjectChapters = chapters.filter(c => c.projectId === activeProjectId);
    
    const renumberedChapters = chapters.map(ch => {
      if (ch.projectId !== activeProjectId) return ch;
      const index = currentProjectChapters.findIndex(c => c.id === ch.id);
      return { ...ch, code: (index + 1).toString() };
    });

    const renumberedApus = apus.map(apu => {
      if (apu.projectId !== activeProjectId) return apu;
      const chapter = renumberedChapters.find(c => c.id === apu.chapterId);
      if (!chapter) return apu;
      const chapterApus = apus.filter(a => a.chapterId === apu.chapterId).sort((a, b) => a.createdAt - b.createdAt);
      const index = chapterApus.findIndex(a => a.id === apu.id);
      return { ...apu, code: `${chapter.code}.${index + 1}` };
    });

    // Solo actualizar si realmente hubo un cambio para evitar bucles infinitos
    if (JSON.stringify(renumberedChapters) !== JSON.stringify(chapters)) setChapters(renumberedChapters);
    if (JSON.stringify(renumberedApus) !== JSON.stringify(apus)) setApus(renumberedApus);
  }, [chapters.length, apus.length, activeProjectId]);

  // --- Autoguardado ---
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

  // --- SELECCIÓN SEGURA DE DATOS (Previene Pantalla Blanca) ---
  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId), [projects, activeProjectId]);
  
  const activeApu = useMemo(() => {
    if (!currentApuId || apus.length === 0) return null;
    return apus.find(a => a.id === currentApuId) || null;
  }, [apus, currentApuId]);

  const activeChapter = useMemo(() => {
    if (!activeApu || chapters.length === 0) return null;
    return chapters.find(c => c.id === activeApu.chapterId) || null;
  }, [chapters, activeApu]);

  const handleManualSave = () => {
    setSaveStatus('saving');
    if (saveActiveProject()) {
      setSaveStatus('saved');
      toast.success("Cambios sincronizados");
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  return (
    <div className="flex h-screen bg-[#F1F5F9] overflow-hidden">
      <Toaster position="top-right" richColors />
      
      <Sidebar
        isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen}
        projects={projects} chapters={chapters} apus={apus}
        moveChapter={moveChapter} deleteChapter={deleteChapter}
        currentProjectId={activeProjectId}
        setCurrentProjectId={(id) => { 
          setActiveProjectId(id);
          if (id) loadProject(id); 
          setCurrentApuId(null); 
        }}
        currentApuId={currentApuId} setCurrentApuId={setCurrentApuId}
        onNewProject={() => { setEditingProject(null); setIsProjectModalOpen(true); }}
        onEditProject={(p) => { setEditingProject(p); setIsProjectModalOpen(true); }}
        onNewChapter={() => activeProjectId && setChapterModalProjectId(activeProjectId)}
        onLibraryOpen={setLibraryChapterId}
        onCreateApu={(pid, cid) => {
          const nApu: APU = {
            id: safeUUID(), projectId: pid, chapterId: cid, code: '', name: 'Nueva Partida', unit: 'GL', quantity: 1,
            items: { [ItemCategory.MATERIAL]: [], [ItemCategory.MANO_DE_OBRA]: [], [ItemCategory.EQUIPO]: [], [ItemCategory.OTROS]: [] },
            useProjectGlobalRates: true, socialLawsPercentage: 30, overheadPercentage: 15, utilityPercentage: 10, createdAt: Date.now()
          };
          setApus([...apus, nApu]);
          setCurrentApuId(nApu.id);
        }}
        onDuplicateApu={(a) => { const dup = { ...JSON.parse(JSON.stringify(a)), id: safeUUID(), createdAt: Date.now() }; setApus([...apus, dup]); }}
        onDeleteApu={(id) => { deleteApu(id); if (currentApuId === id) setCurrentApuId(null); }}
        onShareProject={() => {}}
        handleImport={() => {}}
        onDeleteProject={deleteProject}
        onDuplicateProject={duplicateProject}
      />

      <main className="flex-1 overflow-y-auto relative flex flex-col no-scrollbar">
        {activeProject ? (
          <>
            <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-6">
                {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-[#004071]"><Menu className="w-5 h-5" /></button>}
                <div>
                  <h2 className="text-lg font-black text-[#004071] uppercase truncate max-w-md">
                    {/* Guard condicional para evitar errores de renderizado */}
                    {activeApu ? activeApu.name : `GENERAL: ${activeProject.name}`}
                  </h2>
                  <div className="flex items-center gap-3">
                    <p className="text-[9px] text-[#88C13E] font-black uppercase tracking-widest">{activeProject.name}</p>
                    {lastSaved && <span className="text-[8px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded-full"><Clock className="w-2.5 h-2.5 mr-1" />{new Date(lastSaved).toLocaleTimeString()}</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleManualSave} className="flex items-center gap-2 text-[8px] font-black px-4 py-2 rounded-xl bg-slate-100 text-slate-600 uppercase tracking-widest">
                  {saveStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : saveStatus === 'saved' ? <Check className="w-3 h-3 text-green-600" /> : <Save className="w-3 h-3" />} Guardar
                </button>
                <button onClick={() => exportProjectToExcel(activeProject, chapters, apus)} className="flex items-center gap-2 text-[8px] font-black text-white bg-green-600 px-4 py-2 rounded-xl uppercase tracking-widest">
                  <Download className="w-3 h-3" /> Reporte Excel
                </button>
              </div>
            </header>

            <div className="p-8">
              {/* Solo renderizamos APUEditor si AMBOS existen. Si no, mostramos GeneralView de forma segura */}
              {activeApu && activeChapter ? (
                <APUEditor 
                  apu={activeApu} 
                  onUpdate={updateApu} 
                  history={history} 
                  project={activeProject} 
                  chapter={activeChapter} 
                  onRegisterResource={addHistoryItem} 
                />
              ) : (
                <ProjectGeneralView 
                  project={activeProject} 
                  chapters={chapters} 
                  apus={apus} 
                />
              )}
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center space-y-4">
             <h1 className="text-4xl font-black text-[#004071] uppercase tracking-tighter">Hidrogestión APU ENGINE</h1>
             <p className="text-slate-400 text-sm">Selecciona o crea un proyecto para comenzar</p>
          </div>
        )}
      </main>

      {/* Modales */}
      {isProjectModalOpen && <ProjectModal initialData={editingProject || undefined} onClose={() => setIsProjectModalOpen(false)} onSubmit={(data) => {
        const newId = safeUUID();
        setProjects([{ ...data, id: newId, createdAt: Date.now(), updatedAt: Date.now() }, ...projects]);
        loadProject(newId);
        setIsProjectModalOpen(false);
      }} />}
      {chapterModalProjectId && <ChapterModal onClose={() => setChapterModalProjectId(null)} onSubmit={(name) => {
        addChapter({ id: safeUUID(), projectId: activeProjectId!, code: '', name });
        setChapterModalProjectId(null);
      }} />}
    </div>
  );
};

export default App;