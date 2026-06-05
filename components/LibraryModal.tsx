import React, { useState, useMemo } from 'react';
import { X, BookOpen, Search, Plus, Layers, Star, Info, Copy } from 'lucide-react';
import { STANDARD_LIBRARY } from '../data/standardLibrary';
import { APU, Project, ItemCategory, HistoryItem } from '../types';
import { formatCLP } from '../services/exportService';
import { toast } from 'sonner';

interface LibraryModalProps {
  onClose: () => void;
  onSelect: (apu: Partial<APU>) => void;
  projectApus: APU[];
  projects?: Project[];
  activeProjectId?: string;
  mode?: 'select' | 'browse';
}

const LibraryModal: React.FC<LibraryModalProps> = ({
  onClose,
  onSelect,
  projectApus,
  projects = [],
  activeProjectId,
  mode = 'select'
}) => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'apus' | 'resources'>('apus');
  const [resourceCategory, setResourceCategory] = useState<ItemCategory>(ItemCategory.MATERIAL);

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
                list.push({ ...apu, projectName: p.name } as any);
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
    const term = search.toLowerCase();
    return otherProjectsApus.filter(apu =>
      apu.name?.toLowerCase().includes(term) ||
      apu.code?.toLowerCase().includes(term)
    );
  }, [search, otherProjectsApus]);

  const filteredStandard = useMemo(() => {
    const term = search.toLowerCase();
    return STANDARD_LIBRARY.filter(apu =>
      apu.name?.toLowerCase().includes(term) ||
      apu.code?.toLowerCase().includes(term)
    );
  }, [search]);

  const filteredProject = useMemo(() => {
    const term = search.toLowerCase();
    return projectApus.filter(apu =>
      apu.name?.toLowerCase().includes(term) ||
      apu.code?.toLowerCase().includes(term)
    );
  }, [search, projectApus]);

  const resourcesCatalog = useMemo(() => {
    const map = new Map<string, HistoryItem>();
    [...projectApus, ...otherProjectsApus, ...STANDARD_LIBRARY].forEach(apu => {
      if (!apu.items) return;
      Object.values(ItemCategory).forEach(category => {
        const items = apu.items[category] || [];
        items.forEach(item => {
          if (!item.description || item.description.trim() === '') return;
          const key = `${category}-${item.description.toLowerCase().trim()}-${item.unit || ''}`;
          if (!map.has(key)) {
            map.set(key, {
              description: item.description,
              unit: item.unit || '',
              unitPrice: Number(item.unitPrice) || 0,
              category,
              performance: Number(item.performance) || 1,
              chapterName: (apu as any).projectName || apu.name || 'Catalogo'
            });
          }
        });
      });
    });
    return Array.from(map.values());
  }, [projectApus, otherProjectsApus]);

  const filteredResources = useMemo(() => {
    const term = search.toLowerCase().trim();
    return resourcesCatalog
      .filter(item => item.category === resourceCategory)
      .filter(item => !term || item.description.toLowerCase().includes(term) || item.unit.toLowerCase().includes(term))
      .slice(0, 120);
  }, [resourcesCatalog, resourceCategory, search]);

  const handleCopyResource = (item: HistoryItem) => {
    localStorage.setItem('apu_copied_resource_item', JSON.stringify({
      description: item.description,
      unit: item.unit,
      unitPrice: item.unitPrice,
      quantity: 1,
      performance: item.performance || 1
    }));
    toast.success(`Recurso "${item.description}" copiado`);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#004071]/40 backdrop-blur-md p-4 transition-colors">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] transition-colors">
        <div className="px-8 pt-8 pb-6 border-b bg-slate-50 space-y-6 transition-colors">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#004071] rounded-2xl shadow-lg transition-colors">
                <BookOpen className="w-6 h-6 text-[#D9E021]" />
              </div>
              <div>
                <h3 className="text-xl font-black text-[#004071] tracking-tight uppercase">Biblioteca del Usuario</h3>
                <p className="text-[9px] font-black text-[#88C13E] uppercase tracking-widest">Partidas completas y catalogo de recursos</p>
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
              placeholder="Buscar por nombre, codigo, recurso o unidad..."
              className="w-full pl-14 pr-6 py-5 bg-white border-2 border-slate-100 focus:border-[#004071] rounded-3xl text-sm font-bold shadow-inner transition-all outline-none"
            />
          </div>

          {mode === 'browse' && (
            <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-slate-100">
              <button onClick={() => setActiveTab('apus')} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'apus' ? 'bg-[#004071] text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
                Partidas completas
              </button>
              <button onClick={() => setActiveTab('resources')} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'resources' ? 'bg-[#88C13E] text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
                Catalogo de recursos
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10 no-scrollbar transition-colors">
          {(mode === 'select' || activeTab === 'apus') && (
            <>
              {filteredProject.length > 0 && (
                <LibrarySection title="Partidas de este Proyecto" icon={<Star className="w-3 h-3 text-[#88C13E] fill-[#88C13E]" />}>
                  {filteredProject.map((apu) => (
                    <LibraryItem key={apu.id} apu={apu} onSelect={onSelect} isProject mode={mode} />
                  ))}
                </LibrarySection>
              )}

              {filteredOtherProjects.length > 0 && (
                <LibrarySection title="Partidas de otros Proyectos" icon={<BookOpen className="w-3 h-3 text-[#004071]" />}>
                  {filteredOtherProjects.map((apu) => (
                    <LibraryItem key={apu.id} apu={apu} onSelect={onSelect} isOtherProject projectName={(apu as any).projectName} mode={mode} />
                  ))}
                </LibrarySection>
              )}

              <LibrarySection title="Catalogo Estandar" icon={<Layers className="w-3 h-3 text-[#004071]" />}>
                {filteredStandard.length > 0 ? (
                  filteredStandard.map((apu, idx) => (
                    <LibraryItem key={`std-${idx}`} apu={apu} onSelect={onSelect} mode={mode} />
                  ))
                ) : (
                  <EmptyState text="No se encontraron partidas" />
                )}
              </LibrarySection>
            </>
          )}

          {mode === 'browse' && activeTab === 'resources' && (
            <div className="space-y-5">
              <div className="flex gap-2 bg-slate-50 p-1.5 rounded-xl w-max max-w-full overflow-x-auto">
                {Object.values(ItemCategory).map(category => (
                  <button
                    key={category}
                    onClick={() => setResourceCategory(category)}
                    className={`px-4 py-2 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${resourceCategory === category ? 'bg-[#004071] text-white shadow-md' : 'text-slate-400 hover:bg-white'}`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="grid gap-3">
                {filteredResources.length > 0 ? filteredResources.map((item, idx) => (
                  <div key={`${item.description}-${idx}`} className="flex items-center justify-between p-5 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <div className="overflow-hidden pr-4">
                      <p className="text-sm font-black text-slate-700 truncate">{item.description}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Unidad: {item.unit || 'UN'} | P. Unitario: {formatCLP(item.unitPrice)}</p>
                      {item.chapterName && <p className="text-[9px] font-black text-[#88C13E] uppercase tracking-widest mt-1">{item.chapterName}</p>}
                    </div>
                    <button onClick={() => handleCopyResource(item)} className="bg-[#88C13E] hover:bg-[#76aa34] text-white p-3 rounded-2xl transition-colors shadow-inner">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                )) : (
                  <EmptyState text="No se encontraron recursos" />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LibrarySection = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 px-2">
      {icon}
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{title}</h4>
    </div>
    <div className="grid gap-3">{children}</div>
  </div>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="text-center py-12 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 transition-colors">
    <Info className="w-8 h-8 text-slate-300 mx-auto mb-3" />
    <p className="text-xs font-bold text-slate-400 uppercase">{text}</p>
  </div>
);

interface LibraryItemProps {
  apu: Partial<APU>;
  onSelect: (apu: Partial<APU>) => void;
  isProject?: boolean;
  isOtherProject?: boolean;
  projectName?: string;
  mode?: 'select' | 'browse';
}

const LibraryItem: React.FC<LibraryItemProps> = ({ apu, onSelect, isProject, isOtherProject, projectName, mode = 'select' }) => (
  <div
    onClick={() => mode === 'select' && onSelect(apu)}
    className={`group flex items-center justify-between p-5 bg-white rounded-3xl transition-all border border-slate-100 shadow-sm ${mode === 'select' ? 'hover:bg-[#004071] cursor-pointer hover:border-[#004071] hover:shadow-xl active:scale-[0.98]' : ''}`}
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
      <span className={`text-md font-bold truncate transition-colors ${mode === 'select' ? 'text-slate-700 group-hover:text-white' : 'text-slate-700'}`}>{apu.name}</span>
      <span className={`text-[10px] font-medium italic transition-colors ${mode === 'select' ? 'text-slate-400 group-hover:text-white/60' : 'text-slate-400'}`}>Unidad: {apu.unit}</span>
    </div>
    {mode === 'select' && (
      <div className="bg-slate-50 group-hover:bg-[#88C13E] p-3 rounded-2xl transition-colors shadow-inner flex items-center justify-center">
        <Plus className="w-5 h-5 text-[#004071] group-hover:text-white transition-colors" />
      </div>
    )}
  </div>
);

export default LibraryModal;