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

  // Lógica de renumeración automática simple
  useEffect(() => {
    if (!activeProjectId) return;
    const currentProjectChapters = chapters.filter(c => c.projectId === activeProjectId);
    
    const renumberedChapters = chapters.map(ch => {
      if (ch.projectId !== activeProjectId) return ch;
      const index = currentProjectChapters.findIndex(c => c.id === ch.id);
      return { ...ch, code: (index + 1).toString() };
    });

    const renumberedApus = apus.map(apu => {
      const chapter = renumberedChapters.find(c => c.id === apu.chapterId);
      if (!chapter) return apu;
      const chapterApus = apus.filter(a => a.chapterId === apu.chapterId).sort((a, b) => a.createdAt - b.createdAt);
      const index = chapterApus.findIndex(a => a.id === apu.id);
      return { ...apu, code: `${chapter.code}.${index + 1}` };
    });

    setChapters(renumberedChapters);
    setApus(renumberedApus);
  }, [chapters.length, apus.length, activeProjectId]);

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

  const handleManualSave = () => {
    setSaveStatus('saving');
    const result = saveActiveProject();
    if (result) {
      setSaveStatus('saved');
      toast.success("Proyecto guardado localmente");
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
        setCurrentProjectId={(id) => { if (id) loadProject(id); setCurrentApuId(null); }}
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
            <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-slate-200 px-8 py-4 flex items-center justify-between">
              <div className="flex items-center gap-6">
                {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-[#004071]"><Menu className="w-5 h-5" /></button>}
                <div>
                  <h2 className="text-lg font-black text-[#004071] uppercase">{activeApu ? activeApu.name : `GENERAL: ${activeProject.name}`}</h2>
                  <div className="flex items-center gap-3">
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
              {activeApu && activeChapter ? (
                <APUEditor apu={activeApu} onUpdate={updateApu} history={history} project={activeProject} chapter={activeChapter} onRegisterResource={addHistoryItem} />
              ) : (
                <ProjectGeneralView project={activeProject} chapters={chapters} apus={apus} />
              )}
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center">
            <h1 className="text-4xl font-black text-[#004071] uppercase">Apu Engine</h1>
          </div>
        )}
      </main>
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