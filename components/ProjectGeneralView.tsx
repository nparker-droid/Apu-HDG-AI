import React, { useState, useMemo } from 'react';
import { FileText, TrendingUp, DollarSign, PieChart, ChevronUp, ChevronDown, Copy } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Project, Chapter, APU, ItemCategory } from '../types';
import { exportBudgetToPDF } from '../services/exportService';
import { toast } from 'sonner';

interface ProjectGeneralViewProps {
  project: Project;
  chapters: Chapter[];
  apus: APU[];
}

const ProjectGeneralView: React.FC<ProjectGeneralViewProps> = ({ project, chapters, apus }) => {
  const { moveChapter, moveApu, projects } = useAppStore();
  const [activeViewTab, setActiveViewTab] = useState<'budget' | 'library'>('budget');
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryCategory, setLibraryCategory] = useState<ItemCategory>(ItemCategory.MATERIAL);

  const otherProjectsResources = useMemo(() => {
    const resources: {
      id: string;
      description: string;
      unit: string;
      unitPrice: number;
      performance?: number;
      quantity?: number;
      category: ItemCategory;
      projectName: string;
      projectCode: string;
    }[] = [];

    if (!Array.isArray(projects)) return resources;

    projects.forEach(p => {
      if (p.id === project.id) return;
      const saved = localStorage.getItem(`apu_engine_project_${p.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && Array.isArray(parsed.apus)) {
            parsed.apus.forEach((apu: APU) => {
              if (apu.items) {
                Object.values(ItemCategory).forEach(category => {
                  const items = Array.isArray(apu.items?.[category]) ? apu.items[category] : [];
                  items.forEach(item => {
                    if (item && item.description && item.description.trim() !== '') {
                      resources.push({
                        id: item.id || crypto.randomUUID(),
                        description: item.description,
                        unit: item.unit || '',
                        unitPrice: Number(item.unitPrice) || 0,
                        performance: item.performance,
                        quantity: item.quantity,
                        category,
                        projectName: p.name || 'Proyecto sin nombre',
                        projectCode: p.code || 'S/C'
                      });
                    }
                  });
                });
              }
            });
          }
        } catch (e) {
          console.error(e);
        }
      }
    });

    return resources;
  }, [projects, project.id]);

  const filteredLibraryResources = useMemo(() => {
    const term = librarySearch.toLowerCase();
    return otherProjectsResources.filter(r => {
      const matchesCategory = r.category === libraryCategory;
      const matchesSearch = (r.description || '').toLowerCase().includes(term) ||
                            (r.projectName || '').toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [otherProjectsResources, libraryCategory, librarySearch]);

  const handleCopyResource = (r: any) => {
    localStorage.setItem('apu_copied_resource_item', JSON.stringify({
      description: r.description,
      unit: r.unit,
      unitPrice: r.unitPrice,
      quantity: r.quantity,
      performance: r.performance
    }));
    toast.success(`Recurso "${r.description}" copiado al portapapeles`);
  };

  const budgetData = useMemo(() => {
    let totalNetoProyecto = 0;
    const chaptersWithTotals = chapters
      .filter(c => c.projectId === project.id)
      .map(chapter => {
        const chapterApus = apus
          .filter(a => a.chapterId === chapter.id)
          .map(apu => {
            const laws = apu.useProjectGlobalRates ? project.globalSocialLaws : apu.socialLawsPercentage;
            const overhead = apu.useProjectGlobalRates ? project.globalOverhead : apu.overheadPercentage;
            const utility = apu.useProjectGlobalRates ? project.globalUtility : apu.utilityPercentage;

            const materialItems = Array.isArray(apu.items?.[ItemCategory.MATERIAL]) ? apu.items[ItemCategory.MATERIAL] : [];
            const laborItems = Array.isArray(apu.items?.[ItemCategory.MANO_DE_OBRA]) ? apu.items[ItemCategory.MANO_DE_OBRA] : [];
            const equipmentItems = Array.isArray(apu.items?.[ItemCategory.EQUIPO]) ? apu.items[ItemCategory.EQUIPO] : [];
            const otherItems = Array.isArray(apu.items?.[ItemCategory.OTROS]) ? apu.items[ItemCategory.OTROS] : [];

            const sMat = materialItems.reduce((s, i) => s + (i.total || 0), 0);
            const sMoB = laborItems.reduce((s, i) => s + (i.total || 0), 0);
            const sMoBTotal = sMoB * (1 + laws / 100);
            const sEq = equipmentItems.reduce((s, i) => s + (i.total || 0), 0);
            const sOt = otherItems.reduce((s, i) => s + (i.total || 0), 0);

            const costoDirectoTotal = sMat + sMoBTotal + sEq + sOt;
            const unitarioNeto = costoDirectoTotal * (1 + (overhead + utility) / 100);

            const displayPU = (apu.divideUnitPrice && (apu.divisorQuantity || 0) > 0)
              ? unitarioNeto / (apu.divisorQuantity || 1)
              : unitarioNeto;

            const subtotal = displayPU * (Number(apu.quantity) || 0);

            return { ...apu, displayPU, subtotal };
          });

        const totalChapter = chapterApus.reduce((s, a) => s + (a as any).subtotal, 0);
        totalNetoProyecto += totalChapter;

        return { ...chapter, apus: chapterApus, totalChapter };
      });

    return { chaptersWithTotals, totalNetoProyecto };
  }, [project, chapters, apus]);

  const formatCLP = (val: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(val));
  };

  const formatQuantity = (val: any) => {
    const numericVal = Number(val) || 0;
    return new Intl.NumberFormat('es-CL', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(numericVal);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-2 text-slate-400">
            <DollarSign className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Total Neto</span>
          </div>
          <p className="text-3xl font-black text-[#004071]">{formatCLP(budgetData.totalNetoProyecto)}</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-2 text-slate-400">
            <TrendingUp className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">IVA (19%)</span>
          </div>
          <p className="text-3xl font-black text-slate-500">{formatCLP(budgetData.totalNetoProyecto * 0.19)}</p>
        </div>

        <div className="bg-[#004071] p-6 rounded-[2rem] shadow-xl text-white">
          <div className="flex items-center gap-3 mb-2 opacity-80">
            <PieChart className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Total Bruto</span>
          </div>
          <p className="text-3xl font-black">{formatCLP(budgetData.totalNetoProyecto * 1.19)}</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveViewTab('budget')}
          className={`px-6 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeViewTab === 'budget' ? 'bg-[#004071] text-white shadow-md' : 'text-slate-400 hover:bg-slate-100'}`}
        >
          Estructura del Presupuesto
        </button>
        <button
          onClick={() => setActiveViewTab('library')}
          className={`px-6 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeViewTab === 'library' ? 'bg-[#004071] text-white shadow-md' : 'text-slate-400 hover:bg-slate-100'}`}
        >
          Biblioteca de Recursos Compartidos
        </button>
      </div>

      {activeViewTab === 'budget' ? (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
            <h3 className="text-sm font-black text-[#004071] uppercase tracking-tighter">Estructura de Costos del Proyecto</h3>
            <button onClick={() => exportBudgetToPDF(project, chapters, apus)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
              <FileText className="w-4 h-4" /> Exportar PDF
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-8 py-4">Ítem</th>
                  <th className="px-8 py-4">Descripción de Partida</th>
                  <th className="px-8 py-4 text-center">Unidad</th>
                  <th className="px-8 py-4 text-center">Cant.</th>
                  <th className="px-8 py-4 text-right">P. Unitario</th>
                  <th className="px-8 py-4 text-right">Total Neto</th>
                </tr>
              </thead>
              <tbody>
                {budgetData.chaptersWithTotals.map((chapter, cIdx) => (
                  <React.Fragment key={chapter.id}>
                    <tr className="bg-slate-50">
                      <td className="px-8 py-3 font-black text-[#004071] text-xs">
                        <div className="flex items-center gap-2">
                          <span>{cIdx + 1}</span>
                          <div className="flex flex-col">
                            <button onClick={() => moveChapter(chapter.id, 'up')} className="hover:text-blue-600 outline-none"><ChevronUp className="w-2.5 h-2.5" /></button>
                            <button onClick={() => moveChapter(chapter.id, 'down')} className="hover:text-blue-600 outline-none"><ChevronDown className="w-2.5 h-2.5" /></button>
                          </div>
                        </div>
                      </td>
                      <td colSpan={4} className="px-8 py-3 font-black text-[#004071] text-xs uppercase">{chapter.name}</td>
                      <td className="px-8 py-3 text-right font-black text-[#004071] text-xs">{formatCLP(chapter.totalChapter)}</td>
                    </tr>
                    {chapter.apus.map((apu, aIdx) => {
                      const getApuStats = (activeApu: APU) => {
                        const laws = activeApu.useProjectGlobalRates ? project.globalSocialLaws : activeApu.socialLawsPercentage;
                        const overhead = activeApu.useProjectGlobalRates ? project.globalOverhead : activeApu.overheadPercentage;
                        const utility = activeApu.useProjectGlobalRates ? project.globalUtility : activeApu.utilityPercentage;

                        const materialItems = Array.isArray(activeApu.items?.[ItemCategory.MATERIAL]) ? activeApu.items[ItemCategory.MATERIAL] : [];
                        const laborItems = Array.isArray(activeApu.items?.[ItemCategory.MANO_DE_OBRA]) ? activeApu.items[ItemCategory.MANO_DE_OBRA] : [];
                        const equipmentItems = Array.isArray(activeApu.items?.[ItemCategory.EQUIPO]) ? activeApu.items[ItemCategory.EQUIPO] : [];
                        const otherItems = Array.isArray(activeApu.items?.[ItemCategory.OTROS]) ? activeApu.items[ItemCategory.OTROS] : [];

                        const sMat = materialItems.reduce((s, i) => s + (i.total || 0), 0);
                        const sMoB = laborItems.reduce((s, i) => s + (i.total || 0), 0);
                        const sEq = equipmentItems.reduce((s, i) => s + (i.total || 0), 0);
                        const sOt = otherItems.reduce((s, i) => s + (i.total || 0), 0);

                        const costoDirectoTotal = sMat + (sMoB * (1 + laws / 100)) + sEq + sOt;
                        const factorIndirectos = 1 + (overhead + utility) / 100;
                        const costoNetoTotal = costoDirectoTotal * factorIndirectos;

                        const displayPU = (activeApu.divideUnitPrice && (activeApu.divisorQuantity || 0) > 0)
                          ? costoNetoTotal / (activeApu.divisorQuantity || 1)
                          : costoNetoTotal;

                        return { displayPU, subtotal: displayPU * activeApu.quantity };
                      };

                      const { displayPU, subtotal } = getApuStats(apu);

                      return (
                        <tr key={apu.id} className="border-b border-slate-100 hover:bg-slate-50/30 transition-colors">
                          <td className="px-8 py-3 text-[10px] text-slate-400 font-medium">
                            <div className="flex items-center gap-2 font-mono">
                              <span>{cIdx + 1}.{aIdx + 1}</span>
                              <div className="flex flex-col">
                                <button onClick={() => moveApu(apu.id, 'up')} className="hover:text-blue-600 outline-none"><ChevronUp className="w-2.5 h-2.5" /></button>
                                <button onClick={() => moveApu(apu.id, 'down')} className="hover:text-blue-600 outline-none"><ChevronDown className="w-2.5 h-2.5" /></button>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-3 text-xs text-slate-600 font-medium">{apu.name}</td>
                          <td className="px-8 py-3 text-[10px] text-center text-slate-500">{apu.unit}</td>
                          <td className="px-8 py-3 text-[10px] text-center text-slate-400 font-mono">{formatQuantity(apu.quantity)}</td>
                          <td className="px-8 py-3 text-[10px] text-right text-slate-400 font-mono">{formatCLP(displayPU)}</td>
                          <td className="px-8 py-3 text-xs text-right font-bold text-slate-700 font-mono">{formatCLP(subtotal)}</td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black text-[#004071] uppercase tracking-tighter">Biblioteca de Recursos de otros Proyectos</h3>
              <p className="text-[9px] font-black text-[#88C13E] uppercase tracking-widest">Revisa y copia recursos empleados en otros presupuestos</p>
            </div>
            
            <input
              type="text"
              placeholder="Buscar recurso o proyecto..."
              value={librarySearch}
              onChange={e => setLibrarySearch(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold w-full md:w-64 outline-none focus:border-[#004071] transition-all"
            />
          </div>

          <div className="flex gap-2 bg-slate-50 p-1.5 rounded-xl w-max">
            {[ItemCategory.MATERIAL, ItemCategory.MANO_DE_OBRA, ItemCategory.EQUIPO, ItemCategory.OTROS].map((cat) => (
              <button
                key={cat}
                onClick={() => setLibraryCategory(cat)}
                className={`px-4 py-2 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${libraryCategory === cat ? 'bg-[#004071] text-white shadow-md' : 'text-slate-400 hover:bg-slate-100'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-6 py-4">Descripción</th>
                  <th className="px-6 py-4 text-center">Unidad</th>
                  <th className="px-6 py-4 text-right">P. Unitario</th>
                  {libraryCategory === ItemCategory.MANO_DE_OBRA && <th className="px-6 py-4 text-right">Rendimiento</th>}
                  <th className="px-6 py-4">Proyecto de Origen</th>
                  <th className="px-6 py-4 text-center w-24">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredLibraryResources.length > 0 ? (
                  filteredLibraryResources.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4 text-xs text-slate-700 font-bold">{r.description}</td>
                      <td className="px-6 py-4 text-xs text-center text-slate-500 uppercase">{r.unit || 'UN'}</td>
                      <td className="px-6 py-4 text-xs text-right text-slate-600 font-mono font-bold">{formatCLP(r.unitPrice)}</td>
                      {libraryCategory === ItemCategory.MANO_DE_OBRA && (
                        <td className="px-6 py-4 text-xs text-right text-slate-600 font-mono">{(r.performance || 0).toFixed(3)}</td>
                      )}
                      <td className="px-6 py-4 text-[10px] text-slate-400 uppercase font-black">
                        <span className="bg-slate-100 px-2.5 py-1 rounded-full">{r.projectName} ({r.projectCode})</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleCopyResource(r)}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#004071] hover:bg-[#002D50] text-white text-[8px] font-black uppercase tracking-wider rounded-lg transition-all shadow-sm mx-auto"
                        >
                          <Copy className="w-3 h-3" /> Copiar
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={libraryCategory === ItemCategory.MANO_DE_OBRA ? 6 : 5} className="text-center py-12 text-slate-400 font-bold text-xs">
                      No hay recursos en esta categoría para otros proyectos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectGeneralView;