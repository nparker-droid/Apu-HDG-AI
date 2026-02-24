import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Menu, Save, Loader2, Download, Plus, Check, Clock, FileJson } from 'lucide-react';
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

  // Lógica de renumeración automática
  useEffect(() => {
    if (!activeProjectId) return;
    const currentProjectChapters = chapters.filter(c => c.projectId === activeProjectId);
    if (currentProjectChapters.length === 0) return;

    let needsUpdate = false;
    const renumberedChapters = chapters.map(ch => {
      if (ch.projectId !== activeProjectId) return ch;
      const newCode = (currentProjectChapters.indexOf(ch) + 1).toString();
      if (ch.code !== newCode) { needsUpdate = true; return { ...ch, code: newCode }; }
      return ch;
    });

    const renumberedApus = apus.map(apu => {
      if (apu.projectId !== activeProjectId) return apu;
      const parentChapter = renumberedChapters.find(c => c.id === apu.chapterId);
      if (!parentChapter) return apu;
      const siblings = apus.filter(a => a.chapterId === apu.chapterId).sort((a, b) => a.createdAt - b.createdAt);
      const apuIndex = siblings.indexOf(apu) + 1;
      const newCode = `${parentChapter.code}.${apuIndex}`;
      if (apu.code !== newCode) { needsUpdate = true; return { ...apu, code: newCode }; }
      return apu;
    });

    if (needsUpdate) {
      setChapters(renumberedChapters);
      setApus(renumberedApus);
    }
  }, [chapters.length, apus.length, activeProjectId]);

  // Autoguardado cada 60 segundos con indicador
  const saveRef = useRef(saveActiveProject);
  useEffect(() => { saveRef.current = saveActiveProject; }, [saveActiveProject]);

  useEffect(() => {
    if (!activeProjectId) return;
    const timer = setInterval(() => {
      const result = saveRef.current();
      if (result) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [activeProjectId]);

  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId), [projects, activeProjectId]);
  const activeApu = useMemo(() => apus.find(a => a.id === currentApuId), [apus, currentApuId]);
  const activeChapter = useMemo(() => chapters.find(c => c.id === activeApu?.chapterId), [chapters, activeApu]);

  // Manejador de Guardado Manual (Forzar persistencia y feedback)
  const handleManualSave = () => {
    setSaveStatus('saving');
    const result = saveActiveProject();
    setTimeout(() => {
      if (result) {
        setSaveStatus('saved');
        toast.success(`Guardado manual exitoso`, { icon: <Save className="w-4 h-4" /> });
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('idle');
        toast.error('Error al guardar localmente');
      }
    }, 500);
  };

  // Exportar Backup JSON (Opción manual adicional)
  const handleExportBackup = () => {
    if (!activeProject) return;
    const data = {
      project: activeProject,
      chapters: chapters.filter(c => c.projectId === activeProject.id),
      apus: apus.filter(a => a.projectId === activeProject.id)
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BACKUP_${activeProject.code}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    toast.info("Archivo de respaldo JSON generado");
  };

  return (
    <div className="flex h-screen bg-[#F1F5F9] overflow-hidden text-slate-800 font-sans">
      <Toaster position="top-right" richColors />
      <Sidebar
        isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen}
        projects={projects} chapters={chapters} apus={apus}
        moveChapter={moveChapter} deleteChapter={deleteChapter}
        currentProjectId={activeProjectId}
        setCurrentProjectId={(id) => { if (id) { loadProject(id); setCurrentApuId(null); } else setActiveProjectId(null); }}
        currentApuId={currentApuId} setCurrentApuId={setCurrentApuId}
        onNewProject={() => { setEditingProject(null); setIsProjectModalOpen(true); }}
        onEditProject={(p) => { setEditingProject(p); setIsProjectModalOpen(true); }}
        onNewChapter={() => activeProjectId && setChapterModalProjectId(activeProjectId)}
        onLibraryOpen={setLibraryChapterId}
        onCreateApu={(pid, cid, base) => {
            const newApu: APU = {
                id: safeUUID(), projectId: pid, chapterId: cid, code: '',
                name: base?.name || 'Nueva Partida', unit: base?.unit || 'GL', quantity: 1,
                items: base?.items || { [ItemCategory.MATERIAL]: [], [ItemCategory.MANO_DE_OBRA]: [], [ItemCategory.EQUIPO]: [], [ItemCategory.OTROS]: [] },
                useProjectGlobalRates: true, socialLawsPercentage: activeProject?.globalSocialLaws || 30,
                overheadPercentage: activeProject?.globalOverhead || 15, utilityPercentage: activeProject?.globalUtility || 10,
                createdAt: Date.now()
            };
            setApus([...apus, newApu]);
            setCurrentApuId(newApu.id);
        }}
        onDuplicateApu={(a) => { const dup = { ...JSON.parse(JSON.stringify(a)), id: safeUUID(), createdAt: Date.now() }; setApus([...apus, dup]); }}
        onDeleteApu={(id) => { deleteApu(id); if (currentApuId === id) setCurrentApuId(null); }}
        onShareProject={handleExportBackup}
        handleImport={() => {}}
        onDeleteProject={deleteProject}
        onDuplicateProject={duplicateProject}
      />

      <main className="flex-1 overflow-y-auto relative flex flex-col no-scrollbar">
        {activeProject ? (
          <>
            <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-6">
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 rounded-lg text-[#004071]"><Menu className="w-5 h-5" /></button>
                <div>
                  <h2 className="text-lg font-black text-[#004071] uppercase truncate max-w-md">{activeApu ? activeApu.name : `VISTA GENERAL: ${activeProject.name}`}</h2>
                  <div className="flex items-center gap-3">
                    <p className="text-[9px] text-[#88C13E] font-black uppercase tracking-widest">{activeProject.name}</p>
                    {lastSaved && (
                        <span className="flex items-center gap-1 text-[8px] text-slate-400 font-bold uppercase bg-slate-100 px-2 py-0.5 rounded-full">
                            <Clock className="w-2.5 h-2.5" /> Autoguardado: {new Date(lastSaved).toLocaleTimeString()}
                        </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleManualSave} disabled={saveStatus === 'saving'} className="flex items-center gap-2 text-[8px] font-black px-4 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 uppercase tracking-widest transition-all">
                  {saveStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : saveStatus === 'saved' ? <Check className="w-3 h-3 text-green-600" /> : <Save className="w-3 h-3" />} 
                  {saveStatus === 'saved' ? 'Sincronizado' : 'Guardar Local'}
                </button>
                <button onClick={() => exportProjectToExcel(activeProject, chapters, apus)} className="flex items-center gap-2 text-[8px] font-black text-white bg-green-600 px-4 py-2 rounded-xl shadow-lg hover:bg-green-700 uppercase tracking-widest transition-all">
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
          <div className="flex flex-col items-center justify-center min-h-screen text-center space-y-8">
             <h1 className="text-4xl font-black text-[#004071] uppercase">Hidrogestión APU ENGINE</h1>
             <button onClick={() => setIsProjectModalOpen(true)} className="bg-[#004071] text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Nuevo Proyecto</button>
          </div>
        )}
      </main>

      {isProjectModalOpen && <ProjectModal initialData={editingProject || undefined} onClose={() => setIsProjectModalOpen(false)} onSubmit={(data) => {
          const newId = safeUUID();
          const newP = { ...data, id: newId, createdAt: Date.now(), updatedAt: Date.now() };
          setProjects([newP, ...projects]);
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