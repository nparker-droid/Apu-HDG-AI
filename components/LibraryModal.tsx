import React, { useState, useMemo } from 'react';
import { X, BookOpen, Search, Plus, Layers, Star, Info } from 'lucide-react';
import { STANDARD_LIBRARY } from '../data/standardLibrary';
import { APU, Project } from '../types';

interface LibraryModalProps {
  onClose: () => void;
  onSelect: (apu: Partial<APU>) => void;
  projectApus: APU[];
  projects?: Project[];
  activeProjectId?: string;
}

const LibraryModal: React.FC<LibraryModalProps> = ({ onClose, onSelect, projectApus, projects = [], activeProjectId }) => {
  const [search, setSearch] = useState('');

  const otherProjectsApus = useMemo(() => {
    if (!projects || !activeProjectId) return [];
    const list: APU[] = [];
    projects.forEach(p => {
      if (p.id !== activeProjectId) {
        const saved = localStorage.getItem(`apu_engine_project_${p.id}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed && Array.isArray(parsed.apus)) {
              parsed.apus.forEach((apu: APU) => {
                list.push({
                  ...apu,
                  projectName: p.name
                } as any);
              });
            }
          } catch (e) {
            console.error(e);
          }
        }
      }
    });
    return list;
  }, [projects, activeProjectId]);

  const filteredOtherProjects = useMemo(() => {
    return otherProjectsApus.filter(apu => 
      apu.name?.toLowerCase().includes(search.toLowerCase()) || 
      apu.code?.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, otherProjectsApus]);

  const filteredStandard = useMemo(() => {
    return STANDARD_LIBRARY.filter(apu => 
      apu.name?.toLowerCase().includes(search.toLowerCase()) || 
      apu.code?.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  const filteredProject = useMemo(() => {
    return projectApus.filter(apu => 
      apu.name?.toLowerCase().includes(search.toLowerCase()) || 
      apu.code?.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, projectApus]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#004071]/40 backdrop-blur-md p-4 transition-colors">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] transition-colors">
        <div className="px-8 pt-8 pb-6 border-b bg-slate-50 space-y-6 transition-colors">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#004071] rounded-2xl shadow-lg transition-colors">
                <BookOpen className="w-6 h-6 text-[#D9E021]" />
              </div>
              <div>
                <h3 className="text-xl font-black text-[#004071] tracking-tight uppercase">Biblioteca de Partidas</h3>
                <p className="text-[9px] font-black text-[#88C13E] uppercase tracking-widest">Base de Conocimiento Hidrogestión</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#004071] transition-colors">
              <Search className="w-5 h-5" />
            </div>
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o código de partida..." 
              className="w-full pl-14 pr-6 py-5 bg-white border-2 border-slate-100 focus:border-[#004071] rounded-3xl text-sm font-bold shadow-inner transition-all outline-none"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 space-y-10 no-scrollbar transition-colors">
          
          {filteredProject.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <Star className="w-3 h-3 text-[#88C13E] fill-[#88C13E]" />
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Partidas de este Proyecto</h4>
              </div>
              <div className="grid gap-3">
                {filteredProject.map((apu) => (
                  <LibraryItem key={apu.id} apu={apu} onSelect={onSelect} isProject />
                ))}
              </div>
            </div>
          )}

          {filteredOtherProjects.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <BookOpen className="w-3 h-3 text-[#004071]" />
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Partidas de otros Proyectos</h4>
              </div>
              <div className="grid gap-3">
                {filteredOtherProjects.map((apu) => (
                  <LibraryItem key={apu.id} apu={apu} onSelect={onSelect} isOtherProject projectName={(apu as any).projectName} />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <Layers className="w-3 h-3 text-[#004071]" />
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Catálogo Estándar</h4>
            </div>
            {filteredStandard.length > 0 ? (
              <div className="grid gap-3">
                {filteredStandard.map((apu, idx) => (
                  <LibraryItem key={`std-${idx}`} apu={apu} onSelect={onSelect} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 transition-colors">
                <Info className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-xs font-bold text-slate-400 uppercase">No se encontraron partidas</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface LibraryItemProps {
  apu: Partial<APU>;
  onSelect: (apu: Partial<APU>) => void;
  isProject?: boolean;
  isOtherProject?: boolean;
  projectName?: string;
}

const LibraryItem: React.FC<LibraryItemProps> = ({ apu, onSelect, isProject, isOtherProject, projectName }) => (
  <div 
    onClick={() => onSelect(apu)}
    className="group flex items-center justify-between p-5 bg-white hover:bg-[#004071] rounded-3xl cursor-pointer transition-all border border-slate-100 hover:border-[#004071] shadow-sm hover:shadow-xl active:scale-[0.98]"
  >
    <div className="flex flex-col gap-1 overflow-hidden pr-4">
      <div className="flex items-center gap-2">
        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
          isProject ? 'bg-[#88C13E]/10 text-[#88C13E] group-hover:bg-white/20 group-hover:text-white transition-colors' : 
          isOtherProject ? 'bg-[#004071]/10 text-[#004071] group-hover:bg-white/20 group-hover:text-white transition-colors' : 
          'bg-slate-100 text-slate-500 group-hover:bg-white/10 group-hover:text-white transition-colors'}`}>
          {isProject ? 'Referencia Proyecto' : isOtherProject ? `Proyecto: ${projectName}` : `Referencia: ${apu.code || 'STD'}`}
        </span>
      </div>
      <span className="text-md font-bold text-slate-700 group-hover:text-white truncate transition-colors">{apu.name}</span>
      <span className="text-[10px] text-slate-400 group-hover:text-white/60 font-medium italic transition-colors">Unidad: {apu.unit}</span>
    </div>
    <div className="bg-slate-50 group-hover:bg-[#88C13E] p-3 rounded-2xl transition-colors shadow-inner flex items-center justify-center">
      <Plus className="w-5 h-5 text-[#004071] group-hover:text-white transition-colors" />
    </div>
  </div>
);

export default LibraryModal;