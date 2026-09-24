import React, { useState, useMemo, useEffect } from 'react';
import { X, BookOpen, Search, Plus, Layers, Star, Info, Copy, Edit3, Save, Trash2 } from 'lucide-react';
import { STANDARD_LIBRARY } from '../data/standardLibrary';
import { APU, Project, ItemCategory, HistoryItem } from '../types';
import { formatCLP } from '../services/exportService';
import { toast } from 'sonner';
import { Modal } from './ui/Modal';

interface LibraryModalProps {
  onClose: () => void;
  onSelect: (apu: Partial<APU>) => void;
  projectApus: APU[];
  projects?: Project[];
  activeProjectId?: string;
  mode?: 'select' | 'browse';
}

interface CatalogResource extends HistoryItem {
  id: string;
  source: 'user' | 'project' | 'standard';
  sourceLabel: string;
}

const USER_RESOURCE_KEY = 'apu_user_resource_library';

const parseMoney = (value: string | number) => {
  if (typeof value === 'number') return value;
  return parseFloat(value.replace(/\s/g, '').replace(/\$/g, '').replace(/\./g, '').replace(',', '.')) || 0;
};

const emptyResourceForm = {
  id: '',
  description: '',
  unit: '',
  unitPrice: '',
  category: ItemCategory.MATERIAL,
  performance: '1'
};

