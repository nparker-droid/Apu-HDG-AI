import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, Search, Check, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import { APU, Chapter, ItemCategory, Project } from '../types';
import { CATEGORIES, computeItemTotal, itemAmount, calculateApuTotals } from '../lib/apuCalculations';
import { formatCLP, formatNumber } from '../lib/number';
import { formatUnit } from '../services/exportService';
import NumberInput from './ui/NumberInput';

interface Props {
  project: Project;
  chapters: Chapter[];
  apus: APU[];
  onUpdateApus: (updated: APU[]) => void;
  onOpenApu: (apuId: string) => void;
}

interface Occurrence {
  apu: APU;
  itemId: string;
  description: string;
  unit: string;
  amount: number;
  unitPrice: number;
  note?: string;
  /** Costo directo del recurso en el proyecto (sin LS/GG/Util) */
  projectCost: number;
}

interface Group {
  key: string;
  description: string;
  units: string[];
  prices: number[];
  occurrences: Occurrence[];
  min: number; max: number; weightedAvg: number;
  totalCost: number;
  hasPriceDiff: boolean;
  hasUnitDiff: boolean;
}

const normKey = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Clave de ocurrencia (APU + recurso): los ítems duplicados vía "Duplicar APU" conservan su itemId original. */
const occKey = (apuId: string, itemId: string) => `${apuId}::${itemId}`;

