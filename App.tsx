
import React, { useState, useMemo, useEffect } from 'react';
import { Menu, Save, Loader2, Download, Plus, Check, Clock, Database } from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import Sidebar from './components/Layout/Sidebar';
import APUEditor from './components/APUEditor';
import ProjectModal from './components/ProjectModal';
import ChapterModal from './components/ChapterModal';
import LibraryModal from './components/LibraryModal';
import ProjectGeneralView from './components/ProjectGeneralView';
import { exportSingleApuPDF, exportProjectToPDF, exportBudgetToPDF } from './services/exportService';
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

  // Lógica de Autoguardado cada 60 segundos
  useEffect(() => {
    if (!activeProjectId) return;

    const timer = setInterval(() => {
      console.log("Ejecutando autoguardado...");
      const result = saveActiveProject();
      if (result) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    }, 60000); // 60000 ms = 1 minuto

    return () => clearInterval(timer);
  }, [activeProjectId, chapters, apus, projects, saveActiveProject]);

  const renumberApus = (allApus: APU[], allChapters: Chapter[]) => {
    return allApus.map(apu => {
      const chapter = allChapters.find(c => c.id === apu.chapterId);
      if (!chapter) return apu;
      const chapterApus = allApus
        .filter(a => a.chapterId === apu.chapterId)
        .sort((a, b) => a.createdAt - b.createdAt);
      const index = chapterApus.findIndex(a => a.id === apu.id);
      return { ...apu, code: `${chapter.code}.${index + 1}` };
    });
  };

  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId), [projects, activeProjectId]);
  const activeApu = useMemo(() => apus.find(a => a.id === currentApuId), [apus, currentApuId]);
  const activeChapter = useMemo(() => chapters.find(c => c.id === activeApu?.chapterId), [chapters, activeApu]);

  const currentProjectApus = useMemo(() => {
    if (!activeProjectId) return [];
    return apus.filter(a => a.projectId === activeProjectId);
  }, [apus, activeProjectId]);

  const handleManualSave = () => {
    setSaveStatus('saving');
    // Simular un pequeño delay para feedback visual
    setTimeout(() => {
      const result = saveActiveProject();
      if (result) {
        setSaveStatus('saved');
        const time = new Date(result).toLocaleTimeString();
        toast.success(`Proyecto guardado en Local Storage a las ${time}`, {
          description: 'Los datos están persistidos en el almacenamiento del navegador.',
        });
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('idle');
        toast.error('Error al guardar el proyecto');
      }
    }, 400);
  };

  const handleShareProject = (project: Project) => {
    const exportData = {
      project,
      chapters: chapters.filter(c => c.projectId === project.id),
      apus: apus.filter(a => a.projectId === project.id),
      exportVersion: "2.0",
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HDG_Backup_${project.code}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Backup generado correctamente');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.project || !data.chapters || !data.apus) throw new Error("Inválido");
        
        const newProjectId = safeUUID();
        const timestamp = Date.now();
        const newProject = { ...data.project, id: newProjectId, createdAt: timestamp, updatedAt: timestamp };
        
        const newChapters = data.chapters.map((c: any) => ({ ...c, id: safeUUID(), projectId: newProjectId, oldId: c.id }));
        const newApus = data.apus.map((a: any) => {
          const chapter = newChapters.find((nc: any) => nc.oldId === a.chapterId);
          return { ...a, id: safeUUID(), projectId: newProjectId, chapterId: chapter?.id || a.chapterId };
        });

        // Guardar físicamente
        const physicalData = { metadata: newProject, chapters: newChapters, apus: newApus };
        localStorage.setItem(`apu_engine_project_${newProjectId}`, JSON.stringify(physicalData));
        
        setProjects([newProject, ...projects]);
        loadProject(newProjectId);
        toast.success(`Proyecto "${newProject.name}" importado con éxito`);
      } catch (err) { 
        toast.error("Error al importar el archivo JSON"); 
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleProjectSubmit = (data: any) => {
    if (editingProject) {
      const updatedMeta = { ...editingProject, ...data, updatedAt: Date.now() };
      setProjects(projects.map(p => p.id === editingProject.id ? updatedMeta : p));
      setEditingProject(null);
      toast.success('Metadatos del proyecto actualizados');
    } else {
      const newId = safeUUID();
      const timestamp = Date.now();
      const newProject: Project = { ...data, id: newId, createdAt: timestamp, updatedAt: timestamp };
      
      // Guardar inicial vacío
      const physicalData = { metadata: newProject, chapters: [], apus: [] };
      localStorage.setItem(`apu_engine_project_${newId}`, JSON.stringify(physicalData));
      
      setProjects([newProject, ...projects]);
      loadProject(newId);
      toast.success('Nuevo proyecto creado en la biblioteca');
    }
    setIsProjectModalOpen(false);
  };

  const handleCreateChapter = (name: string) => {
    if (!activeProjectId) return;
    const projectChapters = chapters.filter(c => c.projectId === activeProjectId);
    const newChapter = {
      id: safeUUID(),
      projectId: activeProjectId,
      code: (projectChapters.length + 1).toString(),
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
      name: baseApu?.name || '', 
      unit: baseApu?.unit || 'GL', 
      quantity: 1,
      items: baseApu?.items ? JSON.parse(JSON.stringify(baseApu.items)) : { 
        [ItemCategory.MATERIAL]: [], 
        [ItemCategory.MANO_DE_OBRA]: [], 
        [ItemCategory.EQUIPO]: [], 
        [ItemCategory.OTROS]: [] 
      },
      useProjectGlobalRates: true, 
      socialLawsPercentage: proj?.globalSocialLaws || 30, 
      overheadPercentage: proj?.globalOverhead || 15, 
      utilityPercentage: proj?.globalUtility || 10,
      createdAt: Date.now(),
    };

    const updatedApus = renumberApus([...apus, newApu], chapters);
    setApus(updatedApus);
    setCurrentApuId(newApu.id);
    setLibraryChapterId(null);
    toast.success('Nueva partida añadida al capítulo');
  };

  const handleDuplicateApu = (apu: APU) => {
    const duplicated: APU = { ...JSON.parse(JSON.stringify(apu)), id: safeUUID(), createdAt: Date.now() };
    const updated = renumberApus([...apus, duplicated], chapters);
    setApus(updated);
    toast.info('Partida duplicada');
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
          if (id) {
            loadProject(id);
            setCurrentApuId(null); // Navega a la vista General al seleccionar proyecto
          }
          else setActiveProjectId(null);
        }}
        currentApuId={currentApuId}
        setCurrentApuId={setCurrentApuId}
        onNewProject={() => { setEditingProject(null); setIsProjectModalOpen(true); }}
        onEditProject={(p) => { setEditingProject(p); setIsProjectModalOpen(true); }}
        onNewChapter={() => activeProjectId && setChapterModalProjectId(activeProjectId)}
        onLibraryOpen={(cid) => setLibraryChapterId(cid)}
        onCreateApu={createNewApu}
        onDuplicateApu={handleDuplicateApu}
        onDeleteApu={(id) => {
          deleteApu(id);
          if (currentApuId === id) setCurrentApuId(null);
          toast.info('Partida eliminada');
        }}
        onShareProject={handleShareProject}
        handleImport={handleImport}
        onDeleteProject={(id) => {
          deleteProject(id);
          if (activeProjectId === id) {
            setActiveProjectId(null);
            setCurrentApuId(null);
          }
          toast.error('Proyecto eliminado de la biblioteca');
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
                {!isSidebarOpen && (
                  <button 
                    onClick={() => setIsSidebarOpen(true)} 
                    className="p-2 hover:bg-slate-100 rounded-lg text-[#004071]"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <h2 className="text-lg font-black text-[#004071] tracking-tight uppercase truncate max-w-md">
                    {activeApu ? activeApu.name : `VISTA GENERAL: ${activeProject.name}`}
                  </h2>
                  <div className="flex items-center gap-3 mt-0.5">
                    <p className="text-[9px] text-[#88C13E] font-black uppercase tracking-widest">{activeProject.name} • {activeProject.code}</p>
                    {lastSaved && (
                      <span className="flex items-center gap-1 text-[8px] text-slate-400 font-bold uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-full">
                        <Clock className="w-2.5 h-2.5" /> Último guardado: {new Date(lastSaved).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleManualSave} 
                  disabled={saveStatus === 'saving'}
                  className="flex items-center gap-2 text-[8px] font-black px-4 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all uppercase tracking-widest disabled:opacity-50"
                >
                  {saveStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : saveStatus === 'saved' ? <Check className="w-3 h-3 text-green-600" /> : <Save className="w-3 h-3" />} 
                  {saveStatus === 'saved' ? 'Guardado' : 'Guardar Cambios'}
                </button>
                <button 
                  onClick={() => exportProjectToExcel(activeProject, chapters, apus)}
                  className="flex items-center gap-2 text-[8px] font-black text-white bg-green-600 px-4 py-2 rounded-xl shadow-lg hover:bg-green-700 transition-all uppercase tracking-widest"
                >
                  <Download className="w-3 h-3" /> Reporte Excel
                </button>
              </div>
            </header>
            <div className="p-8">
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
          <div className="flex flex-col items-center justify-center min-h-screen text-center max-w-xl mx-auto space-y-12 animate-in fade-in duration-500">
             {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)} 
                className="fixed top-4 left-4 p-3 bg-white shadow-lg rounded-xl text-[#004071] hover:scale-105 transition-all z-50 border border-slate-100"
              >
                <Menu className="w-6 h-6" />
              </button>
            )}
            <div className="flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-40 h-40 shadow-inner rounded-full">
                <circle cx="50" cy="50" r="48" fill="white" />
                <mask id="m"> <circle cx="50" cy="50" r="48" fill="white" /> </mask>
                <g mask="url(#m)">
                  <rect x="0" y="0" width="100" height="25" fill="#D9E021" />
                  <rect x="0" y="25" width="100" height="20" fill="#88C13E" />
                  <rect x="0" y="45" width="100" height="20" fill="#004071" />
                  <rect x="0" y="65" width="100" height="35" fill="#002D50" />
                </g>
              </svg>
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl font-black text-[#004071] tracking-tighter uppercase leading-none">Hidrogestión APU ENGINE</h1>
              <p className="text-slate-400 text-xs italic font-medium">Gestiona tu Biblioteca de Proyectos desde el panel lateral.</p>
              <div className="flex justify-center gap-4 pt-4">
                <button onClick={() => { setEditingProject(null); setIsProjectModalOpen(true); }} className="bg-[#004071] text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:scale-105 transition-all">Nuevo Proyecto</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {isProjectModalOpen && <ProjectModal initialData={editingProject || undefined} onClose={() => { setIsProjectModalOpen(false); setEditingProject(null); }} onSubmit={handleProjectSubmit} />}
      {chapterModalProjectId && <ChapterModal onClose={() => setChapterModalProjectId(null)} onSubmit={handleCreateChapter} />}
      {libraryChapterId && (
        <LibraryModal
          onClose={() => setLibraryChapterId(null)}
          projectApus={currentProjectApus}
          onSelect={(libApu) => { if (activeProject) createNewApu(activeProject.id, libraryChapterId, libApu); }}
        />
      )}
    </div>
  );
};

export default App;
