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

  // --- 1. SELECCIÓN DE DATOS CON "FAIL-SAFE" ---
  const activeProject = useMemo(() =>
    projects.find(p => p.id === activeProjectId) || null,
    [projects, activeProjectId]);

  const activeApu = useMemo(() => {
    if (!currentApuId || apus.length === 0) return null;
    return apus.find(a => a.id === currentApuId) || null;
  }, [apus, currentApuId]);

  const activeChapter = useMemo(() => {
    if (!activeApu || chapters.length === 0) return null;
    return chapters.find(c => c.id === activeApu.chapterId) || null;
  }, [chapters, activeApu]);

  // --- 2. RENUMERACIÓN AUTOMÁTICA (Protección contra Loops) ---
  useEffect(() => {
    if (!activeProjectId || chapters.length === 0) return;

    const projectChapters = chapters.filter(c => c.projectId === activeProjectId);

    const newChapters = chapters.map(ch => {
      if (ch.projectId !== activeProjectId) return ch;
      const idx = projectChapters.findIndex(c => c.id === ch.id);
      const newCode = (idx + 1).toString();
      return ch.code !== newCode ? { ...ch, code: newCode } : ch;
    });

    const newApus = apus.map(apu => {
      if (apu.projectId !== activeProjectId) return apu;
      const ch = newChapters.find(c => c.id === apu.chapterId);
      if (!ch) return apu;
      const siblings = apus.filter(a => a.chapterId === apu.chapterId);
      const idx = siblings.findIndex(s => s.id === apu.id);
      const newCode = `${ch.code}.${idx + 1}`;
      return apu.code !== newCode ? { ...apu, code: newCode } : apu;
    });

    // Comparación profunda para evitar renders infinitos
    if (JSON.stringify(newChapters) !== JSON.stringify(chapters)) setChapters(newChapters);
    if (JSON.stringify(newApus) !== JSON.stringify(apus)) setApus(newApus);
  }, [chapters.length, apus.length, activeProjectId]);

  // --- 3. AUTOGUARDADO (Timer independiente) ---
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

  // --- 4. MANEJADORES DE ACCIÓN ---
  const handleManualSave = () => {
    setSaveStatus('saving');
    if (saveActiveProject()) {
      setSaveStatus('saved');
      toast.success("Sincronización manual completa");
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const handleCreateApu = (pid: string, cid: string) => {
    const proj = projects.find(p => p.id === pid);
    const nApu: APU = {
      id: safeUUID(),
      projectId: pid,
      chapterId: cid,
      code: '',
      name: 'Nueva Partida',
      unit: 'GL',
      quantity: 1.0, // Forzado a número inicial
      items: {
        [ItemCategory.MATERIAL]: [],
        [ItemCategory.MANO_DE_OBRA]: [],
        [ItemCategory.EQUIPO]: [],
        [ItemCategory.OTROS]: []
      },
      useProjectGlobalRates: true,
      socialLawsPercentage: proj?.globalSocialLaws || 30,
      overheadPercentage: proj?.globalOverhead || 15,
      utilityPercentage: proj?.globalUtility || 10,
      createdAt: Date.now()
    };
    setApus([...apus, nApu]);
    setCurrentApuId(nApu.id);
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
        currentApuId={currentApuId}
        setCurrentApuId={(id) => { if (id !== currentApuId) setCurrentApuId(id); }}
        onNewProject={() => { setEditingProject(null); setIsProjectModalOpen(true); }}
        onEditProject={(p) => { setEditingProject(p); setIsProjectModalOpen(true); }}
        onNewChapter={() => activeProjectId && setChapterModalProjectId(activeProjectId)}
        onLibraryOpen={setLibraryChapterId}
        onCreateApu={handleCreateApu}
        onDuplicateApu={(a) => { const dup = { ...JSON.parse(JSON.stringify(a)), id: safeUUID(), createdAt: Date.now() }; setApus([...apus, dup]); }}
        onDeleteApu={(id) => { deleteApu(id); if (currentApuId === id) setCurrentApuId(null); }}
        onShareProject={() => { }}
        handleImport={() => { }}
        onDeleteProject={deleteProject}
        onDuplicateProject={duplicateProject}
        moveApu={moveApu}
      />

      <main className="flex-1 overflow-y-auto relative flex flex-col no-scrollbar bg-slate-50">
        {activeProject ? (
          <>
            <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-6">
                {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg text-[#004071] transition-colors"><Menu className="w-5 h-5" /></button>}
                <div className="overflow-hidden">
                  <h2 className="text-lg font-black text-[#004071] uppercase truncate max-w-md">
                    {activeApu ? activeApu.name : `ESTRUCTURA GENERAL: ${activeProject.name}`}
                  </h2>
                  <div className="flex items-center gap-3">
                    <p className="text-[9px] text-[#88C13E] font-black uppercase tracking-widest">{activeProject.name}</p>
                    {lastSaved && (
                      <span className="flex items-center gap-1 text-[8px] text-slate-400 font-bold uppercase bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                        <Clock className="w-2.5 h-2.5 mr-1" /> {new Date(lastSaved).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleManualSave}
                  disabled={saveStatus === 'saving'}
                  className="flex items-center gap-2 text-[8px] font-black px-4 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 uppercase tracking-widest transition-all"
                >
                  {saveStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : saveStatus === 'saved' ? <Check className="w-3 h-3 text-green-600" /> : <Save className="w-3 h-3" />}
                  {saveStatus === 'saved' ? 'Guardado' : 'Guardar Manual'}
                </button>
                <button
                  onClick={() => exportProjectToExcel(activeProject, chapters, apus)}
                  className="flex items-center gap-2 text-[8px] font-black text-white bg-green-600 px-4 py-2 rounded-xl shadow-lg hover:bg-green-700 uppercase tracking-widest transition-all"
                >
                  <Download className="w-3 h-3" /> Reporte Excel
                </button>
              </div>
            </header>

            <div className="p-8">
              {/* LÓGICA DEFENSIVA: Evita que el editor reciba datos incompletos */}
              {activeApu && activeChapter ? (
                <div key={activeApu.id}>
                  <APUEditor
                    apu={activeApu}
                    onUpdate={updateApu}
                    history={history}
                    project={activeProject}
                    chapter={activeChapter}
                    onRegisterResource={addHistoryItem}
                  />
                </div>
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
          <div className="h-full flex flex-col items-center justify-center gap-6 animate-in fade-in duration-700">
            <div className="p-8 bg-white rounded-full shadow-inner">
              <Database className="w-20 h-20 text-[#004071] opacity-10" />
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-black text-[#004071] uppercase tracking-tighter">Hidrogestión APU ENGINE</h1>
              <p className="text-slate-400 text-sm italic">Seleccione o cree un proyecto en la biblioteca lateral</p>
            </div>
            <button
              onClick={() => setIsProjectModalOpen(true)}
              className="bg-[#004071] text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-all shadow-xl"
            >
              Comenzar Nuevo Proyecto
            </button>
          </div>
        )}
      </main>

      {/* MODALES */}
      {isProjectModalOpen && (
        <ProjectModal
          initialData={editingProject || undefined}
          onClose={() => { setIsProjectModalOpen(false); setEditingProject(null); }}
          onSubmit={(data) => {
            const newId = safeUUID();
            setProjects([{ ...data, id: newId, createdAt: Date.now(), updatedAt: Date.now() }, ...projects]);
            loadProject(newId);
            setIsProjectModalOpen(false);
          }}
        />
      )}

      {chapterModalProjectId && (
        <ChapterModal
          onClose={() => setChapterModalProjectId(null)}
          onSubmit={(name) => {
            addChapter({ id: safeUUID(), projectId: activeProjectId!, code: '', name });
            setChapterModalProjectId(null);
          }}
        />
      )}

      {libraryChapterId && (
        <LibraryModal
          onClose={() => setLibraryChapterId(null)}
          projectApus={apus.filter(a => a.projectId === activeProjectId)}
          onSelect={(libApu) => {
            if (activeProjectId) {
              const proj = projects.find(p => p.id === activeProjectId);
              const nApu: APU = {
                ...JSON.parse(JSON.stringify(libApu)),
                id: safeUUID(),
                projectId: activeProjectId,
                chapterId: libraryChapterId,
                socialLawsPercentage: proj?.globalSocialLaws || 30,
                overheadPercentage: proj?.globalOverhead || 15,
                utilityPercentage: proj?.globalUtility || 10,
                createdAt: Date.now()
              };
              setApus([...apus, nApu]);
              setCurrentApuId(nApu.id);
            }
            setLibraryChapterId(null);
          }}
        />
      )}
    </div>
  );
};

export default App;