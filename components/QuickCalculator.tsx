import React, { useEffect, useRef, useState } from 'react';
import { Calculator, Copy, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { evaluateExpression } from '../lib/formula';
import { formatNumber } from '../lib/number';

interface TapeEntry { expr: string; result: number }

const KEYS = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', ',', '(', '+', ')', '%', '^', '='];

const QuickCalculator: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState('');
  const [tape, setTape] = useState<TapeEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const preview = evaluateExpression(expr);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputRef.current?.focus());
    const onDown = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  const commit = () => {
    if (preview === null) { if (expr.trim()) toast.error('Expresión no válida'); return; }
    setTape(t => [{ expr, result: preview }, ...t].slice(0, 30));
    setExpr(String(Math.round(preview * 1e8) / 1e8).replace('.', ','));
  };

  const copy = (n: number) => {
    const txt = String(Math.round(n * 1e6) / 1e6).replace('.', ',');
    navigator.clipboard?.writeText(txt).then(() => toast.success(`Copiado: ${txt}`)).catch(() => toast.error('No se pudo copiar'));
  };

  const press = (k: string) => {
    if (k === '=') { commit(); return; }
    setExpr(e => e + k);
    inputRef.current?.focus();
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Calculadora rápida"
        className={`p-2 rounded-xl transition-all ${open ? 'bg-[#004071] text-white' : 'text-slate-400 hover:text-[#004071] hover:bg-slate-100'}`}
      >
        <Calculator className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Calculadora rápida</span>
            <button onClick={() => setOpen(false)} className="p-1 text-slate-300 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
          </div>
          <input
            ref={inputRef}
            value={expr}
            onChange={e => setExpr(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
            placeholder="Ej: 1.250.000 / 36 · (12,5+3)*2 · 850*1,19"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-mono text-sm text-slate-700 outline-none focus:border-[#004071]"
          />
          <div className="flex items-center justify-between bg-[#004071] rounded-xl px-3 py-2.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/60">=</span>
            <button
              onClick={() => preview !== null && copy(preview)}
              title="Copiar resultado"
              className="flex items-center gap-2 font-mono text-lg font-black text-[#D9E021]"
            >
              {preview !== null ? formatNumber(preview, 0, 6) : '—'}
              {preview !== null && <Copy className="w-3.5 h-3.5 text-white/50" />}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {KEYS.map(k => (
              <button key={k} onClick={() => press(k)} className={`py-2 rounded-lg font-mono text-sm font-black transition-colors ${k === '=' ? 'bg-[#88C13E] text-white hover:bg-[#76a935]' : /[\d,]/.test(k) ? 'bg-slate-50 text-slate-700 hover:bg-slate-100' : 'bg-slate-100 text-[#004071] hover:bg-slate-200'}`}>{k === '*' ? '×' : k === '/' ? '÷' : k}</button>
            ))}
            <button onClick={() => setExpr('')} className="col-span-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-slate-200">Limpiar</button>
          </div>
          {tape.length > 0 && (
            <div className="border-t border-slate-100 pt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Historial</span>
                <button onClick={() => setTape([])} className="p-1 text-slate-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-0.5">
                {tape.map((t, i) => (
                  <button key={i} onClick={() => setExpr(t.expr)} className="w-full flex justify-between gap-3 text-[10px] px-2 py-1 rounded hover:bg-slate-50 font-mono">
                    <span className="text-slate-400 truncate">{t.expr}</span>
                    <span className="text-[#004071] font-bold shrink-0" onClick={e => { e.stopPropagation(); copy(t.result); }} title="Copiar">{formatNumber(t.result, 0, 6)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="text-[8px] text-slate-400 leading-snug">Decimal con "," o "."; miles con "." (1.250.000). Enter guarda en historial; clic en el resultado lo copia.</p>
        </div>
      )}
    </div>
  );
};

export default QuickCalculator;
