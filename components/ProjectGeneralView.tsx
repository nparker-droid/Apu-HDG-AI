import React, { useMemo } from 'react';
import { FileText, ChevronUp, ChevronDown } from 'lucide-react';
import { Project, Chapter, APU } from '../types';
import { exportBudgetToPDF } from '../services/exportService';
import { calculateApuTotals, getZeroCostInfo } from '../lib/apuCalculations';
import { formatNumber } from '../lib/number';
import { getRootChapters, getSubchapters } from '../lib/chapters';

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
    const withStats = (apu: APU, number: string) => {
      const { precioUnitarioNeto } = calculateApuTotals(apu, project);
      const subtotal = precioUnitarioNeto * (Number(apu.quantity) || 0);
      return { ...apu, number, displayPU: precioUnitarioNeto, subtotal };
    };

    const chaptersWithTotals = getRootChapters(chapters, project.id).map((chapter, cIdx) => {
      const chapterNumber = String(cIdx + 1);

      const subchapters = getSubchapters(chapters, chapter.id).map((sub, sIdx) => {
        const subNumber = `${chapterNumber}.${sIdx + 1}`;
        const subApus = apus.filter(a => a.chapterId === sub.id).map((apu, aIdx) => withStats(apu, `${subNumber}.${aIdx + 1}`));
        const totalChapter = subApus.reduce((s, a) => s + a.subtotal, 0);
        return { ...sub, number: subNumber, apus: subApus, totalChapter };
      });

      const directApus = apus.filter(a => a.chapterId === chapter.id)
        .map((apu, aIdx) => withStats(apu, `${chapterNumber}.${subchapters.length + aIdx + 1}`));

      const totalChapter = directApus.reduce((s, a) => s + a.subtotal, 0) + subchapters.reduce((s, sub) => s + sub.totalChapter, 0);
      totalNetoProyecto += totalChapter;
      return { ...chapter, number: chapterNumber, subchapters, directApus, totalChapter };
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

  const projectApus = apus.filter(a => a.projectId === project.id);
  const flaggedCount = projectApus.filter(a => a.flagged).length;
  const zeroCount = projectApus.filter(a => getZeroCostInfo(a, project).isZero).length;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-28">
      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-8 border-b border-border bg-sidebar/50 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-brand-blue uppercase tracking-tighter">Estructura de Costos del Proyecto</h3>
            <div className="flex items-center gap-4 mt-1 text-[9px] font-bold text-muted uppercase tracking-widest">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-status-amber" /> Marcadas: {flaggedCount}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-status-red" /> Con costos en $0: {zeroCount}</span>
            </div>
          </div>
          <button onClick={() => exportBudgetToPDF(project, chapters, apus)} className="flex items-center gap-2 bg-brand-blue text-white px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-brand-blue-dark transition-all">
            <FileText className="w-4 h-4" /> Exportar PDF
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sidebar/50 text-[9px] font-bold text-muted uppercase tracking-widest">
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
              {budgetData.chaptersWithTotals.map(chapter => {
                const renderApuRow = (apu: typeof chapter.directApus[number]) => {
                  const zero = getZeroCostInfo(apu, project);
                  return (
                    <tr key={apu.id} className="border-b border-border hover:bg-sidebar/40 transition-colors group/row">
                      <td className="pl-4 pr-0 py-3 align-middle">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onToggleFlag(apu.id)}
                            title={apu.flagged ? 'Marcada como pendiente — clic para quitar' : 'Marcar partida (pendiente / revisar)'}
                            className={`w-3 h-3 rounded-full border transition-all ${apu.flagged
                              ? 'bg-status-amber border-status-amber shadow-[0_0_0_3px_rgba(209,154,61,0.2)]'
                              : 'bg-transparent border-border opacity-40 group-hover/row:opacity-100 hover:border-status-amber'}`}
                          />
                          {zero.isZero && (
                            <span
                              title={apu.displayPU > 0 ? `${zero.zeroItems} recurso(s) con costo $0 — falta completar` : 'Precio unitario en $0 — falta completar'}
                              className="w-2 h-2 rounded-full bg-status-red"
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-3 text-[10px] text-muted font-medium">
                        <div className="flex items-center gap-2 font-mono">
                          <span>{apu.number}</span>
                          <div className="flex flex-col">
                            <button onClick={(e) => { e.stopPropagation(); moveApu(apu.id, 'up'); }} className="p-1 rounded hover:bg-brand-blue/10 hover:text-brand-blue transition-colors"><ChevronUp className="w-3 h-3" /></button>
                            <button onClick={(e) => { e.stopPropagation(); moveApu(apu.id, 'down'); }} className="p-1 rounded hover:bg-brand-blue/10 hover:text-brand-blue transition-colors"><ChevronDown className="w-3 h-3" /></button>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-3 text-xs text-muted-dark font-medium whitespace-normal break-words min-w-[18rem]">
                        <button onClick={() => onOpenApu(apu.id)} className="text-left hover:text-brand-blue hover:underline underline-offset-2">{apu.name}</button>
                      </td>
                      <td className="px-8 py-3 text-[10px] text-center text-muted-dark">{apu.unit}</td>
                      <td className="px-8 py-3 text-[10px] text-center text-muted font-mono">{formatQuantity(apu.quantity)}</td>
                      <td className="px-8 py-3 text-[10px] text-right text-muted font-mono">{formatCLP(apu.displayPU)}</td>
                      <td className="px-8 py-3 text-xs text-right font-bold text-ink font-mono">{formatCLP(apu.subtotal)}</td>
                    </tr>
                  );
                };

                return (
                  <React.Fragment key={chapter.id}>
                    <tr className="bg-sidebar">
                      <td className="pl-4 pr-0 py-3"></td>
                      <td className="px-8 py-3 font-bold text-brand-blue text-xs">
                        <div className="flex items-center gap-2">
                          <span>{chapter.number}</span>
                          <div className="flex flex-col">
                            <button onClick={(e) => { e.stopPropagation(); moveChapter(chapter.id, 'up'); }} className="p-1 rounded hover:bg-brand-blue/10 hover:text-brand-blue transition-colors"><ChevronUp className="w-3 h-3" /></button>
                            <button onClick={(e) => { e.stopPropagation(); moveChapter(chapter.id, 'down'); }} className="p-1 rounded hover:bg-brand-blue/10 hover:text-brand-blue transition-colors"><ChevronDown className="w-3 h-3" /></button>
                          </div>
                        </div>
                      </td>
                      <td colSpan={4} className="px-8 py-3 font-bold text-brand-blue text-xs uppercase">{chapter.name}</td>
                      <td className="px-8 py-3 text-right font-bold text-brand-blue text-xs">{formatCLP(chapter.totalChapter)}</td>
                    </tr>

                    {chapter.subchapters.map(sub => (
                      <React.Fragment key={sub.id}>
                        <tr className="bg-sidebar/50">
                          <td className="pl-4 pr-0 py-2"></td>
                          <td className="pl-12 pr-8 py-2 font-bold text-brand-blue/80 text-[11px]">
                            <div className="flex items-center gap-2">
                              <span>{sub.number}</span>
                              <div className="flex flex-col">
                                <button onClick={(e) => { e.stopPropagation(); moveChapter(sub.id, 'up'); }} className="p-1 rounded hover:bg-brand-blue/10 hover:text-brand-blue transition-colors"><ChevronUp className="w-3 h-3" /></button>
                                <button onClick={(e) => { e.stopPropagation(); moveChapter(sub.id, 'down'); }} className="p-1 rounded hover:bg-brand-blue/10 hover:text-brand-blue transition-colors"><ChevronDown className="w-3 h-3" /></button>
                              </div>
                            </div>
                          </td>
                          <td colSpan={4} className="px-8 py-2 font-bold text-brand-blue/80 text-[11px] uppercase">{sub.name}</td>
                          <td className="px-8 py-2 text-right font-bold text-brand-blue/80 text-[11px]">{formatCLP(sub.totalChapter)}</td>
                        </tr>
                        {sub.apus.map(apu => renderApuRow(apu))}
                      </React.Fragment>
                    ))}

                    {chapter.directApus.map(apu => renderApuRow(apu))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 pt-3 pb-4 bg-white/95 backdrop-blur-sm border-t border-border shadow-[0_-6px_16px_rgba(0,0,0,0.06)]">
        <div className="max-w-xs ml-auto space-y-1">
          <div className="flex items-center justify-between gap-6 text-xs">
            <span className="text-muted font-semibold uppercase tracking-wide">Total Neto</span>
            <span className="font-bold text-ink font-mono">{formatCLP(budgetData.totalNetoProyecto)}</span>
          </div>
          <div className="flex items-center justify-between gap-6 text-xs">
            <span className="text-muted font-semibold uppercase tracking-wide">IVA (19%)</span>
            <span className="font-bold text-muted-dark font-mono">{formatCLP(budgetData.totalNetoProyecto * 0.19)}</span>
          </div>
          <div className="flex items-center justify-between gap-6 bg-brand-green text-white px-4 py-2 rounded-xl mt-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Total Bruto</span>
            <span className="text-base font-bold font-mono">{formatCLP(budgetData.totalNetoProyecto * 1.19)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectGeneralView;
