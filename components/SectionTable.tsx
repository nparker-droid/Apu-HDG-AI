import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Trash2, Sparkles, Loader2, ClipboardPaste, X, Check, Copy, HelpCircle } from 'lucide-react';
import { APUItem, ItemCategory, HistoryItem, SingleFieldSuggestion } from '../types';
import { getDeviationReasoning, getFieldSuggestion, getResourcePriceFromWeb } from '../services/geminiService';
import { STANDARD_LIBRARY } from '../data/standardLibrary';
import { formatUnit, formatCLP } from '../services/exportService';
import { toast } from 'sonner';

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

const parseLocaleNumber = (value: string | number) => {
  if (typeof value === 'number') return value;
  const normalized = value
    .replace(/\s/g, '')
    .replace(/\$/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  return parseFloat(normalized) || 0;
};

const formatThousands = (value: number) => Math.round(Number(value) || 0).toLocaleString('es-CL');
const formatDecimalInput = (value: number) => value.toLocaleString('es-CL', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const sanitizeDecimalInput = (value: string) => value.replace(/[^\d,]/g, '');
const sanitizeMoneyInput = (value: string) => value.replace(/[^\d]/g, '');

const emptyFieldClass = (isEmpty: boolean) => isEmpty ? 'border border-amber-200 bg-amber-50/40' : '';

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

  const [loadingPriceItemIds, setLoadingPriceItemIds] = useState<Record<string, boolean>>({});
  const [hasCopiedItem, setHasCopiedItem] = useState(false);
  const [focusedCell, setFocusedCell] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const checkClipboard = () => {
      const item = localStorage.getItem('apu_copied_resource_item');
      setHasCopiedItem(!!item);
    };
    checkClipboard();
    window.addEventListener('focus', checkClipboard);
    return () => window.removeEventListener('focus', checkClipboard);
  }, []);

  const handleCopyItem = (item: APUItem) => {
    localStorage.setItem('apu_copied_resource_item', JSON.stringify({
      description: item.description,
      unit: item.unit,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      performance: item.performance
    }));
    setHasCopiedItem(true);
    toast.success(`Recurso "${item.description}" copiado al portapapeles`);
  };

  const handlePasteItem = () => {
    const raw = localStorage.getItem('apu_copied_resource_item');
    if (!raw) return;
    try {
      const copied = JSON.parse(raw);
      const newItem: APUItem = {
        id: crypto.randomUUID(),
        description: copied.description || '',
        unit: copied.unit || '',
        quantity: typeof copied.quantity === 'number' ? copied.quantity : 1,
        performance: typeof copied.performance === 'number' ? copied.performance : 1,
        unitPrice: typeof copied.unitPrice === 'number' ? copied.unitPrice : 0,
        total: 0
      };
      
      const isLabor = category === ItemCategory.MANO_DE_OBRA;
      newItem.total = isLabor ? newItem.performance * newItem.unitPrice : newItem.quantity * newItem.unitPrice;
      
      onChange([...items, newItem]);
      toast.success(`Recurso "${newItem.description}" pegado con éxito`);
    } catch (e) {
      toast.error('Error al pegar el recurso');
    }
  };

  const handleBulkPaste = () => {
    const rows = bulkText
      .split(/\r?\n/)
      .map(row => row.trim())
      .filter(Boolean);

    const parsedItems = rows.map(row => {
      const parts = row.includes(';') ? row.split(';') : row.split(/\t/);
      const [description = '', unit = '', amount = '1', price = '0'] = parts.map(part => part.trim());
      const quantityOrPerformance = parseLocaleNumber(amount);
      const unitPrice = parseLocaleNumber(price);
      const newItem: APUItem = {
        id: crypto.randomUUID(),
        description,
        unit,
        quantity: isLabor ? 1 : quantityOrPerformance,
        performance: isLabor ? quantityOrPerformance : 1,
        unitPrice,
        total: 0
      };
      newItem.total = isLabor ? (newItem.performance || 0) * unitPrice : newItem.quantity * unitPrice;
      return newItem;
    }).filter(item => item.description.trim() !== '');

    if (parsedItems.length === 0) {
      toast.error('No se encontraron filas válidas para pegar.');
      return;
    }

    onChange([...items, ...parsedItems]);
    setBulkText('');
    setShowBulkPaste(false);
    toast.success(`${parsedItems.length} recursos pegados correctamente`);
  };

  const formatPriceSources = (sources: string[] | undefined): string => {
    if (!sources || sources.length === 0) return '';
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const s of sources) {
      if (labels.length >= 4) break;
      try {
        const host = new URL(s).hostname.replace(/^www\./, '');
        // URLs de redirección interna de Gemini Search Grounding → mostrar como "Google Search"
        const label = host.includes('vertexaisearch') || host.includes('googleapis') || host.includes('google.com')
          ? 'Google Search'
          : host;
        if (!seen.has(label)) { seen.add(label); labels.push(label); }
      } catch {
        const fallback = s.length > 30 ? s.substring(0, 30) + '…' : s;
        if (!seen.has(fallback)) { seen.add(fallback); labels.push(fallback); }
      }
    }
    return labels.length ? `Fuentes: ${labels.join(', ')}` : '';
  };

  const handleGeneratePrice = async (item: APUItem, index: number) => {
    if (!item.description || item.description.trim() === '') {
      toast.error('Por favor, ingresa una descripción para el recurso primero.');
      return;
    }

    setLoadingPriceItemIds(prev => ({ ...prev, [item.id]: true }));
    const loadingToastId = toast.loading(`Buscando precios en la web para "${item.description}"…`);

    try {
      const result = await getResourcePriceFromWeb(item.description, item.unit || 'UN', apuContext || '');
      toast.dismiss(loadingToastId);
      if (result && result.price > 0) {
        updateItem(index, 'unitPrice', result.price);
        toast.success(`Precio sugerido: ${formatCLP(result.price)}`, {
          description: `${result.reasoning}${result.sources?.length ? '\n' + formatPriceSources(result.sources) : ''}`,
          duration: 12000,
          closeButton: true,
        });
      } else {
        toast.warning('La IA no pudo encontrar un precio preciso. Por favor ingresa el precio manualmente.');
      }
    } catch (error) {
      toast.dismiss(loadingToastId);
      console.error(error);
      toast.error('Error al consultar el precio con IA.');
    } finally {
      setLoadingPriceItemIds(prev => ({ ...prev, [item.id]: false }));
    }
  };

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
              unitPrice: Number(item.unitPrice) || 0,
              category: category,
              performance: Number(item.performance) || 1,
              chapterName: 'Catálogo Estándar'
            });
          }
        });
      }
    });
    return itemsFromLib;
  }, [category]);

  const filteredHistory = useMemo(() => {
    if (showHistoryForIdx === null || !items || !items[showHistoryForIdx]) return [];

    const currentInput = (items[showHistoryForIdx].description || '').toLowerCase().trim();
    const safeHistory = (history || []).filter(h => h && h.category === category);
    const combinedHistory = [...safeHistory, ...libraryItems];

    const uniqueHistoryMap = new Map<string, HistoryItem>();
    combinedHistory.forEach(item => {
      if (item && item.description) {
        const key = item.description.toLowerCase().trim();
        if (!uniqueHistoryMap.has(key)) uniqueHistoryMap.set(key, item);
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

  const updateItem = (index: number, field: keyof APUItem, value: any) => {
    if (!items || !items[index]) return;
    const newItems = [...items];
    const item = { ...newItems[index], [field]: field === 'unitPrice' || field === 'quantity' || field === 'performance' ? parseLocaleNumber(value) : value };

    const p = parseFloat(String(item.performance ?? 0)) || 0;
    const up = parseFloat(String(item.unitPrice ?? 0)) || 0;
    const q = parseFloat(String(item.quantity ?? 0)) || 0;

    item.total = category === ItemCategory.MANO_DE_OBRA ? p * up : q * up;
    newItems[index] = item;
    onChange(newItems);
  };

  const updateEditingValue = (key: string, rawValue: string, index: number, field: 'quantity' | 'performance' | 'unitPrice') => {
    const sanitized = field === 'unitPrice' ? sanitizeMoneyInput(rawValue) : sanitizeDecimalInput(rawValue);
    setEditingValues(prev => ({ ...prev, [key]: sanitized }));
    updateItem(index, field, sanitized);
  };

  const clearEditingValue = (key: string) => {
    setEditingValues(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleBlurItem = (idx: number) => {
    const item = items[idx];
    if (item && item.description && item.description.trim() !== "" && onRegisterResource) {
      onRegisterResource({
        description: item.description,
        unit: item.unit,
        unitPrice: Number(item.unitPrice) || 0,
        category,
        performance: Number(item.performance) || 1,
        chapterName
      });
    }
    setTimeout(() => setShowHistoryForIdx(null), 300);
  };

  const checkDeviation = async (item: APUItem, field: 'unitPrice' | 'performance') => {
    if (!item || !item.description || Number(item[field]) === 0) return;
    const combinedHistory = [...(history || []).filter(h => h.category === category), ...libraryItems];
    const matches = combinedHistory.filter(h => h.description.toLowerCase() === item.description.toLowerCase());
    if (matches.length < 1) return;

    const values = matches.map(h => field === 'unitPrice' ? Number(h.unitPrice) : (Number(h.performance) || 0)).filter(v => v > 0);
    if (values.length === 0) return;

    const avg = values.reduce((acc, curr) => acc + curr, 0) / values.length;
    const userVal = Number(item[field]);
    if (isNaN(userVal) || avg === 0) return;

    const deviation = Math.abs(userVal - avg) / avg;
    if (deviation > 0.25) {
      setActiveAlert({ itemId: item.id, field, avgValue: avg, reasoning: 'Analizando...', isLoading: true });
      const reasoning = await getDeviationReasoning(category, item.description, userVal, avg, field === 'unitPrice' ? 'precio' : 'rendimiento');
      setActiveAlert(prev => prev ? { ...prev, reasoning, isLoading: false } : null);
    }
  };

  const isLabor = category === ItemCategory.MANO_DE_OBRA;

  return (
    <div className="overflow-visible" ref={containerRef}>
      <div className="flex justify-between items-center mb-4 px-1">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Desglose de {category}</h4>
      </div>

      <table className="w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">
            <th className="pb-1 pl-4">Recurso</th>
            <th className="pb-1 text-center w-20">Unid.</th>
            <th className="pb-1 text-right w-36">
              <div className="flex items-center justify-end gap-1">
                <span>{isLabor ? 'Rend.' : 'Cant.'}</span>
                <span className="relative group inline-flex">
                  <HelpCircle className="w-3 h-3 text-slate-300 cursor-help" />
                  <span className="pointer-events-none absolute right-0 top-5 z-[120] hidden w-48 rounded-xl bg-[#004071] px-3 py-2 text-[9px] font-bold normal-case tracking-normal text-white shadow-xl group-hover:block">
                    Use coma para decimales. Ej: 1,25
                  </span>
                </span>
              </div>
            </th>
            <th className="pb-1 text-right w-40">P. Unit. ($)</th>
            <th className="pb-1 text-right w-32 pr-4">Total</th>
            <th className="pb-1 w-20"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id} className="group bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <td className="py-3 pl-4 relative">
                <input
                  type="text"
                  value={item.description || ''}
                  onChange={e => {
                    updateItem(idx, 'description', e.target.value);
                    setShowHistoryForIdx(e.target.value.length > 0 ? idx : null);
                  }}
                  onFocus={() => item.description && setShowHistoryForIdx(idx)}
                  onBlur={() => handleBlurItem(idx)}
                  className={`w-full bg-transparent rounded-lg focus:ring-0 text-sm font-bold text-slate-700 ${emptyFieldClass(!item.description)}`}
                  placeholder="Descripción..."
                />
                {showHistoryForIdx === idx && filteredHistory.length > 0 && (
                  <div className="absolute z-[100] left-0 top-full mt-2 w-full min-w-[320px] bg-white border border-slate-200 shadow-2xl rounded-[1.5rem] p-3">
                    {filteredHistory.map((h, hIdx) => (
                      <button
                        key={`${h.description}-${hIdx}`}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          const newItems = [...items];
                          const quantity = category === ItemCategory.MANO_DE_OBRA ? 1 : (newItems[idx].quantity || 1);
                          const performance = category === ItemCategory.MANO_DE_OBRA ? (h.performance || 1) : 1;
                          newItems[idx] = {
                            ...newItems[idx],
                            description: h.description,
                            unit: h.unit,
                            unitPrice: h.unitPrice,
                            quantity,
                            performance,
                            total: category === ItemCategory.MANO_DE_OBRA ? performance * h.unitPrice : quantity * h.unitPrice
                          };
                          onChange(newItems);
                          setShowHistoryForIdx(null);
                        }}
                        className="w-full text-left px-4 py-3 rounded-xl hover:bg-[#004071] hover:text-white flex justify-between items-center"
                      >
                        <span className="font-bold text-xs">{h.description}</span>
                        <span className="font-mono text-[10px]">${(Number(h.unitPrice) || 0).toLocaleString('es-CL')}</span>
                      </button>
                    ))}
                  </div>
                )}
              </td>
              <td><input type="text" value={formatUnit(item.unit || '')} onChange={e => updateItem(idx, 'unit', e.target.value)} className={`w-full text-center bg-transparent rounded-lg text-xs font-bold text-slate-400 uppercase ${emptyFieldClass(!item.unit)}`} /></td>
              <td className="px-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={focusedCell === `${item.id}:amount`
                    ? (editingValues[`${item.id}:amount`] ?? '')
                    : formatDecimalInput(Number(isLabor ? item.performance : item.quantity) || 0)}
                  onChange={e => updateEditingValue(`${item.id}:amount`, e.target.value, idx, isLabor ? 'performance' : 'quantity')}
                  onFocus={() => {
                    setFocusedCell(`${item.id}:amount`);
                    setEditingValues(prev => ({ ...prev, [`${item.id}:amount`]: '' }));
                  }}
                  onBlur={() => { clearEditingValue(`${item.id}:amount`); setFocusedCell(null); checkDeviation(item, 'performance'); handleBlurItem(idx); }}
                  className={`w-full text-right bg-transparent rounded-lg font-mono text-sm font-black text-[#88C13E] ${emptyFieldClass((Number(isLabor ? item.performance : item.quantity) || 0) === 0)}`}
                />
              </td>
              <td className="px-2">
                <div className="flex items-center justify-end gap-1 px-2 py-1 bg-slate-50/50 rounded-lg group-hover:bg-white transition-colors border border-transparent group-hover:border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={focusedCell === `${item.id}:unitPrice`
                      ? (editingValues[`${item.id}:unitPrice`] ?? '')
                      : formatThousands(Number(item.unitPrice) || 0)}
                    onChange={e => updateEditingValue(`${item.id}:unitPrice`, e.target.value, idx, 'unitPrice')}
                    onFocus={() => {
                      setFocusedCell(`${item.id}:unitPrice`);
                      setEditingValues(prev => ({ ...prev, [`${item.id}:unitPrice`]: '' }));
                    }}
                    onBlur={() => { clearEditingValue(`${item.id}:unitPrice`); setFocusedCell(null); checkDeviation(item, 'unitPrice'); handleBlurItem(idx); }}
                    className="w-full text-right bg-transparent border-none focus:ring-0 font-mono text-sm font-black text-slate-600 p-0"
                  />
                  <button
                    type="button"
                    onClick={() => handleGeneratePrice(item, idx)}
                    disabled={loadingPriceItemIds[item.id]}
                    title="Obtener precio sugerido por IA y Web"
                    className="p-1 text-slate-300 hover:text-[#004071] transition-colors rounded disabled:opacity-50"
                  >
                    {loadingPriceItemIds[item.id] ? (
                      <Loader2 className="w-3 h-3 animate-spin text-[#004071]" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-[#88C13E]" />
                    )}
                  </button>
                </div>
              </td>
              <td className="text-right pr-4 font-mono text-sm font-black text-[#004071]">${formatThousands(Number(item.total) || 0)}</td>
              <td>
                <div className="flex items-center gap-1 justify-end pr-2">
                  <button
                    type="button"
                    onClick={() => handleCopyItem(item)}
                    title="Copiar recurso"
                    className="p-1 text-slate-200 hover:text-[#004071] transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button onClick={() => onChange(items.filter(i => i.id !== item.id))} className="p-1 text-slate-200 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-3 mt-4">
        <button
          onClick={() => onChange([...items, { id: crypto.randomUUID(), description: '', unit: '', quantity: 1, performance: 1, unitPrice: 0, total: 0 }])}
          className="flex-1 py-4 border-2 border-dashed border-slate-100 hover:border-slate-300 hover:text-[#004071] transition-all rounded-[1.5rem] text-slate-300 font-black text-[10px] uppercase flex items-center justify-center gap-3"
        >
          <Plus className="w-3 h-3" /> Añadir recurso
        </button>
        <button
          type="button"
          onClick={() => setShowBulkPaste(true)}
          className="px-6 py-4 border-2 border-dashed border-slate-100 hover:border-slate-300 hover:text-[#004071] transition-all rounded-[1.5rem] text-slate-300 font-black text-[10px] uppercase flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Pegar recursos desde Excel"
        >
          <ClipboardPaste className="w-4 h-4 text-[#88C13E]" /> Pegar recursos
        </button>
        {hasCopiedItem && (
          <button
            type="button"
            onClick={handlePasteItem}
            className="px-4 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all rounded-[1.5rem] font-black text-[10px] uppercase flex items-center justify-center gap-2"
            title="Pegar recurso copiado"
          >
            <Copy className="w-4 h-4" /> 1 recurso
          </button>
        )}
      </div>
      {showBulkPaste && (
        <div className="fixed inset-0 z-[80] bg-[#004071]/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="px-7 py-5 bg-slate-50 border-b flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-[#004071] uppercase tracking-widest">Pegar recursos desde Excel</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Formato: Recurso; unidad; cantidad; precio</p>
              </div>
              <button onClick={() => setShowBulkPaste(false)} className="p-2 hover:bg-slate-200 rounded-full">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="p-7 space-y-5">
              <textarea
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                rows={10}
                autoFocus
                placeholder={`Excavación manual; m3; 1,25; 18500\nRetiro de excedentes; m3; 1; 12000`}
                className="w-full rounded-2xl border-2 border-slate-100 focus:border-[#004071] outline-none p-5 font-mono text-xs text-slate-700"
              />
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowBulkPaste(false)} className="px-5 py-3 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  Cancelar
                </button>
                <button onClick={handleBulkPaste} className="px-5 py-3 rounded-xl bg-[#88C13E] text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <Check className="w-4 h-4" /> Pegar filas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SectionTable;