const ResourceSummary: React.FC<Props> = ({ project, chapters, apus, onUpdateApus, onOpenApu }) => {
  const [category, setCategory] = useState<ItemCategory>(ItemCategory.MANO_DE_OBRA);
  const [search, setSearch] = useState('');
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [unifyPrice, setUnifyPrice] = useState<Record<string, number>>({});

  const projectApus = useMemo(() => apus.filter(a => a.projectId === project.id), [apus, project.id]);
  const chapterOrder = useMemo(() => new Map(chapters.filter(c => c.projectId === project.id).map((c, i) => [c.id, i])), [chapters, project.id]);

  const groupsByCat = useMemo(() => {
    const result = {} as Record<ItemCategory, Group[]>;
    CATEGORIES.forEach(cat => {
      const map = new Map<string, Occurrence[]>();
      projectApus.forEach(apu => {
        const divisor = apu.divideUnitPrice && (apu.divisorQuantity || 0) > 0 ? apu.divisorQuantity! : 1;
        (apu.items?.[cat] ?? []).forEach(it => {
          if (!it.description?.trim()) return;
          const key = normKey(it.description);
          const occ: Occurrence = {
            apu, itemId: it.id, description: it.description, unit: it.unit || '',
            amount: itemAmount(cat, it), unitPrice: Number(it.unitPrice) || 0, note: it.note,
            projectCost: (Number(it.total) || 0) * (Number(apu.quantity) || 0) / divisor
          };
          map.set(key, [...(map.get(key) || []), occ]);
        });
      });
      result[cat] = Array.from(map.entries()).map(([key, occ]) => {
        const prices = Array.from(new Set(occ.map(o => o.unitPrice)));
        const units = Array.from(new Set(occ.map(o => formatUnit(o.unit).toLowerCase().trim())));
        const totalAmt = occ.reduce((s, o) => s + o.amount * (Number(o.apu.quantity) || 0), 0);
        const totalCost = occ.reduce((s, o) => s + o.projectCost, 0);
        const min = Math.min(...occ.map(o => o.unitPrice));
        const max = Math.max(...occ.map(o => o.unitPrice));
        const weightedAvg = totalAmt > 0 ? occ.reduce((s, o) => s + o.unitPrice * o.amount * (Number(o.apu.quantity) || 0), 0) / totalAmt : occ.reduce((s, o) => s + o.unitPrice, 0) / occ.length;
        occ.sort((a, b) => (chapterOrder.get(a.apu.chapterId) ?? 0) - (chapterOrder.get(b.apu.chapterId) ?? 0) || a.apu.code.localeCompare(b.apu.code, 'es', { numeric: true }));
        return {
          key, description: occ[0].description, units: units.map(u => u || '—'), prices, occurrences: occ,
          min, max, weightedAvg, totalCost,
          hasPriceDiff: prices.length > 1, hasUnitDiff: units.length > 1
        };
      }).sort((a, b) => a.description.localeCompare(b.description, 'es'));
    });
    return result;
  }, [projectApus, chapterOrder]);

  const groups = groupsByCat[category].filter(g =>
    (!onlyDiff || g.hasPriceDiff || g.hasUnitDiff) &&
    (!search || normKey(g.description).includes(normKey(search)))
  );

  const catTotal = groupsByCat[category].reduce((s, g) => s + g.totalCost, 0);
  const diffCount = (cat: ItemCategory) => groupsByCat[cat].filter(g => g.hasPriceDiff || g.hasUnitDiff).length;

  const projectDirectCost = useMemo(() => projectApus.reduce((s, a) => {
    const t = calculateApuTotals(a, project);
    const divisor = a.divideUnitPrice && (a.divisorQuantity || 0) > 0 ? a.divisorQuantity! : 1;
    return s + (t.costoDirecto / divisor) * (Number(a.quantity) || 0);
  }, 0), [projectApus, project]);

  /** Aplica cambios a todas (o algunas) ocurrencias del grupo. Cada ocurrencia se identifica por APU+recurso,
   *  porque "Duplicar APU" clona los ítems conservando su itemId original. */
  const applyToGroup = (g: Group, patch: { unitPrice?: number; unit?: string; description?: string }, onlyOccurrenceKeys?: Set<string>) => {
    const affected = new Set(g.occurrences.map(o => o.apu.id));
    const keys = onlyOccurrenceKeys || new Set(g.occurrences.map(o => occKey(o.apu.id, o.itemId)));
    const updated = projectApus.filter(a => affected.has(a.id)).map(a => ({
      ...a,
      items: {
        ...a.items,
        [category]: (a.items[category] ?? []).map(it => {
          if (!keys.has(occKey(a.id, it.id))) return it;
          const n = { ...it, ...patch };
          n.total = computeItemTotal(category, n);
          return n;
        })
      }
    }));
    onUpdateApus(updated);
    return updated.length;
  };

  const unify = (g: Group) => {
    const price = unifyPrice[g.key] ?? Math.round(g.weightedAvg);
    const n = applyToGroup(g, { unitPrice: price });
    toast.success(`Precio unificado en ${formatCLP(price)} para "${g.description}" (${g.occurrences.length} línea(s) en ${n} partida(s))`);
  };

  const amountLabel = category === ItemCategory.MANO_DE_OBRA ? 'Rend.' : 'Cant.';

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {CATEGORIES.map(cat => {
          const total = groupsByCat[cat].reduce((s, g) => s + g.totalCost, 0);
          const pct = projectDirectCost > 0 ? total / projectDirectCost * 100 : 0;
          return (
            <button key={cat} onClick={() => setCategory(cat)} className={`text-left p-4 rounded-2xl border transition-all ${category === cat ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white border-border hover:border-muted-light'}`}>
              <p className={`text-[9px] font-bold uppercase tracking-widest ${category === cat ? 'text-white/70' : 'text-muted'}`}>{cat}</p>
              <p className="text-lg font-bold font-mono mt-1">{formatCLP(total)}</p>
              <div className={`flex justify-between text-[9px] font-bold mt-1 ${category === cat ? 'text-white/60' : 'text-muted'}`}>
                <span>{groupsByCat[cat].length} recursos · {formatNumber(pct, 1, 1)}% CD</span>
                {diffCount(cat) > 0 && <span className={category === cat ? 'text-amber-300' : 'text-status-amber'}>{diffCount(cat)} con diferencias</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border bg-sidebar/50 flex flex-wrap gap-4 justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-brand-blue uppercase tracking-tighter">Resumen de {category}</h3>
            <p className="text-[9px] font-bold text-muted uppercase tracking-widest mt-1">
              Costo directo en proyecto (Σ línea × cant. partida){category === ItemCategory.MANO_DE_OBRA ? ', sin leyes sociales' : ''}: {formatCLP(catTotal)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-muted-dark cursor-pointer">
              <input type="checkbox" checked={onlyDiff} onChange={e => setOnlyDiff(e.target.checked)} className="accent-brand-blue" /> Solo con diferencias
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-light" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar recurso…" className="pl-8 pr-3 py-2 rounded-xl border border-border text-xs outline-none focus:border-brand-blue w-56" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sidebar/50 text-[9px] font-bold text-muted uppercase tracking-widest">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3">Recurso</th>
                <th className="px-4 py-3 text-center">Unid.</th>
                <th className="px-4 py-3 text-center">Usos</th>
                <th className="px-4 py-3 text-right">P. Unit. mín – máx</th>
                <th className="px-4 py-3 text-right">Prom. pond.</th>
                <th className="px-4 py-3 text-right">Costo en proyecto</th>
                <th className="px-4 py-3 text-right">Unificar precio</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 && (
                <tr><td colSpan={8} className="px-8 py-10 text-center text-xs text-muted italic">Sin recursos {onlyDiff ? 'con diferencias ' : ''}en esta categoría.</td></tr>
              )}
              {groups.map(g => {
                const isOpen = !!expanded[g.key];
                const diff = g.hasPriceDiff || g.hasUnitDiff;
                return (
                  <React.Fragment key={g.key}>
                    <tr className={`border-b border-border hover:bg-sidebar/50 ${diff ? 'bg-status-amber/5' : ''}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => setExpanded(p => ({ ...p, [g.key]: !isOpen }))} className="text-muted hover:text-brand-blue">
                          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-ink">
                        <div className="flex items-center gap-2">
                          {diff && <span title={`${g.hasPriceDiff ? 'Precios distintos' : ''}${g.hasPriceDiff && g.hasUnitDiff ? ' y ' : ''}${g.hasUnitDiff ? 'unidades distintas' : ''}`}><AlertTriangle className="w-3.5 h-3.5 text-status-amber" /></span>}
                          {g.description}
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-[10px] text-center ${g.hasUnitDiff ? 'text-status-amber font-bold' : 'text-muted-dark'}`}>{g.units.join(' / ')}</td>
                      <td className="px-4 py-3 text-[10px] text-center text-muted-dark font-mono">{g.occurrences.length}</td>
                      <td className={`px-4 py-3 text-[10px] text-right font-mono ${g.hasPriceDiff ? 'text-status-amber font-bold' : 'text-muted-dark'}`}>
                        {g.hasPriceDiff ? `${formatCLP(g.min)} – ${formatCLP(g.max)}` : formatCLP(g.min)}
                        {g.hasPriceDiff && g.min > 0 && <span className="block text-[9px] font-bold">Δ {formatNumber((g.max / g.min - 1) * 100, 0, 1)}%</span>}
                      </td>
                      <td className="px-4 py-3 text-[10px] text-right font-mono text-muted-dark">{formatCLP(g.weightedAvg)}</td>
                      <td className="px-4 py-3 text-xs text-right font-mono font-bold text-ink">{formatCLP(g.totalCost)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-[10px] text-muted">$</span>
                          <NumberInput
                            mode="money"
                            maxDecimals={2}
                            value={unifyPrice[g.key] ?? Math.round(g.hasPriceDiff ? g.weightedAvg : g.min)}
                            onValueChange={v => setUnifyPrice(p => ({ ...p, [g.key]: v }))}
                            className="w-24 text-right font-mono text-xs font-bold text-brand-blue bg-sidebar border border-border rounded-lg px-2 py-1 outline-none focus:border-brand-blue"
                          />
                          <button onClick={() => unify(g)} title="Aplicar este precio a todas las líneas del recurso" className="p-1.5 rounded-lg bg-brand-green text-white hover:bg-brand-green-dark"><Check className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && g.occurrences.map(o => (
                      <tr key={o.itemId} className="bg-sidebar/60 border-b border-border text-[10px]">
                        <td></td>
                        <td className="px-4 py-2 text-muted-dark">
                          <button onClick={() => onOpenApu(o.apu.id)} className="hover:text-brand-blue hover:underline text-left">
                            <span className="font-mono font-bold mr-2">{o.apu.code}</span>{o.apu.name}
                          </button>
                          {o.note && <span className="flex items-center gap-1 text-status-amber mt-0.5"><StickyNote className="w-3 h-3" /> {o.note}</span>}
                        </td>
                        <td className="px-4 py-2 text-center text-muted-dark">{formatUnit(o.unit) || '—'}</td>
                        <td className="px-4 py-2 text-center font-mono text-muted" title={amountLabel}>{formatNumber(o.amount, 0, 4)}</td>
                        <td className="px-4 py-2 text-right">
                          <NumberInput
                            mode="money"
                            maxDecimals={2}
                            value={o.unitPrice}
                            onValueChange={v => applyToGroup(g, { unitPrice: v }, new Set([occKey(o.apu.id, o.itemId)]))}
                            className={`w-24 text-right font-mono text-[10px] font-bold bg-white border rounded-lg px-2 py-1 outline-none focus:border-brand-blue ${g.hasPriceDiff && o.unitPrice !== g.max ? 'text-muted-dark border-border' : g.hasPriceDiff ? 'text-status-amber border-status-amber/40' : 'text-muted-dark border-border'}`}
                          />
                        </td>
                        <td></td>
                        <td className="px-4 py-2 text-right font-mono text-muted-dark">{formatCLP(o.projectCost)}</td>
                        <td></td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ResourceSummary;
