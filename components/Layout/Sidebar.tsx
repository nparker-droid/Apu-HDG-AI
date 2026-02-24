import React from 'react';
import { 
  Plus, ChevronDown, ChevronUp, FolderPlus, Trash2, 
  Settings, Copy, Share2, FileDown, MoreVertical 
} from 'lucide-react';
import { Project, Chapter, APU } from '../../types';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  projects: Project[];
  chapters: Chapter[];
  apus: APU[];
  moveChapter: (id: string, dir: 'up' | 'down') => void;
  moveApu: (id: string, dir: 'up' | 'down') => void;
  deleteChapter: (id: string) => void;
  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;
  currentApuId: string | null;
  setCurrentApuId: (id: string | null) => void;
  onNewProject: () => void;
  onEditProject: (p: Project) => void;
  onNewChapter: () => void;
  onLibraryOpen: (chapterId: string) => void;
  onCreateApu: (projectId: string, chapterId: string) => void;
  onDuplicateApu: (apu: APU) => void;
  onDeleteApu: (id: string) => void;
  onShareProject: (p: Project) => void;
  handleImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteProject: (id: string) => void;
  onDuplicateProject: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = (props) => {
  const {
    isOpen, projects, chapters, apus, moveChapter, moveApu, deleteChapter,
    currentProjectId, setCurrentProjectId, currentApuId, setCurrentApuId,
    onNewProject, onEditProject, onNewChapter, onLibraryOpen, onCreateApu,
    onDuplicateApu, onDeleteApu, onShareProject, handleImport,
    onDeleteProject, onDuplicateProject
  } = props;

  return (
    <aside className={`${isOpen ? 'w-80' : 'w-0'} bg-[#002D50] text-white transition-all duration-300 flex flex-col overflow-hidden shadow-2xl`}>
      <div className="p-6 border-b border-white/10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#D9E021]">Biblioteca</h2>
          <button onClick={onNewProject} className="p-2 bg-[#88C13E] hover:bg-[#76a835] rounded-xl shadow-lg transition-all active:scale-95">
            <Plus className="w-4 h-4 text-[#002D50]" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-2 no-scrollbar">
        {projects.map((project) => (
          <div key={project.id} className="px-3">
            <div 
              onClick={() => setCurrentProjectId(project.id)}
              className={`group flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${
                currentProjectId === project.id ? 'bg-[#004071] shadow-lg ring-1 ring-white/20' : 'hover:bg-white/5'
              }`}
            >
              <div className="flex flex-col overflow-hidden">
                <span className={`text-[10px] font-black uppercase tracking-widest ${currentProjectId === project.id ? 'text-[#D9E021]' : 'text-slate-400'}`}>
                  {project.code}
                </span>
                <span className="text-xs font-bold truncate">{project.name}</span>
              </div>
              <div className={`flex items-center gap-1 transition-opacity ${currentProjectId === project.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <button onClick={(e) => { e.stopPropagation(); onEditProject(project); }} className="p-1.5 hover:text-[#D9E021]"><Settings className="w-3 h-3" /></button>
                <button onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }} className="p-1.5 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>

            {currentProjectId === project.id && (
              <div className="mt-2 ml-4 pl-4 border-l-2 border-white/10 space-y-4 animate-in slide-in-from-left-2">
                {chapters.filter(c => c.projectId === project.id).map((chapter) => (
                  <div key={chapter.id} className="space-y-2 group/chapter">
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-[9px] font-black text-[#88C13E] tabular-nums">{chapter.code}</span>
                        <span className="text-[10px] font-bold uppercase truncate text-slate-300">{chapter.name}</span>
                      </div>
                      <div className="flex items-center opacity-0 group-hover:opacity-100">
                        <button onClick={() => moveChapter(chapter.id, 'up')} className="p-1 hover:text-[#D9E021]"><ChevronUp className="w-3 h-3" /></button>
                        <button onClick={() => moveChapter(chapter.id, 'down')} className="p-1 hover:text-[#D9E021]"><ChevronDown className="w-3 h-3" /></button>
                        <button onClick={() => onCreateApu(project.id, chapter.id)} className="p-1 hover:text-[#88C13E]"><Plus className="w-3 h-3" /></button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {apus.filter(a => a.chapterId === chapter.id).map((apu) => (
                        <div 
                          key={apu.id}
                          onClick={() => setCurrentApuId(apu.id)}
                          className={`group/apu flex items-center justify-between p-2 rounded-xl transition-all ${
                            currentApuId === apu.id ? 'bg-[#D9E021] text-[#002D50]' : 'hover:bg-white/5 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="text-[8px] font-black opacity-50 tabular-nums">{apu.code}</span>
                            <span className="text-[10px] font-bold truncate uppercase">{apu.name || 'Sin nombre'}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover/apu:opacity-100">
                            <button onClick={(e) => { e.stopPropagation(); moveApu(apu.id, 'up'); }} className="p-1 hover:text-[#002D50]"><ChevronUp className="w-3 h-3" /></button>
                            <button onClick={(e) => { e.stopPropagation(); moveApu(apu.id, 'down'); }} className="p-1 hover:text-[#002D50]"><ChevronDown className="w-3 h-3" /></button>
                            <button onClick={(e) => { e.stopPropagation(); onDeleteApu(apu.id); }} className="p-1 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <button onClick={onNewChapter} className="w-full flex items-center justify-center gap-2 p-2 border border-dashed border-white/20 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">
                  <FolderPlus className="w-3 h-3" /> Nuevo Capítulo
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;