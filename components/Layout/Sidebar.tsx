import React, { useMemo, useState } from 'react';
import { getZeroCostInfo } from '../../lib/apuCalculations';
import { Plus, X, ChevronRight, Search, Trash2, ChevronUp, ChevronDown, Copy, Edit3, GripVertical } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Project, Chapter, APU } from '../../types';
import { formatMonthYear } from '../../lib/date';
import { getRootChapters, getSubchapters } from '../../lib/chapters';
import ConfirmationModal from '../ui/ConfirmationModal';

const normKey = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

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
    reorderProject: (projectId: string, beforeProjectId: string | null) => void;
    reorderChapter: (chapterId: string, beforeChapterId: string | null) => void;
    deleteChapter: (id: string) => void;
    currentProjectId: string | null;
    setCurrentProjectId: (id: string | null) => void;
    currentApuId: string | null;
    setCurrentApuId: (id: string | null) => void;
    onNewProject: () => void;
    onEditProject: (project: Project) => void;
    onNewChapter: (projectId: string) => void;
    onNewSubchapter: (projectId: string, parentChapterId: string) => void;
    onLibraryOpen: (chapterId: string) => void;
    onCreateApu: (projectId: string, chapterId: string) => void;
    onDuplicateApu: (apu: any) => void;
    onDeleteApu: (apuId: string) => void;
    onDeleteProject: (id: string) => void;
    onDuplicateProject: (id: string) => void;
    moveApu: (id: string, dir: 'up' | 'down') => void;
    moveApuToChapter: (apuId: string, toChapterId: string, beforeApuId: string | null) => void;
    onRenameChapter: (id: string, name: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    isOpen, setIsOpen,
    projects, chapters, apus, reorderProject, reorderChapter, deleteChapter,
    currentProjectId, setCurrentProjectId,
    currentApuId, setCurrentApuId,
    onNewProject, onEditProject, onNewChapter, onNewSubchapter,
    onLibraryOpen, onCreateApu, onDuplicateApu, onDeleteApu,
    onDeleteProject, onDuplicateProject,
    moveApu, moveApuToChapter, onRenameChapter
}) => {
    const [search, setSearch] = useState('');
    const term = normKey(search);
    const matchesText = (s: string | undefined) => !term || normKey(s || '').includes(term);

    const chapterMatchesSearch = (chapter: Chapter): boolean =>
        matchesText(chapter.name) ||
        apus.some(a => a.chapterId === chapter.id && (matchesText(a.name) || matchesText(a.code))) ||
        (!chapter.parentChapterId && getSubchapters(chapters, chapter.id).some(sub => chapterMatchesSearch(sub)));

    const visibleProjects = useMemo(() => projects.filter(project =>
        !term ||
        matchesText(project.name) || matchesText(project.code) ||
        chapters.some(c => c.projectId === project.id && chapterMatchesSearch(c))
    ), [projects, chapters, apus, term]);

    const [confirmDelete, setConfirmDelete] = useState<{
        type: 'project' | 'chapter' | 'apu';
        id: string;
        name: string;
    } | null>(null);
    const [chapterActionMenu, setChapterActionMenu] = useState<{ projectId: string; chapterId: string } | null>(null);
    const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
    const [editingChapterName, setEditingChapterName] = useState('');
    const [draggedApuId, setDraggedApuId] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState<{ chapterId: string; apuId: string | null } | null>(null);
    const [draggedChapterId, setDraggedChapterId] = useState<string | null>(null);
    const [dragOverChapterId, setDragOverChapterId] = useState<string | null>(null);
    const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});
    const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
    const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);

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

    const renderChapterBlock = (project: Project, chapter: Chapter, isSubchapter: boolean, extraContent?: React.ReactNode) => {
        const chapterApus = apus.filter(a => a.chapterId === chapter.id && (!term || matchesText(a.name) || matchesText(a.code)));
        return (
            <div key={chapter.id} className={cn("space-y-1 relative", isSubchapter && "ml-4 pl-2 border-l-2 border-brand-blue/10")}>
                {dragOverChapterId === chapter.id && draggedChapterId !== null && draggedChapterId !== chapter.id && (
                    <div className="h-0.5 bg-brand-blue rounded-full mx-1 mb-1" />
                )}
                <div
                    draggable
                    onDragStart={(e) => { setDraggedChapterId(chapter.id); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragEnd={() => { setDraggedChapterId(null); setDragOverChapterId(null); }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (draggedChapterId && draggedChapterId !== chapter.id) setDragOverChapterId(chapter.id); }}
                    onDrop={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        if (draggedChapterId && draggedChapterId !== chapter.id) reorderChapter(draggedChapterId, chapter.id);
                        setDraggedChapterId(null); setDragOverChapterId(null);
                    }}
                    className={cn(
                        "flex flex-col p-2 rounded-xl space-y-2 group/chapter select-none transition-opacity",
                        isSubchapter ? "bg-brand-blue/[0.03] border border-brand-blue/10" : "bg-brand-blue/[0.06] border border-brand-blue/15",
                        draggedChapterId === chapter.id ? 'opacity-30 cursor-grabbing' : 'cursor-grab'
                    )}
                >
                    <div className="flex items-center justify-between text-[9px] font-bold text-brand-blue uppercase tracking-widest">
                        <button
                            onClick={(e) => { e.stopPropagation(); setCollapsedChapters(prev => ({ ...prev, [chapter.id]: !prev[chapter.id] })); }}
                            className="p-0.5 shrink-0 text-brand-blue/50 hover:text-brand-blue"
                            title={collapsedChapters[chapter.id] ? 'Expandir capítulo' : 'Contraer capítulo'}
                        >
                            <ChevronRight className={cn("w-3 h-3 transition-transform", !collapsedChapters[chapter.id] && 'rotate-90')} />
                        </button>
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
                                className="flex-1 text-[9px] font-bold text-muted-dark bg-sidebar border border-brand-blue rounded px-1.5 py-0.5 outline-none uppercase tracking-widest min-w-0"
                            />
                        ) : (
                            <span className="truncate pr-1 flex-1">{chapter.code}. {chapter.name}</span>
                        )}
                        <div className="flex items-center gap-1 opacity-0 group-hover/chapter:opacity-100 transition-opacity shrink-0">
                            <button
                                onClick={(e) => { e.stopPropagation(); setEditingChapterId(chapter.id); setEditingChapterName(chapter.name); }}
                                className="text-muted-light hover:text-brand-blue p-0.5"
                                title="Renombrar capítulo"
                            >
                                <Edit3 className="w-3 h-3" />
                            </button>
                            <GripVertical className="w-3 h-3 text-brand-blue/30" title="Arrastrar para reordenar" />
                            <button
                                onClick={() => setChapterActionMenu(prev => prev?.chapterId === chapter.id ? null : { projectId: project.id, chapterId: chapter.id })}
                                className="text-brand-blue hover:text-brand-green p-0.5"
                                title="Agregar partida"
                            >
                                <Plus className="w-3 h-3" />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDelete({ type: 'chapter', id: chapter.id, name: chapter.name });
                                }}
                                className="text-muted-light hover:text-status-red p-0.5"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                </div>
                {chapterActionMenu?.chapterId === chapter.id && (
                    <div className="absolute right-3 top-8 z-30 w-44 bg-white border border-border rounded-xl shadow-sm p-1.5 animate-in fade-in zoom-in-95">
                        <button
                            onClick={() => {
                                onCreateApu(chapterActionMenu.projectId, chapterActionMenu.chapterId);
                                setChapterActionMenu(null);
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest text-brand-blue hover:bg-sidebar"
                        >
                            APU nuevo
                        </button>
                        <button
                            onClick={() => {
                                onLibraryOpen(chapterActionMenu.chapterId);
                                setChapterActionMenu(null);
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest text-brand-green hover:bg-sidebar"
                        >
                            Desde biblioteca
                        </button>
                        {!isSubchapter && (
                            <button
                                onClick={() => {
                                    onNewSubchapter(chapterActionMenu.projectId, chapterActionMenu.chapterId);
                                    setChapterActionMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest text-muted-dark hover:bg-sidebar"
                            >
                                + Subcapítulo
                            </button>
                        )}
                    </div>
                )}
                {extraContent}
                <div
                    className="space-y-0.5"
                    onDragOver={(e) => { e.preventDefault(); setDragOver({ chapterId: chapter.id, apuId: null }); }}
                    onDrop={(e) => { e.preventDefault(); if (draggedApuId) { moveApuToChapter(draggedApuId, chapter.id, null); setDraggedApuId(null); setDragOver(null); } }}
                >
                    {collapsedChapters[chapter.id] && chapterApus.length > 0 && (
                        <div className="px-2 py-1.5 text-[8px] font-semibold text-muted-light italic">
                            {chapterApus.length} partida(s) — contraído
                        </div>
                    )}
                    {!collapsedChapters[chapter.id] && chapterApus.map(apu => (
                        <div key={apu.id}>
                            {dragOver?.chapterId === chapter.id && dragOver?.apuId === apu.id && draggedApuId !== apu.id && (
                                <div className="h-0.5 bg-brand-blue rounded-full mx-1 my-0.5" />
                            )}
                            <div
                                draggable
                                onDragStart={(e) => { e.stopPropagation(); setDraggedApuId(apu.id); e.dataTransfer.effectAllowed = 'move'; }}
                                onDragEnd={() => { setDraggedApuId(null); setDragOver(null); }}
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (draggedApuId !== apu.id) setDragOver({ chapterId: chapter.id, apuId: apu.id }); }}
                                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (draggedApuId && draggedApuId !== apu.id) { moveApuToChapter(draggedApuId, chapter.id, apu.id); setDraggedApuId(null); setDragOver(null); } }}
                                onClick={() => setCurrentApuId(apu.id)}
                                className={cn(
                                    "group/apu relative p-3 rounded-xl text-[9px] flex justify-between items-center transition-all select-none",
                                    draggedApuId === apu.id ? 'opacity-30 cursor-grabbing' : 'cursor-grab',
                                    currentApuId === apu.id ? 'bg-brand-green text-white' : 'hover:bg-sidebar text-muted-dark'
                                )}
                            >
                                <span className="pr-2 font-semibold whitespace-normal break-words leading-tight">
                                    {(() => { const pr = projects.find(p => p.id === apu.projectId); return pr && getZeroCostInfo(apu, pr).isZero ? <span title="Costos en $0 — falta completar" className="inline-block w-1.5 h-1.5 rounded-full bg-status-red mr-1.5 align-middle" /> : null; })()}
                                    {apu.flagged && <span title="Partida marcada" className="inline-block w-1.5 h-1.5 rounded-full bg-status-amber mr-1.5 align-middle" />}
                                    {apu.code} {apu.name}</span>
                                <div className="flex gap-1 opacity-0 group-hover/apu:opacity-100 transition-opacity items-center">
                                    <div className="flex flex-col mr-1">
                                        <button onClick={(e) => { e.stopPropagation(); moveApu(apu.id, 'up'); }} className="hover:text-white p-0.5"><ChevronUp className="w-2.5 h-2.5" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); moveApu(apu.id, 'down'); }} className="hover:text-white p-0.5"><ChevronDown className="w-2.5 h-2.5" /></button>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); onDuplicateApu(apu); }} className="p-1 hover:text-brand-blue"><Copy className="w-3 h-3" /></button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setConfirmDelete({ type: 'apu', id: apu.id, name: apu.name });
                                        }}
                                        className="p-1 hover:text-status-red"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {dragOver?.chapterId === chapter.id && dragOver?.apuId === null && draggedApuId !== null && (
                        <div className="h-0.5 bg-brand-blue rounded-full mx-1 my-0.5" />
                    )}
                </div>
            </div>
        );
    };

    return (
        <aside className={cn(
            "bg-white border-r border-border transition-all duration-300 flex flex-col z-20 h-screen overflow-hidden",
            isOpen ? 'w-80' : 'w-0 border-none'
        )}>
            <div className="p-6 border-b border-border flex items-center justify-between bg-white sticky top-0 z-10 whitespace-nowrap">
                <div className="flex items-center gap-3">
                    <HidrogestionCorporateLogo size="w-9 h-9" />
                    <div className="flex flex-col leading-none">
                        <span className="text-[11px] font-bold text-brand-blue uppercase tracking-tighter">APU Engine</span>
                        <span className="text-[7px] font-semibold text-muted uppercase tracking-widest mt-0.5">Gestión de Costos</span>
                    </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-sidebar rounded-lg text-muted-dark">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="px-4 pt-4 min-w-[20rem]">
                <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-light" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar proyecto o partida…"
                        className="w-full pl-8 pr-3 py-2 bg-sidebar border border-border rounded-lg text-xs text-ink outline-none focus:border-brand-blue"
                    />
                </div>
            </div>

            <div className="p-4 min-w-[20rem]">
                <button onClick={onNewProject} className="w-full flex items-center justify-center gap-2 bg-brand-blue hover:bg-brand-blue-dark text-white font-bold py-4 rounded-2xl transition-all uppercase tracking-widest text-[9px]">
                    <Plus className="w-4 h-4" /> Nuevo Proyecto
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-10 space-y-4 no-scrollbar relative text-muted-dark min-w-[20rem]">
                <div className="text-[8px] font-bold uppercase text-muted tracking-[0.2em] px-2 mb-2">Biblioteca de Proyectos</div>
                {term && visibleProjects.length === 0 && (
                    <p className="text-center text-[10px] text-muted italic py-6">Sin resultados para "{search}"</p>
                )}
                {visibleProjects.map(project => (
                    <div key={project.id} className="group/project space-y-1">
                        {dragOverProjectId === project.id && draggedProjectId !== null && draggedProjectId !== project.id && (
                            <div className="h-0.5 bg-brand-blue rounded-full mx-1 mb-1" />
                        )}
                        <div
                            draggable={!term}
                            onDragStart={(e) => { setDraggedProjectId(project.id); e.dataTransfer.effectAllowed = 'move'; }}
                            onDragEnd={() => { setDraggedProjectId(null); setDragOverProjectId(null); }}
                            onDragOver={(e) => { e.preventDefault(); if (draggedProjectId && draggedProjectId !== project.id) setDragOverProjectId(project.id); }}
                            onDrop={(e) => {
                                e.preventDefault();
                                if (draggedProjectId && draggedProjectId !== project.id) reorderProject(draggedProjectId, project.id);
                                setDraggedProjectId(null); setDragOverProjectId(null);
                            }}
                            onClick={() => setCurrentProjectId(project.id)}
                            className={cn(
                                "relative flex items-center justify-between p-4 pr-7 rounded-2xl transition-all select-none",
                                !term && (draggedProjectId === project.id ? 'opacity-30 cursor-grabbing' : 'cursor-grab'),
                                currentProjectId === project.id ? 'bg-brand-blue text-white' : 'hover:bg-sidebar text-muted-dark'
                            )}
                        >
                            <div className="flex items-center gap-2.5 overflow-hidden">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentProjectId(project.id === currentProjectId ? null : project.id);
                                    }}
                                    className="p-0.5 shrink-0"
                                    title="Expandir o contraer proyecto"
                                >
                                    <ChevronRight className={cn("w-4 h-4 transition-transform", currentProjectId === project.id && 'rotate-90')} />
                                </button>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-[10px] font-bold uppercase tracking-tighter whitespace-normal break-words leading-tight">{project.name}</span>
                                    <span className="text-[7px] font-semibold opacity-60 uppercase">{project.code}</span>
                                    {project.date && <span className="text-[7px] font-semibold opacity-50">{formatMonthYear(project.date)}</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover/project:opacity-100 transition-opacity shrink-0">
                                <button onClick={(e) => { e.stopPropagation(); onEditProject(project); }} title="Renombrar/Editar" className="p-1 hover:text-brand-green"><Edit3 className="w-3.5 h-3.5" /></button>
                                <button onClick={(e) => { e.stopPropagation(); onDuplicateProject(project.id); }} title="Duplicar" className="p-1 hover:text-brand-green"><Copy className="w-3.5 h-3.5" /></button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDelete({ type: 'project', id: project.id, name: project.name });
                                    }}
                                    title="Eliminar Proyecto"
                                    className="p-1 hover:text-status-red"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            {!term && (
                                <GripVertical
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-0 group-hover/project:opacity-30 transition-opacity pointer-events-none"
                                    title="Arrastrar para reordenar"
                                />
                            )}
                        </div>

                        {currentProjectId === project.id && (
                            <div className="ml-5 pl-3 border-l-2 border-brand-blue/20 space-y-4 py-2 animate-in slide-in-from-left-2">
                                {getRootChapters(chapters, project.id).filter(c => !term || chapterMatchesSearch(c)).map(chapter => {
                                    const subchapterContent = getSubchapters(chapters, chapter.id).filter(s => !term || chapterMatchesSearch(s)).length > 0 && (
                                        <div className="space-y-1">
                                            {getSubchapters(chapters, chapter.id).filter(s => !term || chapterMatchesSearch(s)).map(sub => (
                                                <div key={sub.id}>{renderChapterBlock(project, sub, true)}</div>
                                            ))}
                                        </div>
                                    );
                                    return <div key={chapter.id}>{renderChapterBlock(project, chapter, false, subchapterContent)}</div>;
                                })}
                                {draggedChapterId && (
                                    <div
                                        onDragOver={(e) => { e.preventDefault(); setDragOverChapterId('__end__'); }}
                                        onDrop={(e) => { e.preventDefault(); reorderChapter(draggedChapterId, null); setDraggedChapterId(null); setDragOverChapterId(null); }}
                                        className={cn("h-4 rounded-full mx-1 transition-colors", dragOverChapterId === '__end__' ? 'bg-brand-blue/20' : '')}
                                    />
                                )}
                                <button onClick={() => onNewChapter(project.id)} className="w-full text-left p-2.5 text-[10px] text-brand-blue hover:bg-brand-blue hover:text-white rounded-xl flex items-center gap-2 font-bold uppercase tracking-widest transition-all border border-dashed border-brand-blue/20"><Plus className="w-3 h-3" /> Añadir Capítulo</button>
                            </div>
                        )}
                    </div>
                ))}
                {draggedProjectId && (
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragOverProjectId('__end__'); }}
                        onDrop={(e) => { e.preventDefault(); reorderProject(draggedProjectId, null); setDraggedProjectId(null); setDragOverProjectId(null); }}
                        className={cn("h-4 rounded-full mx-1 transition-colors", dragOverProjectId === '__end__' ? 'bg-brand-blue/20' : '')}
                    />
                )}
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
