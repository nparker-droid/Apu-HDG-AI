import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Trash2, Eraser, Search, AlertCircle, Sparkles, Loader2, ClipboardPaste, X, Check, Map as MapIcon } from 'lucide-react';
import { APUItem, ItemCategory, HistoryItem, SingleFieldSuggestion } from '../types';
import { getDeviationReasoning, getFieldSuggestion } from '../services/geminiService';
import { STANDARD_LIBRARY } from '../data/standardLibrary';
import { formatUnit } from '../services/exportService';

interface SectionTableProps {
  category: ItemCategory;
  items: APUItem[];
  onChange: (items: APUItem[]) => void;
  history: HistoryItem[];
  apuContext?: string;
  chapterName?: string;
  onRegisterResource?: (item: HistoryItem) => void;
}

interface DeviationAlert {
  itemId: string;
  field: 'unitPrice' | 'performance';
  avgValue: number;
  reasoning: string;
  isLoading: boolean;
  isAiSuggestion?: boolean;
}

const SectionTable: React.FC<SectionTableProps> = ({ 
  category, 
  items, 
  onChange, 
  history, 
  apuContext, 
  chapterName,
  onRegisterResource 
}) => {
  const [showHistoryForIdx, setShowHistoryForIdx] = useState<number | null>(null);
  const [activeAlert, setActiveAlert] = useState<DeviationAlert | null>(null);
  const [isAiLoadingField, setIsAiLoadingField] = useState<string | null>(null);
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar menús al hacer clic fuera del contenedor
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowHistoryForIdx(null);
        setActiveAlert(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const libraryItems: HistoryItem[] = useMemo(() => {
    const itemsFromLib: HistoryItem[] = [];
    if (!STANDARD_LIBRARY) return itemsFromLib;

    STANDARD_LIBRARY.forEach(apu => {
      if (apu.items && apu.items[category]) {
        apu.items[category].forEach(item => {
          if (item) {
            itemsFromLib.push({
              description: item.description || '',
              unit: item.unit || '',
              unitPrice: item.unitPrice || 0,
              category: category,
              performance: item.performance || 1,
              chapterName: 'Catálogo Estándar'
            });
          }
        });
      }
    });
    return itemsFromLib;
  }, [category]);

  const filteredHistory = useMemo(() => {
    // SEGURIDAD CRÍTICA: Validar que el índice exista dentro del array actual
    if (showHistoryForIdx === null || !items || !items[showHistoryForIdx]) {
      return [];
    }
    
    const currentInput = (items[showHistoryForIdx].description || '').toLowerCase().trim();
    const safeHistory = (history || []).filter(h => h && h.category === category);
    const combinedHistory = [...safeHistory, ...libraryItems];
    
    const uniqueHistoryMap = new Map<string, HistoryItem>();
    combinedHistory.forEach(item => {
      if (item && item.description) {
        const key = item.description.toLowerCase().trim();
        if (!uniqueHistoryMap.has(key)) {
          uniqueHistoryMap.set(key, item);
        }
      }
    });
    
    const uniqueHistory = Array.from(uniqueHistoryMap.values());
    if (!currentInput) return uniqueHistory.slice(0, 10);

    return uniqueHistory
      .filter(h => h.description.toLowerCase().includes(currentInput))
      .sort((a, b) => {
        const aStarts = a.description.toLowerCase().startsWith(currentInput);
        const bStarts = b.description.toLowerCase().startsWith(currentInput);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.description.length - b.description.length;
      })
      .slice(0, 12);
  }, [history, libraryItems, showHistoryForIdx, items, category]);

  const addItem = () => {
    const newItem: APUItem = { 
        id: crypto.randomUUID(), 
        description: '', 
        unit: '', 
        quantity: 1.0, 
        performance: 1.0, 
        unitPrice: 0, 
        total: 0 
    };
    onChange([...items, newItem]);
  };

  const handleBulkPaste = () => {
    if (!bulkText.trim()) return;
    const lines = bulkText.split('\n');
    const newItems: APUItem[] = [];
    lines.forEach(line => {
      if (!line.trim()) return;
      const parts = line.split(/\t|;/).map(p => p.trim());
      const description = parts[0] || '';
      const unit = parts[1] || 'UN';
      const rawQty = parts[2]?.replace(',', '.') || '1';
      const rawPrice = parts[3]?.replace(/[$. ]/g, '').replace(',', '.') || '0';
      const qty = parseFloat(rawQty) || 1;
      const up = parseFloat(rawPrice) || 0;
      
      const item: APUItem = {
        id: crypto.randomUUID(),
        description,
        unit,
        quantity: category !== ItemCategory.MANO_DE_OBRA ? qty : 1,
        performance: category === ItemCategory.MANO_DE_OBRA ? qty : 1,
        unitPrice: up,
        total: qty * up
      };

      if (description && onRegisterResource) {
        onRegisterResource({
          description,
          unit,
          unitPrice: up,
          category,
          performance: category === ItemCategory.MANO_DE_OBRA ? qty : 1,
          chapterName
        });
      }

      newItems.push(item);
    });
    if (newItems.length > 0) {
      onChange([...items, ...newItems]);
      setBulkText('');
      setShowBulkPaste(false);
    }
  };

  const updateItem = (index: number, field: keyof APUItem, value: any) => {
    if (!items || !items[index]) return;
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };
    
    // Normalización de valores para evitar NaN
    const p = parseFloat(String(item.performance ?? 0)) || 0;
    const q = parseFloat(String(item.quantity ?? 0)) || 0;
    const up = parseFloat(String(item.unitPrice ?? 0)) || 0;
    
    item.total = category === ItemCategory.MANO_DE_OBRA ? p * up : q * up;
    newItems[index] = item;
    onChange(newItems);
  };

  const handleBlurItem = (idx: number) => {
    const item = items[idx];
    if (item && item.description && item.description.trim() !== "" && onRegisterResource) {
      onRegisterResource({
        description: item.description,
        unit: item.unit,
        unitPrice: item.unitPrice,
        category,
        performance: item.performance || 1,
        chapterName
      });
    }
    // Delay de compatibilidad para navegadores comerciales
    setTimeout(() => {
        setShowHistoryForIdx(null);
    }, 300);
  };

  const handleAiFieldSuggestion = async (item: APUItem, field: 'unitPrice' | 'performance') => {
    if (!item || !item.description) return alert("Ingrese una descripción para obtener sugerencias.");
    const fieldKey = `${item.id}-${field}`;
    setIsAiLoadingField(fieldKey);
    setActiveAlert(null);
    try {
      const suggestion: SingleFieldSuggestion = await getFieldSuggestion(
        apuContext || "Obra de ingeniería",
        item.description,
        field === 'unitPrice' ? 'price' : 'performance'
      );
      setActiveAlert({
        itemId: item.id,
        field,
        avgValue: suggestion.value,
        reasoning: suggestion.reasoning,
        isLoading: false,
        isAiSuggestion: true
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiLoadingField(null);
    }
  };

  const checkDeviation = async (item: APUItem, field: 'unitPrice' | 'performance') => {
    if (!item || !item.description || item[field] === 0 || activeAlert?.isAiSuggestion) return;
    const safeHistory = (history || []).filter(h => h && h.category === category);
    const combinedHistory = [...safeHistory, ...libraryItems];
    const matches = combinedHistory.filter(h => h.description.toLowerCase() === item.description.toLowerCase());
    if (matches.length < 1) return;

    const values = matches.map(h => field === 'unitPrice' ? h.unitPrice : (h.performance || 0)).filter(v => v > 0);
    if (values.length === 0) return;
    
    const avg = values.reduce((acc, curr) => acc + curr, 0) / values.length;
    const userVal = Number(item[field]);
    if (isNaN(userVal) || avg === 0) return;
    
    const deviation = Math.abs(userVal - avg) / avg;

    if (deviation > 0.25) {
      setActiveAlert({
        itemId: item.id,
        field,
        avgValue: avg,
        reasoning: 'Analizando desviación...',
        isLoading: true
      });
      const reasoning = await getDeviationReasoning(category, item.description, userVal, avg, field === 'unitPrice' ? 'precio' : 'rendimiento');
      setActiveAlert(prev => prev ? { ...prev, reasoning, isLoading: false } : null);
    }
  };

  const applySuggestion = (itemId: string, field: 'unitPrice' | 'performance', value: number) => {
    const idx = items.findIndex(i => i.id === itemId);
    if (idx !== -1) updateItem(idx, field, value);
    setActiveAlert(null);
  };

  const selectFromHistory = (idx: number, h: HistoryItem) => {
    if (!items || !items[idx]) return;
    const newItems = [...items];
    newItems[idx] = { 
      ...newItems[idx], 
      description: h.description, 
      unit: h.unit, 
      unitPrice: h.unitPrice, 
      performance: h.performance || 1,
      total: (h.performance || 1) * h.unitPrice
    };
    onChange(newItems);
    setShowHistoryForIdx(null);
    setActiveAlert(null);
  };

  const isLabor = category === ItemCategory.MANO_DE_OBRA;

  return (
    <div className="overflow-visible" ref={containerRef}>
      <div className="flex justify-between items-center mb-4 px-1">
        <div className="flex items-center gap-2">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Desglose de {category}</h4>
           <span className="bg-slate-100 text-[8px] font-black px-2 py-0.5 rounded-full text-slate-500 uppercase transition-colors">{(items || []).length} recursos</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowBulkPaste(true)}
            className="text-[#004071] hover:text-[#88C13E] flex items-center gap-1.5 text-[9px] font-black uppercase tracking-tighter transition-colors"
          >
            <ClipboardPaste className="w-3 h-3" /> Pegar Varios (Excel)
          </button>
          {(items || []).length > 0 && (
            <button onClick={() => confirm('¿Eliminar todos los recursos?') && onChange([])} className="text-red-400 hover:text-red-600 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-tighter">
              <Eraser className="w-3 h-3" /> Limpiar
            </button>
          )}
        </div>
      </div>

      {showBulkPaste && (
        <div className="mb-6 p-6 bg-[#004071]/5 border-2 border-dashed border-[#004071]/20 rounded-[2rem] animate-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center mb-3 px-2">
            <span className="text-[9px] font-black text-[#004071] uppercase tracking-widest flex items-center gap-2">
              <ClipboardPaste className="w-3.5 h-3.5" /> Pegar datos desde Excel
            </span>
            <button onClick={() => { setShowBulkPaste(false); setBulkText(''); }} className="text-slate-400 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <textarea 
            autoFocus
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="Pega aquí (Ej: Cemento; Saco; 10; 4500)"
            className="w-full h-32 p-4 bg-white border-none rounded-2xl text-xs font-mono shadow-inner focus:ring-2 focus:ring-[#004071] transition-all no-scrollbar"
          />
          <div className="flex justify-between items-center mt-3 px-2">
            <p className="text-[8px] text-slate-400 font-bold uppercase">Formato esperado: Descripción [Tab] Unidad [Tab] Cantidad [Tab] Precio</p>
            <button 
              onClick={handleBulkPaste}
              disabled={!bulkText.trim()}
              className="bg-[#004071] hover:bg-[#88C13E] text-white px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
            >
              <Check className="w-3 h-3" /> Procesar Recursos
            </button>
          </div>
        </div>
      )}

      <table className="w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] transition-colors">
            <th className="pb-1 pl-4">Recurso</th>
            <th className="pb-1 text-center w-20">Unid.</th>
            <th className="pb-1 text-right w-36">{isLabor ? 'Rend.' : 'Cant.'}</th>
            <th className="pb-1 text-right w-40">P. Unit.</th>
            <th className="pb-1 text-right w-32 pr-4">Total</th>
            <th className="pb-1 w-10"></th>
          </tr>
        </thead>
        <tbody className="space-y-2">
          {(items || []).map((item, idx) => (
            <tr key={item.id} className="group bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <td className="py-3 pl-4 relative">
                <div className="flex items-center gap-2">
                  <div className="text-slate-200 group-hover:text-[#004071] transition-colors"><Search className="w-3 h-3" /></div>
                  <input 
                    type="text" 
                    value={item.description || ''} 
                    onChange={e => { 
                        updateItem(idx, 'description', e.target.value);
                        if (e.target.value.length > 0) {
                            setShowHistoryForIdx(idx); 
                        } else {
                            setShowHistoryForIdx(null);
                        }
                    }} 
                    onFocus={() => (item.description && item.description.length > 0) && setShowHistoryForIdx(idx)}
                    onBlur={() => handleBlurItem(idx)}
                    placeholder="Descripción..." 
                    className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 placeholder:text-slate-300 transition-colors" 
                  />
                </div>
                {showHistoryForIdx === idx && filteredHistory.length > 0 && (
                  <div className="absolute z-[100] left-0 top-full mt-2 w-full min-w-[320px] bg-white border border-slate-200 shadow-2xl rounded-[1.5rem] p-3 animate-in fade-in slide-in-from-top-2 transition-colors">
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Sugerencias (Biblioteca + Historial)</div>
                    <div className="max-h-60 overflow-y-auto no-scrollbar">
                        {filteredHistory.map((h, hIdx) => (
                        <button 
                            key={`${h.description}-${hIdx}`} 
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectFromHistory(idx, h)} 
                            className="w-full text-left px-4 py-3 rounded-xl flex justify-between items-center hover:bg-[#004071] hover:text-white transition-all"
                        >
                            <div className="flex flex-col">
                            <span className="font-bold text-xs">{h.description}</span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[8px] uppercase font-black opacity-60">
                                    {formatUnit(h.unit || '')} 
                                    {(h.performance !== undefined && h.performance !== null) ? ` | Rend: ${Number(h.performance).toFixed(1)}` : ''}
                                </span>
                                {h.chapterName && (
                                <span className="flex items-center gap-1 text-[7px] font-black text-[#88C13E] bg-[#88C13E]/10 px-1.5 py-0.5 rounded-full uppercase group-hover:bg-white/20 group-hover:text-white">
                                    <MapIcon className="w-2 h-2" /> {h.chapterName}
                                </span>
                                )}
                            </div>
                            </div>
                            <span className="font-mono text-[10px] font-black">
                                ${Math.round(h.unitPrice || 0).toLocaleString('es-CL')}
                            </span>
                        </button>
                        ))}
                    </div>
                  </div>
                )}
              </td>
              <td><input type="text" value={formatUnit(item.unit || '')} onChange={e => updateItem(idx, 'unit', e.target.value)} onBlur={() => handleBlurItem(idx)} className="w-full text-center bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-400 uppercase transition-colors" /></td>
              <td className="relative px-2">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => handleAiFieldSuggestion(item, 'performance')} className={`p-1.5 rounded-lg transition-all ${isAiLoadingField === `${item.id}-performance` ? 'bg-slate-100' : 'bg-[#D9E021]/10 text-[#88C13E] hover:bg-[#88C13E] hover:text-white'}`}>
                    {isAiLoadingField === `${item.id}-performance` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  </button>
                  <input 
                    type="number" 
                    step="0.1" 
                    value={isLabor ? (item.performance ?? 0).toFixed(1) : (item.quantity ?? 0).toFixed(1)} 
                    onChange={e => updateItem(idx, isLabor ? 'performance' : 'quantity', parseFloat(e.target.value) || 0)} 
                    onBlur={() => { checkDeviation(item, 'performance'); handleBlurItem(idx); }} 
                    className={`w-full text-right bg-transparent border-none focus:ring-0 font-mono text-sm font-black transition-colors ${activeAlert?.itemId === item.id && activeAlert.field === 'performance' ? 'text-amber-500' : 'text-[#88C13E]'}`} 
                  />
                </div>
              </td>
              <td className="relative px-2">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => handleAiFieldSuggestion(item, 'unitPrice')} className={`p-1.5 rounded-lg transition-all ${isAiLoadingField === `${item.id}-unitPrice` ? 'bg-slate-100' : 'bg-[#004071]/10 text-[#004071] hover:bg-[#004071] hover:text-white'}`}>
                    {isAiLoadingField === `${item.id}-unitPrice` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  </button>
                  <input 
                    type="number" 
                    value={item.unitPrice ?? 0} 
                    onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} 
                    onBlur={() => { checkDeviation(item, 'unitPrice'); handleBlurItem(idx); }} 
                    className={`w-full text-right bg-transparent border-none focus:ring-0 font-mono text-sm font-black transition-colors ${activeAlert?.itemId === item.id && activeAlert.field === 'unitPrice' ? 'text-amber-500' : 'text-slate-600'}`} 
                  />
                </div>
              </td>
              <td className="text-right pr-4 font-mono text-sm font-black text-[#004071] transition-colors">${Math.round(item.total || 0).toLocaleString('es-CL')}</td>
              <td className="pr-2"><button onClick={() => onChange(items.filter(i => i.id !== item.id))} className="p-2 text-slate-200 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {activeAlert && (
         <div className="fixed bottom-8 right-8 w-96 bg-white border-l-4 border-amber-500 shadow-2xl p-6 rounded-2xl animate-in slide-in-from-right-4 z-[200]">
            <div className="flex justify-between items-start mb-3">
               <div className="flex items-center gap-2 text-amber-600 font-black text-[10px] uppercase tracking-widest">
                  <AlertCircle className="w-4 h-4" /> 
                  {activeAlert.isAiSuggestion ? 'Sugerencia de Inteligencia Artificial' : 'Alerta de Desviación'}
               </div>
               <button onClick={() => setActiveAlert(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">{activeAlert.reasoning}</p>
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
               <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-slate-400 uppercase">{activeAlert.isAiSuggestion ? 'Sugerido' : 'Promedio Histórico'}</span>
                  <span className="text-sm font-black text-[#004071] font-mono">
                    {activeAlert.field === 'unitPrice' ? `$${Math.round(activeAlert.avgValue).toLocaleString('es-CL')}` : (activeAlert.avgValue || 0).toFixed(1)}
                  </span>
               </div>
               <button 
                  onClick={() => applySuggestion(activeAlert.itemId, activeAlert.field, activeAlert.avgValue)}
                  className="bg-[#004071] text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase hover:bg-[#88C13E] transition-all shadow-md"
               >
                  Aplicar Valor
               </button>
            </div>
         </div>
      )}
      <button onClick={addItem} className="group mt-4 w-full py-4 border-2 border-dashed border-slate-100 rounded-[1.5rem] text-slate-300 hover:text-[#004071] hover:bg-white transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3">
        <Plus className="w-3 h-3" /> Añadir recurso a {category}
      </button>
    </div>
  );
};

export default SectionTable;