const LibraryModal: React.FC<LibraryModalProps> = ({
  onClose,
  onSelect,
  projectApus,
  projects = [],
  activeProjectId,
  mode = 'select'
}) => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'apus' | 'resources'>(mode === 'select' ? 'apus' : 'apus');
  const [resourceCategory, setResourceCategory] = useState<ItemCategory>(ItemCategory.MATERIAL);
  const [userResources, setUserResources] = useState<CatalogResource[]>(() => {
    try {
      const saved = localStorage.getItem(USER_RESOURCE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [resourceForm, setResourceForm] = useState(emptyResourceForm);

  useEffect(() => {
    localStorage.setItem(USER_RESOURCE_KEY, JSON.stringify(userResources));
  }, [userResources]);

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
                list.push({ ...apu, projectName: p.name, projectCode: p.code } as any);
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

  const apuMatchesSearch = (apu: Partial<APU>, term: string) => {
    if (!term) return true;
    const projectName = ((apu as any).projectName || '').toLowerCase();
    const projectCode = ((apu as any).projectCode || '').toLowerCase();
    const basicText = [
      apu.name,
      apu.code,
      apu.unit,
      projectName,
      projectCode
    ].filter(Boolean).join(' ').toLowerCase();

    const resourceText = apu.items
      ? Object.values(ItemCategory).flatMap(category => apu.items?.[category] || [])
          .map(item => `${item.description || ''} ${item.unit || ''}`)
          .join(' ')
          .toLowerCase()
      : '';

    return `${basicText} ${resourceText}`.includes(term);
  };

  const filteredOtherProjects = useMemo(() => {
    const term = search.toLowerCase().trim();
    return otherProjectsApus.filter(apu => apuMatchesSearch(apu, term));
  }, [search, otherProjectsApus]);

  const filteredStandard = useMemo(() => {
    const term = search.toLowerCase().trim();
    return STANDARD_LIBRARY.filter(apu => apuMatchesSearch(apu, term));
  }, [search]);

  const filteredProject = useMemo(() => {
    const term = search.toLowerCase().trim();
    return projectApus.filter(apu => apuMatchesSearch(apu, term));
  }, [search, projectApus]);

  const resourcesCatalog = useMemo(() => {
    const map = new Map<string, CatalogResource>();

    userResources.forEach(item => {
      const key = `${item.category}-${item.description.toLowerCase().trim()}-${item.unit || ''}`;
      map.set(key, { ...item, source: 'user', sourceLabel: 'Biblioteca del usuario' });
    });

    [...projectApus, ...otherProjectsApus, ...STANDARD_LIBRARY].forEach(apu => {
      if (!apu.items) return;
      Object.values(ItemCategory).forEach(category => {
        const items = apu.items?.[category] || [];
        items.forEach(item => {
          if (!item.description || item.description.trim() === '') return;
          const key = `${category}-${item.description.toLowerCase().trim()}-${item.unit || ''}`;
          if (!map.has(key)) {
            const sourceLabel = (apu as any).projectName || apu.name || 'Catalogo estandar';
            map.set(key, {
              id: item.id || crypto.randomUUID(),
              description: item.description,
              unit: item.unit || '',
              unitPrice: Number(item.unitPrice) || 0,
              category,
              performance: Number(item.performance) || 1,
              chapterName: sourceLabel,
              source: (apu as any).projectName ? 'project' : 'standard',
              sourceLabel
            });
          }
        });
      });
    });

    return Array.from(map.values());
  }, [projectApus, otherProjectsApus, userResources]);

  const filteredResources = useMemo(() => {
    const term = search.toLowerCase().trim();
    return resourcesCatalog
      .filter(item => item.category === resourceCategory)
      .filter(item => !term ||
        item.description.toLowerCase().includes(term) ||
        item.unit.toLowerCase().includes(term) ||
        item.sourceLabel.toLowerCase().includes(term)
      )
      .slice(0, 160);
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

  const startNewResource = () => {
    setResourceForm({ ...emptyResourceForm, category: resourceCategory });
    setShowResourceForm(true);
  };

  const startEditResource = (item: CatalogResource) => {
    setResourceForm({
      id: item.source === 'user' ? item.id : '',
      description: item.description,
      unit: item.unit,
      unitPrice: String(Math.round(item.unitPrice || 0)),
      category: item.category,
      performance: String(item.performance || 1)
    });
    setResourceCategory(item.category);
    setShowResourceForm(true);
  };

  const saveResource = () => {
    if (!resourceForm.description.trim()) {
      toast.error('Ingresa una descripcion para el recurso.');
      return;
    }

    const resource: CatalogResource = {
      id: resourceForm.id || crypto.randomUUID(),
      description: resourceForm.description.trim(),
      unit: resourceForm.unit.trim() || 'UN',
      unitPrice: parseMoney(resourceForm.unitPrice),
      category: resourceForm.category,
      performance: parseMoney(resourceForm.performance) || 1,
      chapterName: 'Biblioteca del usuario',
      source: 'user',
      sourceLabel: 'Biblioteca del usuario'
    };

    setUserResources(prev => {
      const exists = prev.some(item => item.id === resource.id);
      return exists ? prev.map(item => item.id === resource.id ? resource : item) : [resource, ...prev];
    });
    setResourceCategory(resource.category);
    setShowResourceForm(false);
    setResourceForm(emptyResourceForm);
    toast.success('Recurso guardado en biblioteca');
  };

  const deleteUserResource = (id: string) => {
    setUserResources(prev => prev.filter(item => item.id !== id));
    toast.success('Recurso eliminado de biblioteca');
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-3xl" height="max-h-[85vh]" zIndexClass="z-[60]">
      <div className="px-8 pt-8 pb-6 border-b border-border bg-sidebar space-y-6 shrink-0">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-blue rounded-2xl">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-ink tracking-tight uppercase">Biblioteca del Usuario</h3>
              <p className="text-[9px] font-bold text-brand-green uppercase tracking-widest">Partidas completas y catalogo de recursos</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-border rounded-full transition-colors">
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        <div className="relative group">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-brand-blue transition-colors">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, codigo, proyecto, recurso o unidad..."
            className="w-full pl-14 pr-6 py-5 bg-white border border-border focus:border-brand-blue rounded-2xl text-sm font-semibold transition-all outline-none"
          />
        </div>

        {mode === 'browse' && (
          <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-border">
            <button onClick={() => setActiveTab('apus')} className={`flex-1 py-3 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${activeTab === 'apus' ? 'bg-brand-blue text-white' : 'text-muted hover:bg-sidebar'}`}>
              Partidas completas
            </button>
            <button onClick={() => setActiveTab('resources')} className={`flex-1 py-3 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${activeTab === 'resources' ? 'bg-brand-green text-white' : 'text-muted hover:bg-sidebar'}`}>
              Catalogo de recursos
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-10 no-scrollbar">
        {(mode === 'select' || activeTab === 'apus') && (
          <>
            {filteredProject.length > 0 && (
              <LibrarySection title="Partidas de este Proyecto" icon={<Star className="w-3 h-3 text-brand-green fill-brand-green" />}>
                {filteredProject.map((apu) => (
                  <LibraryItem key={apu.id} apu={apu} onSelect={onSelect} isProject mode={mode} />
                ))}
              </LibrarySection>
            )}

            {filteredOtherProjects.length > 0 && (
              <LibrarySection title="Partidas de otros Proyectos" icon={<BookOpen className="w-3 h-3 text-brand-blue" />}>
                {filteredOtherProjects.map((apu) => (
                  <LibraryItem key={apu.id} apu={apu} onSelect={onSelect} isOtherProject projectName={(apu as any).projectName} mode={mode} />
                ))}
              </LibrarySection>
            )}

            <LibrarySection title="Catalogo Estandar" icon={<Layers className="w-3 h-3 text-brand-blue" />}>
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex gap-2 bg-sidebar p-1.5 rounded-xl w-max max-w-full overflow-x-auto">
                {Object.values(ItemCategory).map(category => (
                  <button
                    key={category}
                    onClick={() => setResourceCategory(category)}
                    className={`px-4 py-2 text-[8px] font-bold uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${resourceCategory === category ? 'bg-brand-blue text-white' : 'text-muted hover:bg-white'}`}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <button onClick={startNewResource} className="flex items-center justify-center gap-2 bg-brand-green hover:bg-brand-green-dark text-white px-4 py-3 rounded-2xl text-[9px] font-bold uppercase tracking-widest transition-colors">
                <Plus className="w-4 h-4" /> Agregar recurso
              </button>
            </div>

            {showResourceForm && (
              <div className="bg-sidebar border border-border rounded-2xl p-5 grid grid-cols-1 md:grid-cols-12 gap-3">
                <input
                  value={resourceForm.description}
                  onChange={e => setResourceForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripcion del recurso"
                  className="md:col-span-5 px-4 py-3 bg-white rounded-xl border border-border text-xs font-semibold outline-none focus:border-brand-blue"
                />
                <input
                  value={resourceForm.unit}
                  onChange={e => setResourceForm(prev => ({ ...prev, unit: e.target.value }))}
                  placeholder="Unidad"
                  className="md:col-span-2 px-4 py-3 bg-white rounded-xl border border-border text-xs font-semibold outline-none focus:border-brand-blue"
                />
                <input
                  value={resourceForm.unitPrice}
                  onChange={e => setResourceForm(prev => ({ ...prev, unitPrice: e.target.value }))}
                  placeholder="Precio"
                  inputMode="numeric"
                  className="md:col-span-2 px-4 py-3 bg-white rounded-xl border border-border text-xs font-semibold outline-none focus:border-brand-blue"
                />
                <select
                  value={resourceForm.category}
                  onChange={e => setResourceForm(prev => ({ ...prev, category: e.target.value as ItemCategory }))}
                  className="md:col-span-2 px-4 py-3 bg-white rounded-xl border border-border text-xs font-bold outline-none focus:border-brand-blue"
                >
                  {Object.values(ItemCategory).map(category => <option key={category} value={category}>{category}</option>)}
                </select>
                <div className="md:col-span-1 flex gap-1">
                  <button onClick={saveResource} className="flex-1 bg-brand-blue text-white rounded-xl flex items-center justify-center">
                    <Save className="w-4 h-4" />
                  </button>
                  <button onClick={() => setShowResourceForm(false)} className="flex-1 bg-white border border-border text-muted rounded-xl flex items-center justify-center">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="grid gap-3">
              {filteredResources.length > 0 ? filteredResources.map((item, idx) => (
                <div key={`${item.source}-${item.id}-${idx}`} className="flex items-center justify-between p-5 bg-white rounded-2xl border border-border">
                  <div className="overflow-hidden pr-4">
                    <p className="text-sm font-bold text-ink whitespace-normal break-words">{item.description}</p>
                    <p className="text-[10px] font-semibold text-muted uppercase mt-1">Unidad: {item.unit || 'UN'} | P. Unitario: {formatCLP(item.unitPrice)}</p>
                    <p className="text-[9px] font-bold text-brand-green uppercase tracking-widest mt-1">{item.sourceLabel}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEditResource(item)} className="bg-sidebar hover:bg-border text-brand-blue p-3 rounded-xl transition-colors" title="Editar o guardar en biblioteca">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {item.source === 'user' && (
                      <button onClick={() => deleteUserResource(item.id)} className="bg-status-red/10 hover:bg-status-red/20 text-status-red p-3 rounded-xl transition-colors" title="Eliminar recurso">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => handleCopyResource(item)} className="bg-brand-green hover:bg-brand-green-dark text-white p-3 rounded-xl transition-colors" title="Copiar recurso">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )) : (
                <EmptyState text="No se encontraron recursos" />
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

const LibrarySection = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 px-2">
      {icon}
      <h4 className="text-[10px] font-bold text-muted uppercase tracking-[0.2em]">{title}</h4>
    </div>
    <div className="grid gap-3">{children}</div>
  </div>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="text-center py-12 bg-sidebar rounded-2xl border-2 border-dashed border-border">
    <Info className="w-8 h-8 text-muted-light mx-auto mb-3" />
    <p className="text-xs font-semibold text-muted uppercase">{text}</p>
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
    className={`group flex items-center justify-between p-5 bg-white rounded-2xl transition-all border border-border ${mode === 'select' ? 'hover:bg-brand-blue cursor-pointer hover:border-brand-blue active:scale-[0.98]' : ''}`}
  >
    <div className="flex flex-col gap-1 overflow-hidden pr-4">
      <div className="flex items-center gap-2">
        <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${
          isProject ? 'bg-brand-green/10 text-brand-green group-hover:bg-white/20 group-hover:text-white transition-colors' :
          isOtherProject ? 'bg-brand-blue/10 text-brand-blue group-hover:bg-white/20 group-hover:text-white transition-colors' :
          'bg-sidebar text-muted group-hover:bg-white/10 group-hover:text-white transition-colors'}`}>
          {isProject ? 'Referencia Proyecto' : isOtherProject ? `Proyecto: ${projectName}` : `Referencia: ${apu.code || 'STD'}`}
        </span>
      </div>
      <span className={`text-md font-semibold whitespace-normal break-words transition-colors ${mode === 'select' ? 'text-ink group-hover:text-white' : 'text-ink'}`}>{apu.name}</span>
      <span className={`text-[10px] font-medium italic transition-colors ${mode === 'select' ? 'text-muted group-hover:text-white/60' : 'text-muted'}`}>Unidad: {apu.unit}</span>
    </div>
    {mode === 'select' && (
      <div className="bg-sidebar group-hover:bg-brand-green p-3 rounded-xl transition-colors flex items-center justify-center">
        <Plus className="w-5 h-5 text-brand-blue group-hover:text-white transition-colors" />
      </div>
    )}
  </div>
);

export default LibraryModal;
