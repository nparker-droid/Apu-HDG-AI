import React, { useMemo } from 'react';
import { DollarSign, TrendingUp, PieChart, FileText } from 'lucide-react';
import { Project, Chapter, APU, ItemCategory } from '../types';
import { exportBudgetToPDF } from '../services/exportService';

const ProjectGeneralView: React.FC<{ project: Project; chapters: Chapter[]; apus: APU[] }> = ({ project, chapters, apus }) => {
  const budgetData = useMemo(() => {
    let totalNeto = 0;
    const projectChapters = chapters.filter(c => c.projectId === project.id);
    const chaptersWithTotals = projectChapters.map(chapter => {
      const chapterApus = apus.filter(a => a.chapterId === chapter.id).map(apu => {
        const laws = Number(apu.useProjectGlobalRates ? project.globalSocialLaws : apu.socialLawsPercentage) || 0;
        const oh = Number(apu.useProjectGlobalRates ? project.globalOverhead : apu.overheadPercentage) || 0;
        const ut = Number(apu.useProjectGlobalRates ? project.globalUtility : apu.utilityPercentage) || 0;
        const direct = Object.values(apu.items).flat().reduce((acc, i) => acc + (Number(i.total) || 0), 0);
        const unitNeto = direct * (1 + (oh + ut) / 100);
        const subtotal = unitNeto * (Number(apu.quantity) || 0);
        return { ...apu, unitNeto, subtotal };
      });
      const totalChapter = chapterApus.reduce((acc, a) => acc + a.subtotal, 0);
      totalNeto += totalChapter;
      return { ...chapter, apus: chapterApus, totalChapter };
    });
    return { chaptersWithTotals, totalNeto };
  }, [project, chapters, apus]);

  const fmtCurr = (v: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Math.round(v));
  const fmtQty = (v: any) => new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(v) || 0);

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 text-slate-400 mb-2"><DollarSign size={16}/> <span className="text-[10px] font-bold uppercase">Neto</span></div>
          <p className="text-2xl font-black text-[#004071]">{fmtCurr(budgetData.totalNeto)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 text-slate-400 mb-2"><TrendingUp size={16}/> <span className="text-[10px] font-bold uppercase">IVA (19%)</span></div>
          <p className="text-2xl font-black text-slate-500">{fmtCurr(budgetData.totalNeto * 0.19)}</p>
        </div>
        <div className="bg-[#004071] p-6 rounded-2xl shadow-xl text-white">
          <div className="flex items-center gap-2 mb-2 opacity-80"><PieChart size={16}/> <span className="text-[10px] font-bold uppercase">Total</span></div>
          <p className="text-2xl font-black">{fmtCurr(budgetData.totalNeto * 1.19)}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 bg-slate-50/50 flex justify-between items-center border-b border-slate-100">
          <h3 className="text-xs font-black text-[#004071] uppercase">Estructura de Costos</h3>
          <button onClick={() => exportBudgetToPDF(project, chapters, apus)} className="flex items-center gap-2 bg-[#004071] text-white px-4 py-2 rounded-xl text-[10px] font-bold hover:bg-[#003056]">
            <FileText size={14}/> EXPORTAR PDF
          </button>
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase">
            <tr><th className="p-4">Ítem</th><th>Descripción</th><th className="text-center">Unid</th><th className="text-center">Cant</th><th className="text-right">P. Unitario</th><th className="p-4 text-right">Total</th></tr>
          </thead>
          <tbody>
            {budgetData.chaptersWithTotals.map(ch => (
              <React.Fragment key={ch.id}>
                <tr className="bg-slate-100/50 font-bold text-[#004071] text-xs">
                  <td className="p-3">{ch.code}</td><td colSpan={4}>{ch.name.toUpperCase()}</td><td className="p-3 text-right">{fmtCurr(ch.totalChapter)}</td>
                </tr>
                {ch.apus.map(a => (
                  <tr key={a.id} className="text-[11px] border-b border-slate-50 text-slate-600">
                    <td className="p-2 pl-4">{a.code}</td><td>{a.name}</td><td className="text-center">{a.unit}</td><td className="text-center font-mono">{fmtQty(a.quantity)}</td><td className="text-right font-mono">{fmtCurr(a.unitNeto)}</td><td className="p-2 text-right font-bold text-slate-800">{fmtCurr(a.subtotal)}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProjectGeneralView;