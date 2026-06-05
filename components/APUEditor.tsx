import React, { useState } from 'react';
import { Sparkles, Users, Box, HardHat, Globe, Hash, Settings2, Loader2, ChevronDown, ChevronUp, FileSpreadsheet } from 'lucide-react';
import { APU, Project, Chapter, ItemCategory, APUItem, HistoryItem } from '../types';
import { getApuSuggestions } from '../services/geminiService';
import SectionTable from './SectionTable';
import { exportSingleApuToExcel } from '../services/excelExportService';

const formatCLP = (val: number) => `$${Math.round(val).toLocaleString('es-CL')}`;
const emptyFieldClass = (isEmpty: boolean) => isEmpty ? 'border border-amber-200 bg-amber-50/50' : '';

interface APUEditorProps {
  apu: APU;
  onUpdate: (apu: APU) => void;
  history: HistoryItem[];
  project: Project;
  chapter: Chapter;
  onRegisterResource: (item: HistoryItem) => void;
}

const APUEditor: React.FC<APUEditorProps> = ({ apu, onUpdate, history, project, chapter, onRegisterResource }) => {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ItemCategory>(ItemCategory.MATERIAL);
  const [showConfig, setShowConfig] = useState(false);

  const laws = apu.useProjectGlobalRates ? project.globalSocialLaws : apu.socialLawsPercentage;
  const overhead = apu.useProjectGlobalRates ? project.globalOverhead : apu.overheadPercentage;
  const utility = apu.useProjectGlobalRates ? project.globalUtility : apu.utilityPercentage;

  const handleChange = (field: string, value: any) => {
    let finalValue = value;
    if (['overheadPercentage', 'utilityPercentage', 'socialLawsPercentage', 'quantity', 'divisorQuantity'].includes(field)) {
      finalValue = parseFloat(value) || 0;
    }
    onUpdate({ ...apu, [field]: finalValue });
  };

  const handleItemsChange = (category: ItemCategory, items: APUItem[]) => onUpdate({ ...apu, items: { ...apu.items, [category]: items } });

  const calculateSubtotal = (category: ItemCategory) => apu.items[category].reduce((sum, item) => sum + (item.total || 0), 0);

  const subMat = calculateSubtotal(ItemCategory.MATERIAL);
  const rawSubMo = calculateSubtotal(ItemCategory.MANO_DE_OBRA);
  const lawsAmt = rawSubMo * (laws / 100);
  const subMoTotal = rawSubMo + lawsAmt;
  const subEq = calculateSubtotal(ItemCategory.EQUIPO);
  const subOt = calculateSubtotal(ItemCategory.OTROS);

  // Cálculos solicitados
  const costoDirectoUnitario = subMat + subMoTotal + subEq + subOt;
  const costoNetoUnitario = costoDirectoUnitario * (1 + (overhead + utility) / 100);

  // Lógica de división de precio unitario
  const displayUnitPrice = (apu.divideUnitPrice && (apu.divisorQuantity || 0) > 0)
    ? costoNetoUnitario / (apu.divisorQuantity || 1)
    : costoNetoUnitario;

  const totalPartidaConIva = (displayUnitPrice * apu.quantity) * 1.19;

  const handleAiSuggest = async () => {
    if (!apu.name) return alert('Ingresa nombre de partida.');
    setIsAiLoading(true);
    try {
      const s = await getApuSuggestions(apu.name);
      const map = (items: any[], usePerformance = false) => items.map(i => {
        const quantity = usePerformance ? 1 : (Number(i.quantity) || 1);
        const performance = usePerformance ? (Number(i.performance) || 1) : 1;
        const unitPrice = Number(i.unitPrice) || 0;
        return {
          id: crypto.randomUUID(),
          description: i.description,
          unit: i.unit,
          quantity,
          performance,
          unitPrice,
          total: unitPrice * (usePerformance ? performance : quantity)
        };
      });
      onUpdate({ ...apu, items: { [ItemCategory.MATERIAL]: map(s.materials), [ItemCategory.MANO_DE_OBRA]: map(s.labor, true), [ItemCategory.EQUIPO]: map(s.equipment, true), [ItemCategory.OTROS]: [] } });
    } catch (e) { alert('Error IA'); } finally { setIsAiLoading(false); }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-32">
      {/* HEADER DE TOTALES MEJORADO */}
      <div className="bg-[#004071] text-white rounded-[2rem] p-8 shadow-2xl flex flex-wrap gap-8 items-center relative overflow-hidden border border-transparent">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>

        <div className="grid grid-cols-1 md:grid-cols-3 w-full gap-8 relative z-10">
          <div>
            <p className="text-[9px] font-black uppercase opacity-60 tracking-[0.2em] mb-1">Costo Directo Unitario</p>
            <p className="text-2xl font-black text-white font-mono">{formatCLP(costoDirectoUnitario)}</p>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase opacity-60 tracking-[0.2em] mb-1">
              {apu.divideUnitPrice ? `Precio Unitario (por ${apu.divisorQuantity || 1} ${apu.unit})` : 'Costo Neto Unitario (+GG/Ut)'}
            </p>
            <p className="text-2xl font-black text-[#88C13E] font-mono">{formatCLP(displayUnitPrice)}</p>
          </div>
          <div className="md:text-right">
            <div className="flex items-center gap-3 md:justify-end mb-2">
              <button onClick={() => exportSingleApuToExcel(project, apu)} className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-xl transition-all shadow-lg flex items-center gap-2 text-[8px] font-black uppercase tracking-widest">
                <FileSpreadsheet className="w-3 h-3" /> Excel APU
              </button>
            </div>
            <p className="text-[9px] font-black uppercase opacity-60 tracking-[0.2em] mb-1">Total Partida (Cant. x Neto + IVA)</p>
            <p className="text-3xl font-black text-[#D9E021] font-mono">{formatCLP(totalPartidaConIva)}</p>
          </div>
        </div>
      </div>

      {/* RESUMEN DE COSTOS DIRECTOS POR CATEGORÍA */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'C. Directo Materiales', val: subMat, icon: <Box className="w-3 h-3" />, color: 'text-blue-500' },
          { label: 'C. Directo M. de Obra', val: subMoTotal, icon: <Users className="w-3 h-3" />, color: 'text-orange-500' },
          { label: 'C. Directo Equipos', val: subEq, icon: <HardHat className="w-3 h-3" />, color: 'text-yellow-500' },
          { label: 'C. Directo Otros', val: subOt, icon: <Globe className="w-3 h-3" />, color: 'text-indigo-500' }
        ].map(item => (
          <div key={item.label} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className={item.color}>{item.icon}</span>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
            </div>
            <p className="text-xs font-black text-slate-700 font-mono">{formatCLP(item.val)}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 space-y-8">
        {/* IDENTIFICACIÓN PARTIDA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-2 space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Hash className="w-3 h-3" /> Ítem</label>
            <input type="text" value={apu.code} onChange={e => handleChange('code', e.target.value)} className={`w-full rounded-xl px-4 py-3 text-center font-black text-lg text-[#004071] ${emptyFieldClass(!apu.code)}`} />
          </div>
          <div className="lg:col-span-6 space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Descripción Técnica</label>
            <div className="relative group">
              <input type="text" value={apu.name} onChange={e => handleChange('name', e.target.value)} placeholder="Partida..." className={`w-full text-xl font-black rounded-xl px-6 py-3 text-slate-800 ${emptyFieldClass(!apu.name)}`} />
              <button onClick={handleAiSuggest} disabled={isAiLoading} className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#004071] hover:bg-[#002D50] text-white px-4 py-2 rounded-xl flex items-center gap-2 text-[8px] font-black uppercase tracking-widest">
                {isAiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-[#D9E021]" />} Analizar IA
              </button>
            </div>
          </div>
          <div className="lg:col-span-4 grid grid-cols-2 gap-4">
            <div><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unidad</label><input type="text" value={apu.unit} onChange={e => handleChange('unit', e.target.value)} className={`w-full rounded-xl px-4 py-3 text-center font-black text-lg text-slate-600 ${emptyFieldClass(!apu.unit)}`} /></div>
            <div><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cantidad</label><input type="number" step="0.001" value={apu.quantity} onFocus={e => e.currentTarget.select()} onChange={e => handleChange('quantity', e.target.value)} className={`w-full rounded-xl px-4 py-3 text-right font-black text-lg text-[#88C13E] ${emptyFieldClass(!apu.quantity)}`} /></div>
          </div>
        </div>

        {/* SECCIÓN CONFIGURACIÓN COSTOS INDIRECTOS Y DIVISIÓN */}
        <div className="border-t border-slate-100 pt-4 space-y-4">
          <div className="flex items-center gap-6">
            <button onClick={() => setShowConfig(!showConfig)} className="flex items-center gap-2 text-[9px] font-black text-slate-400 hover:text-[#004071] uppercase tracking-widest">
              <Settings2 className="w-3 h-3" /> Configuración de Costos Indirectos {showConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dividir Precio Unitario Global</span>
              <button
                onClick={() => onUpdate({ ...apu, divideUnitPrice: !apu.divideUnitPrice, divisorQuantity: apu.divisorQuantity || apu.quantity })}
                className={`w-10 h-5 rounded-full transition-all relative ${apu.divideUnitPrice ? 'bg-[#88C13E]' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${apu.divideUnitPrice ? 'right-1' : 'left-1'}`}></div>
              </button>
              {apu.divideUnitPrice && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                  <span className="text-[9px] font-black text-slate-400 uppercase">por:</span>
                  <input
                    type="number"
                    value={apu.divisorQuantity || ''}
                    onChange={e => handleChange('divisorQuantity', e.target.value)}
                    placeholder="Cantidad..."
                    className="w-20 py-1 bg-white border border-slate-200 rounded-lg text-center text-[10px] font-black text-[#004071]"
                  />
                  <span className="text-[9px] font-black text-slate-400 uppercase">{apu.unit}</span>
                </div>
              )}
            </div>
          </div>
          {showConfig && (
            <div className="mt-4 bg-slate-50 p-6 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-6 animate-in slide-in-from-top-2">
              <div className="flex flex-col gap-2">
                <span className="text-[8px] font-black text-slate-400 uppercase">Origen de Tasas</span>
                <button onClick={() => onUpdate({ ...apu, useProjectGlobalRates: !apu.useProjectGlobalRates })} className={`px-3 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${apu.useProjectGlobalRates ? 'bg-[#88C13E] text-white shadow-md' : 'bg-slate-200 text-slate-500'}`}>
                  {apu.useProjectGlobalRates ? 'Valores del Proyecto' : 'Personalizado'}
                </button>
              </div>
              <div className={!apu.useProjectGlobalRates ? 'opacity-100' : 'opacity-40 pointer-events-none'}>
                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1">Leyes Soc. (%)</label>
                <input type="number" step="0.1" value={laws} onChange={e => handleChange('socialLawsPercentage', e.target.value)} className="w-full py-2 bg-white rounded-lg text-center text-[10px] font-black text-[#004071]" />
              </div>
              <div className={!apu.useProjectGlobalRates ? 'opacity-100' : 'opacity-40 pointer-events-none'}>
                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1">GG (%)</label>
                <input type="number" step="0.1" value={overhead} onChange={e => handleChange('overheadPercentage', e.target.value)} className="w-full py-2 bg-white rounded-lg text-center text-[10px] font-black text-[#004071]" />
              </div>
              <div className={!apu.useProjectGlobalRates ? 'opacity-100' : 'opacity-40 pointer-events-none'}>
                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1">Utilidad (%)</label>
                <input type="number" step="0.1" value={utility} onChange={e => handleChange('utilityPercentage', e.target.value)} className="w-full py-2 bg-white rounded-lg text-center text-[10px] font-black text-[#004071]" />
              </div>
            </div>
          )}
        </div>

        {/* TABLA DE RECURSOS */}
        <div className="border-t border-slate-100 pt-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-2 bg-slate-50 p-1.5 rounded-xl">
              {[ItemCategory.MATERIAL, ItemCategory.MANO_DE_OBRA, ItemCategory.EQUIPO, ItemCategory.OTROS].map((cat) => (
                <button key={cat} onClick={() => setActiveTab(cat)} className={`px-4 py-2 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === cat ? 'bg-[#004071] text-white shadow-md' : 'text-slate-400 hover:bg-slate-100'}`}>{cat}</button>
              ))}
            </div>
            <div className="text-right">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Costo Directo {activeTab}: </span>
              <span className="text-xs font-black text-[#004071] font-mono ml-2">{formatCLP(calculateSubtotal(activeTab))}</span>
            </div>
          </div>
          <SectionTable
            category={activeTab}
            items={apu.items[activeTab]}
            onChange={newI => handleItemsChange(activeTab, newI)}
            history={history}
            apuContext={apu.name}
            chapterName={chapter.name}
            onRegisterResource={onRegisterResource}
          />
        </div>
      </div>
    </div>
  );
};

export default APUEditor;