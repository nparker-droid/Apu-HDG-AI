import React, { useMemo } from 'react';
import { FileText, TrendingUp, DollarSign, PieChart, ChevronUp, ChevronDown } from 'lucide-react';
import { Project, Chapter, APU } from '../types';
import { exportBudgetToPDF } from '../services/exportService';
import { calculateApuTotals, getZeroCostInfo } from '../lib/apuCalculations';
import { formatNumber } from '../lib/number';

interface ProjectGeneralViewProps {
  project: Project;
  chapters: Chapter[];
  apus: APU[];
  moveChapter: (id: string, dir: 'up' | 'down') => void;
  moveApu: (id: string, dir: 'up' | 'down') => void;
  onToggleFlag: (apuId: string) => void;
  onOpenApu: (apuId: string) => void;
}

const ProjectGeneralView: React.FC<ProjectGeneralViewProps> = ({ project, chapters, apus, moveChapter, moveApu, onToggleFlag, onOpenApu }) => {

  const budgetData = useMemo(() => {
    let totalNetoProyecto = 0;
    const chaptersWithTotals = chapters
      .filter(c => c.projectId === project.id)
      .map(chapter => {
        const chapterApus = apus
          .filter(a => a.chapterId === chapter.id)
          .map(apu => {
            const { precioUnitarioNeto } = calculateApuTotals(apu, project);
            const subtotal = precioUnitarioNeto * (Number(apu.quantity) || 0);
            return { ...apu, displayPU: precioUnitarioNeto, subtotal };
          });

        const totalChapter = chapterApus.reduce((s, a) => s + a.subtotal, 0);
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

  const formatQuantity = (val: any) => formatNumber(Number(val) || 0, 2, 3);

  const getApuStats = (activeApu: APU) => {
    const { precioUnitarioNeto } = calculateApuTotals(activeApu, project);
    return { displayPU: precioUnitarioNeto, subtotal: precioUnitarioNeto * activeApu.quantity };
  };

  const projectApus = apus.filter(a => a.projectId === project.id);
  const flaggedCount = projectApus.filter(a => a.flagged).length;
  const zeroCount = projectApus.filter(a => getZeroCostInfo(a, project).isZero).length;

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

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-black text-[#004071] uppercase tracking-tighter">Estructura de Costos del Proyecto</h3>
            <div className="flex items-center gap-4 mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> Marcadas: {flaggedCount}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Con costos en $0: {zeroCount}</span>
            </div>
          </div>
          <button onClick={() => exportBudgetToPDF(project, chapters, apus)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
            <FileText className="w-4 h-4" /> Exportar PDF
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                <th className="pl-4 pr-0 py-4 w-10" title="Indicadores (no se imprimen)"></th>
                <th className="px-8 py-4">Item</th>
                <th className="px-8 py-4">Descripcion de Partida</th>
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
                    <td className="pl-4 pr-0 py-3"></td>
                    <td className="px-8 py-3 font-black text-[#004071] text-xs">
                      <div className="flex items-center gap-2">
                        <span>{cIdx + 1}</span>
                        <div className="flex flex-col">
                          <button onClick={(e) => { e.stopPropagation(); moveChapter(chapter.id, 'up'); }} className="p-1 rounded hover:bg-blue-100 hover:text-blue-600 transition-colors"><ChevronUp className="w-3 h-3" /></button>
                          <button onClick={(e) => { e.stopPropagation(); moveChapter(chapter.id, 'down'); }} className="p-1 rounded hover:bg-blue-100 hover:text-blue-600 transition-colors"><ChevronDown className="w-3 h-3" /></button>
                        </div>
                      </div>
                    </td>
                    <td colSpan={4} className="px-8 py-3 font-black text-[#004071] text-xs uppercase">{chapter.name}</td>
                    <td className="px-8 py-3 text-right font-black text-[#004071] text-xs">{formatCLP(chapter.totalChapter)}</td>
                  </tr>

                  {chapter.apus.map((apu, aIdx) => {
                    const { displayPU, subtotal } = getApuStats(apu);
                    const zero = getZeroCostInfo(apu, project);
                    return (
                      <tr key={apu.id} className="border-b border-slate-100 hover:bg-slate-50/30 transition-colors group/row">
                        <td className="pl-4 pr-0 py-3 align-middle">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => onToggleFlag(apu.id)}
                              title={apu.flagged ? 'Marcada como pendiente — clic para quitar' : 'Marcar partida (pendiente / revisar)'}
                              className={`w-3 h-3 rounded-full border transition-all ${apu.flagged
                                ? 'bg-amber-400 border-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.2)]'
                                : 'bg-transparent border-slate-300 opacity-40 group-hover/row:opacity-100 hover:border-amber-400'}`}
                            />
                            {zero.isZero && (
                              <span
                                title={displayPU > 0 ? `${zero.zeroItems} recurso(s) con costo $0 — falta completar` : 'Precio unitario en $0 — falta completar'}
                                className="w-2 h-2 rounded-full bg-red-500"
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-3 text-[10px] text-slate-400 font-medium">
                          <div className="flex items-center gap-2 font-mono">
                            <span>{cIdx + 1}.{aIdx + 1}</span>
                            <div className="flex flex-col">
                              <button onClick={(e) => { e.stopPropagation(); moveApu(apu.id, 'up'); }} className="p-1 rounded hover:bg-blue-100 hover:text-blue-600 transition-colors"><ChevronUp className="w-3 h-3" /></button>
                              <button onClick={(e) => { e.stopPropagation(); moveApu(apu.id, 'down'); }} className="p-1 rounded hover:bg-blue-100 hover:text-blue-600 transition-colors"><ChevronDown className="w-3 h-3" /></button>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-3 text-xs text-slate-600 font-medium whitespace-normal break-words min-w-[18rem]">
                          <button onClick={() => onOpenApu(apu.id)} className="text-left hover:text-[#004071] hover:underline underline-offset-2">{apu.name}</button>
                        </td>
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
    </div>
  );
};

export default ProjectGeneralView;