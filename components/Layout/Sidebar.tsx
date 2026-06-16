import React, { useState } from 'react';
import { Plus, X, ChevronRight, BookOpen, Trash2, Upload, Share2, ChevronUp, ChevronDown, Copy, Edit3, FileText, Table } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Project, Chapter, APU } from '../../types';
import { exportProjectToPDF, exportBudgetToPDF } from '../../services/exportService';
import ConfirmationModal from '../ui/ConfirmationModal';

const HidrogestionCorporateLogo = ({ size = "w-10 h-10" }: { size?: string }) => (
    <div className="flex items-center justify-center">
        <svg viewBox="0 0 100 100" className={`${size} flex-shrink-0 shadow-inner rounded-full`}>
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
);

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    projects: Project[];
    chapters: Chapter[];
    apus: APU[];
    moveChapter: (id: string, dir: 'up' | 'down') => void;
    deleteChapter: (id: string) => void;
    currentProjectId: string | null;
    setCurrentProjectId: (id: string | null) => void;
    currentApuId: string | null;
    setCurrentApuId: (id: string | null) => void;
    onNewProject: () => void;
    onUserLibraryOpen: () => void;
    onEditProject: (project: Project) => void;
    onNewChapter: (projectId: string) => void;
    onLibraryOpen: (chapterId: string) => void;
    onCreateApu: (projectId: string, chapterId: string) => void;
    onDuplicateApu: (apu: any) => void;
    onDeleteApu: (apuId: string) => void;
    onShareProject: (project: Project) => void;
    handleImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onDeleteProject: (id: string) => void;
    onDuplicateProject: (id: string) => void;
    moveApu: (id: string, dir: 'up' | 'down') => void;
    onRenameChapter: (id: string, name: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    isOpen, setIsOpen,
    projects, chapters, apus, moveChapter, deleteChapter,
    currentProjectId, setCurrentProjectId,
    currentApuId, setCurrentApuId,
    onNewProject, onUserLibraryOpen, onEditProject, onNewChapter,
    onLibraryOpen, onCreateApu, onDuplicateApu, onDeleteApu,
    onShareProject, handleImport,
    onDeleteProject, onDuplicateProject,
    moveApu, onRenameChapter
}) => {
    const activeProject = projects.find(p => p.id === currentProjectId);

    const [confirmDelete, setConfirmDelete] = useState<{
        type: 'project' | 'chapter' | 'apu';
        id: string;
        name: string;
    } | null>(null);
    const [chapterActionMenu, setChapterActionMenu] = useState<{ projectId: string; chapterId: string } | null>(null);
    const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
    const [editingChapterName, setEditingChapterName] = useState('');

    const handleConfirmAction = () => {
        if (!confirmDelete) return;

        switch (confirmDelete.type) {
            case 'project':
                onDeleteProject(confirmDelete.id);
                break;
            case 'chapter':
                deleteChapter(confirmDelete.id);
                break;
            case 'apu':
                onDeleteApu(confirmDelete.id);
                break;
        }
        setConfirmDelete(null);
    };

    return (
        <aside className={cn(
            "bg-white border-r border-slate-200 transition-all duration-300 flex flex-col shadow-2xl z-20 h-screen overflow-hidden",
            isOpen ? 'w-80' : 'w-0 border-none'
        )}>
            <div className="p-6 border-b flex items-center justify-between bg-white sticky top-0 z-10 whitespace-nowrap">
                <div className="flex items-center gap-3">
                    <HidrogestionCorporateLogo size="w-9 h-9" />
                    <div className="flex flex-col leading-none">
                        <span className="text-[11px] font-black text-[#004071] uppercase tracking-tighter">APU Engine</span>
                        <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Gestión de Costos</span>
                    </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg text-[#004071]">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="p-4 grid grid-cols-2 gap-3 min-w-[20rem]">
                <button onClick={onUserLibraryOpen} className="col-span-2 flex items-center justify-center gap-2 bg-[#88C13E] hover:bg-[#76aa34] text-white font-black py-4 rounded-2xl shadow-xl transition-all uppercase tracking-widest text-[9px]">
                    <BookOpen className="w-4 h-4" /> Biblioteca del Usuario
                </button>
                <button onClick={onNewProject} className="col-span-2 flex items-center justify-center gap-2 bg-[#004071] hover:bg-[#002D50] text-white font-black py-4 rounded-2xl shadow-xl transition-all uppercase tracking-widest text-[9px]">
                    <Plus className="w-4 h-4" /> Nuevo Proyecto
                </button>
                <label className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-3 rounded-2xl cursor-pointer transition-all uppercase tracking-widest text-[8px]">
                    <Upload className="w-3 h-3" /> Importar
                    <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                </label>
                <button
                    disabled={!activeProject}
                    onClick={() => activeProject && onShareProject(activeProject)}
                    className="flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-black py-3 rounded-2xl transition-all uppercase tracking-widest text-[8px] disabled:opacity-50"
                >
                    <Share2 className="w-3 h-3" /> Exportar
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-10 space-y-4 no-scrollbar relative text-slate-600 min-w-[20rem]">
                <div className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em] px-2 mb-2">Biblioteca de Proyectos</div>
                {projects.map(project => (
                    <div key={project.id} className="group/project space-y-1">
                        <div
                            onClick={() => setCurrentProjectId(project.id)}
                            className={cn(
                                "flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all",
                                currentProjectId === project.id ? 'bg-[#004071] text-white shadow-lg' : 'hover:bg-slate-50 text-slate-600'
                            )}
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentProjectId(project.id === currentProjectId ? null : project.id);
                                    }}
                                    className="p-0.5"
                                    title="Expandir o contraer proyecto"
                                >
                                    <ChevronRight className={cn("w-4 h-4 transition-transform", currentProjectId === project.id && 'rotate-90 text-[#D9E021]')} />
                                </button>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-[10px] font-black uppercase tracking-tighter whitespace-normal break-words leading-tight">{project.name}</span>
                                    <span className="text-[7px] font-bold opacity-60 uppercase">{project.code}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover/project:opacity-100 transition-opacity">
                                <button onClick={(e) => { e.stopPropagation(); onEditProject(project); }} title="Renombrar/Editar" className="p-1 hover:text-[#D9E021]"><Edit3 className="w-3 h-3" /></button>
                                <button onClick={(e) => { e.stopPropagation(); onDuplicateProject(project.id); }} title="Duplicar" className="p-1 hover:text-[#D9E021]"><Copy className="w-3 h-3" /></button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDelete({ type: 'project', id: project.id, name: project.name });
                                    }}
                                    title="Eliminar Proyecto"
                                    className="p-1 hover:text-red-400"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        </div>

                        {currentProjectId === project.id && (
                            <div className="ml-5 pl-3 border-l-2 border-[#88C13E]/30 space-y-4 py-2 animate-in slide-in-from-left-2">
                                <div className="grid grid-cols-2 gap-1 px-1">
                                    <button onClick={() => exportProjectToPDF(project, chapters, apus)} className="bg-slate-800 text-white text-[8px] font-black p-2 rounded-lg flex items-center justify-center gap-1 uppercase hover:bg-black transition-all"><FileText className="w-3 h-3" /> APUs PDF</button>
                                    <button onClick={() => exportBudgetToPDF(project, chapters, apus)} className="bg-indigo-600 text-white text-[8px] font-black p-2 rounded-lg flex items-center justify-center gap-1 uppercase hover:bg-indigo-800 transition-all"><Table className="w-3 h-3" /> Pres. PDF</button>
                                </div>

                                {chapters.filter(c => c.projectId === project.id).map(chapter => (
                                    <div key={chapter.id} className="space-y-1 relative">
                                        <div className="flex flex-col p-2 bg-white border border-slate-100 rounded-xl space-y-2 group/chapter">
                                            <div className="flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                {editingChapterId === chapter.id ? (
                                                    <input
                                                        autoFocus
                                                        value={editingChapterName}
                                                        onChange={e => setEditingChapterName(e.target.value)}
                                                        onBlur={() => {
                                                            if (editingChapterName.trim()) onRenameChapter(chapter.id, editingChapterName.trim());
                                                            setEditingChapterId(null);
                                                        }}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') { if (editingChapterName.trim()) onRenameChapter(chapter.id, editingChapterName.trim()); setEditingChapterId(null); }
                                                            if (e.key === 'Escape') setEditingChapterId(null);
                                                        }}
                                                        className="flex-1 text-[9px] font-black text-slate-600 bg-slate-50 border border-[#004071] rounded px-1.5 py-0.5 outline-none uppercase tracking-widest min-w-0"
                                                    />
                                                ) : (
                                                    <span className="truncate pr-1 flex-1">{chapter.code}. {chapter.name}</span>
                                                )}
                                                <div className="flex items-center gap-1 opacity-0 group-hover/chapter:opacity-100 transition-opacity shrink-0">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setEditingChapterId(chapter.id); setEditingChapterName(chapter.name); }}
                                                        className="text-slate-300 hover:text-[#004071] p-0.5"
                                                        title="Renombrar capítulo"
                                                    >
                                                        <Edit3 className="w-3 h-3" />
                                                    </button>
                                                    <button onClick={() => moveChapter(chapter.id, 'up')} className="text-slate-300 hover:text-[#004071] p-0.5"><ChevronUp className="w-3 h-3" /></button>
                                                    <button onClick={() => moveChapter(chapter.id, 'down')} className="text-slate-300 hover:text-[#004071] p-0.5"><ChevronDown className="w-3 h-3" /></button>
                                                    <button
                                                        onClick={() => setChapterActionMenu(prev => prev?.chapterId === chapter.id ? null : { projectId: project.id, chapterId: chapter.id })}
                                                        className="text-[#004071] hover:text-[#88C13E] p-0.5"
                                                        title="Agregar partida"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setConfirmDelete({ type: 'chapter', id: chapter.id, name: chapter.name });
                                                        }}
                                                        className="text-slate-200 hover:text-red-500 p-0.5"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        {chapterActionMenu?.chapterId === chapter.id && (
                                            <div className="absolute right-3 top-8 z-30 w-44 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 animate-in fade-in zoom-in-95">
                                                <button
                                                    onClick={() => {
                                                        onCreateApu(chapterActionMenu.projectId, chapterActionMenu.chapterId);
                                                        setChapterActionMenu(null);
                                                    }}
                                                    className="w-full text-left px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest text-[#004071] hover:bg-slate-50"
                                                >
                                                    APU nuevo
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        onLibraryOpen(chapterActionMenu.chapterId);
                                                        setChapterActionMenu(null);
                                                    }}
                                                    className="w-full text-left px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest text-[#88C13E] hover:bg-slate-50"
                                                >
                                                    Desde biblioteca
                                                </button>
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            {apus.filter(a => a.chapterId === chapter.id).map(apu => (
                                                <div
                                                    key={apu.id}
                                                    onClick={() => setCurrentApuId(apu.id)}
                                                    className={cn(
                                                        "group/apu relative p-3 rounded-xl cursor-pointer text-[9px] flex justify-between items-center transition-all",
                                                        currentApuId === apu.id ? 'bg-[#88C13E] text-white shadow-md scale-[1.02]' : 'hover:bg-indigo-50 text-slate-500'
                                                    )}
                                                >
                                                    <span className="pr-2 font-bold whitespace-normal break-words leading-tight">{apu.code} {apu.name}</span>
                                                    <div className="flex gap-1 opacity-0 group-hover/apu:opacity-100 transition-opacity items-center">
                                                        <div className="flex flex-col mr-1">
                                                            <button onClick={(e) => { e.stopPropagation(); moveApu(apu.id, 'up'); }} className="hover:text-white p-0.5"><ChevronUp className="w-2.5 h-2.5" /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); moveApu(apu.id, 'down'); }} className="hover:text-white p-0.5"><ChevronDown className="w-2.5 h-2.5" /></button>
                                                        </div>
                                                        <button onClick={(e) => { e.stopPropagation(); onDuplicateApu(apu); }} className="p-1 hover:text-[#004071]"><Copy className="w-3 h-3" /></button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setConfirmDelete({ type: 'apu', id: apu.id, name: apu.name });
                                                            }}
                                                            className="p-1 hover:text-red-600"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                <button onClick={() => onNewChapter(project.id)} className="w-full text-left p-2.5 text-[10px] text-[#004071] hover:bg-[#004071] hover:text-white rounded-xl flex items-center gap-2 font-black uppercase tracking-widest transition-all shadow-sm border border-dashed border-[#004071]/20"><Plus className="w-3 h-3" /> Añadir Capítulo</button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <ConfirmationModal
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleConfirmAction}
                itemName={confirmDelete?.name || ""}
                message={`¿Desea eliminar definitivamente?`}
            />
        </aside>
    );
};

export default Sidebar;