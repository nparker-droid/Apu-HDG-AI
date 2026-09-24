import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, Undo2, FileSpreadsheet, Info } from 'lucide-react';
import { toast } from 'sonner';
import { ProjectSheet as SheetData, Project } from '../types';
import { evaluate, CellValue, indexToCol, makeRef } from '../lib/formula';
import { formatNumber, parseNumber } from '../lib/number';
import { saveBlobWithPicker } from '../services/fileSaveService';

const COLS = 26;
const ROWS = 200;
const DEFAULT_W = 110;
const ROW_H = 26;

type Pos = { r: number; c: number };

const isNumericText = (s: string) => /^-?\$?\s*[\d.,]+\s*%?$/.test(s.trim()) && /\d/.test(s);

const parseRaw = (raw: string): CellValue => {
  const t = raw.trim();
  if (!t) return '';
  if (isNumericText(t)) {
    const pct = t.endsWith('%');
    const n = parseNumber(t.replace('%', ''), 'money');
    return pct ? n / 100 : n;
  }
  return raw;
};

interface Props {
  project: Project;
  sheet: SheetData;
  onChange: (sheet: SheetData) => void;
}

const ProjectSheet: React.FC<Props> = ({ project, sheet, onChange }) => {
  const cells = sheet.cells || {};
  const colWidths = sheet.colWidths || {};
  const [active, setActive] = useState<Pos>({ r: 0, c: 0 });
  const [anchor, setAnchor] = useState<Pos>({ r: 0, c: 0 });
  const [editing, setEditing] = useState<string | null>(null); // texto en edición (null = no edita)
  const [dragging, setDragging] = useState(false);
  const undoStack = useRef<Record<string, string>[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLInputElement>(null);

  // ---------- Evaluación ----------
  const values = useMemo(() => {
    const cache = new Map<string, CellValue | Error>();
    const visiting = new Set<string>();
    const get = (ref: string): CellValue => {
      if (cache.has(ref)) { const v = cache.get(ref)!; if (v instanceof Error) throw v; return v; }
      const raw = cells[ref] ?? '';
      let v: CellValue | Error;
      if (raw.startsWith('=')) {
        if (visiting.has(ref)) throw new Error('#CICLO!');
        visiting.add(ref);
        try { v = evaluate(raw.slice(1), get); } catch (e: any) { v = new Error(e?.message || '#ERROR'); }
        visiting.delete(ref);
      } else v = parseRaw(raw);
      cache.set(ref, v);
      if (v instanceof Error) throw v;
      return v;
    };
    const out: Record<string, { v: CellValue; err?: string }> = {};
    Object.keys(cells).forEach(ref => {
      try { out[ref] = { v: get(ref) }; } catch (e: any) { out[ref] = { v: '', err: e?.message || '#ERROR' }; }
    });
    return out;
  }, [cells]);

  const display = (ref: string) => {
    const e = values[ref];
    if (!e) return { text: '', num: false, err: false };
    if (e.err) return { text: e.err, num: false, err: true };
    if (typeof e.v === 'number') return { text: formatNumber(e.v, 0, 4), num: true, err: false };
    return { text: String(e.v), num: false, err: false };
  };

  // ---------- Mutaciones ----------
  const commitCells = useCallback((patch: Record<string, string>) => {
    undoStack.current.push({ ...cells });
    if (undoStack.current.length > 60) undoStack.current.shift();
    const next = { ...cells };
    Object.entries(patch).forEach(([k, v]) => { if (v === '' || v === undefined) delete next[k]; else next[k] = v; });
    onChange({ ...sheet, cells: next });
  }, [cells, sheet, onChange]);

  const undo = () => {
    const prev = undoStack.current.pop();
    if (prev) onChange({ ...sheet, cells: prev });
  };

  const selRange = useMemo(() => ({
    r1: Math.min(anchor.r, active.r), r2: Math.max(anchor.r, active.r),
    c1: Math.min(anchor.c, active.c), c2: Math.max(anchor.c, active.c)
  }), [anchor, active]);

  const inSel = (r: number, c: number) => r >= selRange.r1 && r <= selRange.r2 && c >= selRange.c1 && c <= selRange.c2;

  const move = (dr: number, dc: number, extend = false) => {
    const next = { r: Math.max(0, Math.min(ROWS - 1, active.r + dr)), c: Math.max(0, Math.min(COLS - 1, active.c + dc)) };
    setActive(next);
    if (!extend) setAnchor(next);
    requestAnimationFrame(() => {
      const el = gridRef.current?.querySelector(`[data-cell="${makeRef(next.c, next.r)}"]`) as HTMLElement | null;
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  };

  const startEdit = (initial?: string) => {
    const ref = makeRef(active.c, active.r);
    setEditing(initial !== undefined ? initial : (cells[ref] ?? ''));
    requestAnimationFrame(() => editorRef.current?.focus());
  };

  const finishingRef = useRef(false);
  const finishEdit = (save: boolean, dr = 0, dc = 0) => {
    if (editing === null || finishingRef.current) return;
    finishingRef.current = true;
    requestAnimationFrame(() => { finishingRef.current = false; });
    if (save) {
      const ref = makeRef(active.c, active.r);
      if ((cells[ref] ?? '') !== editing) commitCells({ [ref]: editing });
    }
    setEditing(null);
    gridRef.current?.focus();
    if (dr || dc) move(dr, dc);
  };

  // ---------- Portapapeles ----------
  const selectionToTSV = () => {
    const lines: string[] = [];
    for (let r = selRange.r1; r <= selRange.r2; r++) {
      const row: string[] = [];
      for (let c = selRange.c1; c <= selRange.c2; c++) {
        const ref = makeRef(c, r);
        const e = values[ref];
        if (!e || e.err) row.push(e?.err || '');
        else if (typeof e.v === 'number') row.push(String(Math.round(e.v * 1e6) / 1e6).replace('.', ','));
        else row.push(String(e.v));
      }
      lines.push(row.join('\t'));
    }
    return lines.join('\n');
  };

  const clearSelection = () => {
    const patch: Record<string, string> = {};
    for (let r = selRange.r1; r <= selRange.r2; r++) for (let c = selRange.c1; c <= selRange.c2; c++) patch[makeRef(c, r)] = '';
    commitCells(patch);
  };

  const onCopy = (e: React.ClipboardEvent, cut = false) => {
    if (editing !== null) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', selectionToTSV());
    if (cut) clearSelection();
  };

  const onPaste = (e: React.ClipboardEvent) => {
    if (editing !== null) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    const rows = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(l => l.split('\t'));
    const patch: Record<string, string> = {};
    rows.forEach((row, i) => row.forEach((val, j) => {
      const r = active.r + i, c = active.c + j;
      if (r < ROWS && c < COLS) patch[makeRef(c, r)] = val;
    }));
    commitCells(patch);
    setAnchor(active);
    setActive({ r: Math.min(ROWS - 1, active.r + rows.length - 1), c: Math.min(COLS - 1, active.c + Math.max(...rows.map(r => r.length)) - 1) });
    toast.success(`${rows.length} fila(s) pegadas`);
  };

  // ---------- Teclado ----------
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editing !== null) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); setAnchor({ r: 0, c: 0 }); setActive({ r: ROWS - 1, c: COLS - 1 }); return; }
    if (mod) return; // deja pasar copiar/pegar nativos
    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); move(-1, 0, e.shiftKey); return;
      case 'ArrowDown': e.preventDefault(); move(1, 0, e.shiftKey); return;
      case 'ArrowLeft': e.preventDefault(); move(0, -1, e.shiftKey); return;
      case 'ArrowRight': e.preventDefault(); move(0, 1, e.shiftKey); return;
      case 'Tab': e.preventDefault(); move(0, e.shiftKey ? -1 : 1); return;
      case 'Enter': case 'F2': e.preventDefault(); startEdit(); return;
      case 'Delete': case 'Backspace': e.preventDefault(); clearSelection(); return;
    }
    if (e.key.length === 1 && !e.altKey) { e.preventDefault(); startEdit(e.key); }
  };

  // ---------- Redimensionar columnas ----------
  const resizeRef = useRef<{ c: number; x: number; w: number } | null>(null);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const st = resizeRef.current; if (!st) return;
      const w = Math.max(50, st.w + e.clientX - st.x);
      onChange({ ...sheet, colWidths: { ...colWidths, [st.c]: w } });
    };
    const onUp = () => { resizeRef.current = null; setDragging(false); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [sheet, colWidths, onChange]);

  const exportXlsx = async () => {
    const XLSX = (window as any).XLSX;
    if (!XLSX) { toast.error('Librería Excel no disponible'); return; }
    const ws: any = {};
    let maxR = 0, maxC = 0;
    Object.keys(cells).forEach(ref => {
      const m = /^([A-Z]+)(\d+)$/.exec(ref); if (!m) return;
      const raw = cells[ref]; const val = values[ref];
      const cell: any = {};
      if (raw.startsWith('=')) {
        // Fórmula Excel: separador ';' → ',' y decimales ',' → '.' dentro de números
        cell.f = raw.slice(1).replace(/(\d),(\d)/g, '$1.$2').replace(/;/g, ',')
          .replace(/\bSUMA\(/gi, 'SUM(').replace(/\bPROMEDIO\(/gi, 'AVERAGE(').replace(/\bREDONDEAR\(/gi, 'ROUND(')
          .replace(/\bRAIZ\(/gi, 'SQRT(').replace(/\bCONTAR\(/gi, 'COUNT(').replace(/\bSI\(/gi, 'IF(').replace(/\bPOTENCIA\(/gi, 'POWER(');
      }
      if (val && typeof val.v === 'number') { cell.t = 'n'; cell.v = val.v; }
      else { cell.t = 's'; cell.v = val?.err || String(val?.v ?? raw); }
      ws[ref] = cell;
      const pr = XLSX.utils.decode_cell(ref); maxR = Math.max(maxR, pr.r); maxC = Math.max(maxC, pr.c);
    });
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
    ws['!cols'] = Array.from({ length: maxC + 1 }, (_, i) => ({ wpx: colWidths[i] || DEFAULT_W }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cálculos');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    try {
      await saveBlobWithPicker(new Blob([buf]), `HDG_CALCULOS_${project.code}.xlsx`, 'Excel', { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] });
    } catch { /* cancelado */ }
  };

  const activeRef = makeRef(active.c, active.r);
  const activeDisplay = display(activeRef);
  const selSum = useMemo(() => {
    if (selRange.r1 === selRange.r2 && selRange.c1 === selRange.c2) return null;
    let sum = 0, count = 0;
    for (let r = selRange.r1; r <= selRange.r2; r++) for (let c = selRange.c1; c <= selRange.c2; c++) {
      const v = values[makeRef(c, r)]; if (v && !v.err && typeof v.v === 'number') { sum += v.v; count++; }
    }
    return count ? { sum, count, avg: sum / count } : null;
  }, [selRange, values]);

  return (
    <div className="max-w-full space-y-3 animate-in fade-in duration-500 pb-10">
      <div className="bg-white rounded-2xl border border-border shadow-sm p-3 flex flex-wrap items-center gap-3">
        <span className="font-mono text-[11px] font-bold text-brand-blue bg-sidebar rounded-lg px-3 py-2 w-16 text-center">{activeRef}</span>
        <span className="text-muted-light font-bold italic text-sm">fx</span>
        <input
          value={editing !== null ? editing : (cells[activeRef] ?? '')}
          onFocus={() => { if (editing === null) setEditing(cells[activeRef] ?? ''); }}
          onChange={e => setEditing(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); finishEdit(true, 1, 0); }
            else if (e.key === 'Tab') { e.preventDefault(); finishEdit(true, 0, e.shiftKey ? -1 : 1); }
            else if (e.key === 'Escape') { e.preventDefault(); finishEdit(false); }
          }}
          onBlur={() => finishEdit(true)}
          placeholder="Valor o fórmula (=A1*B1, =SUMA(A1:A10), =REDONDEAR(A1/3;2))"
          className="flex-1 min-w-[16rem] bg-sidebar border border-border rounded-lg px-3 py-2 font-mono text-xs text-ink outline-none focus:border-brand-blue"
        />
        <button onClick={undo} title="Deshacer (Ctrl+Z)" className="p-2 rounded-lg text-muted hover:bg-sidebar hover:text-brand-blue"><Undo2 className="w-4 h-4" /></button>
        <button onClick={exportXlsx} title="Exportar a Excel" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-green text-white text-[9px] font-bold uppercase tracking-widest hover:bg-brand-green-dark"><FileSpreadsheet className="w-3.5 h-3.5" /> Excel</button>
        <button
          onClick={() => { if (Object.keys(cells).length && window.confirm('¿Borrar todo el contenido de la hoja de cálculo?')) commitCells(Object.fromEntries(Object.keys(cells).map(k => [k, '']))); }}
          title="Limpiar hoja" className="p-2 rounded-lg text-muted-light hover:bg-status-red/10 hover:text-status-red"
        ><Trash2 className="w-4 h-4" /></button>
        <div className="relative group">
          <Info className="w-4 h-4 text-muted-light cursor-help" />
          <div className="absolute right-0 top-6 z-50 hidden group-hover:block w-80 bg-brand-blue text-white text-[10px] leading-relaxed rounded-xl p-3 shadow-sm">
            <p className="font-black uppercase tracking-widest mb-1">Uso rápido</p>
            <p>• Escriba directamente sobre la celda; Enter/Tab para confirmar, Esc para cancelar.</p>
            <p>• Copie/pegue tablas desde Excel (Ctrl+C / Ctrl+V). Suprimir borra la selección.</p>
            <p>• Fórmulas con "=": + - * / ^ %, SUMA, PROMEDIO, MIN, MAX, REDONDEAR, RAIZ, SI, CONTAR.</p>
            <p>• Separador de argumentos ";". Decimal con "," o "." ("1.500" se lee como mil quinientos).</p>
            <p>• Se guarda con el proyecto (local y respaldo Drive).</p>
          </div>
        </div>
      </div>

      <div
        ref={gridRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onCopy={e => onCopy(e)}
        onCut={e => onCopy(e, true)}
        onPaste={onPaste}
        onMouseUp={() => setDragging(false)}
        className={`bg-white rounded-2xl border border-border shadow-sm overflow-auto outline-none max-h-[calc(100vh-260px)] ${dragging ? 'select-none' : ''}`}
      >
        <table className="border-collapse text-[11px] select-none" style={{ tableLayout: 'fixed', width: 44 + Array.from({ length: COLS }, (_, c) => colWidths[c] || DEFAULT_W).reduce((a, b) => a + b, 0) }}>
          <colgroup>
            <col style={{ width: 44 }} />
            {Array.from({ length: COLS }, (_, c) => <col key={c} style={{ width: colWidths[c] || DEFAULT_W }} />)}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-30 bg-sidebar border border-border" />
              {Array.from({ length: COLS }, (_, c) => (
                <th key={c} className={`sticky top-0 z-20 border border-border font-bold text-[10px] relative ${c >= selRange.c1 && c <= selRange.c2 ? 'bg-brand-blue/10 text-brand-blue' : 'bg-sidebar text-muted-dark'}`} style={{ height: ROW_H }}>
                  {indexToCol(c)}
                  <span
                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); resizeRef.current = { c, x: e.clientX, w: colWidths[c] || DEFAULT_W }; setDragging(true); }}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-brand-green"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }, (_, r) => (
              <tr key={r} style={{ height: ROW_H }}>
                <td className={`sticky left-0 z-10 border border-border text-center font-bold text-[10px] ${r >= selRange.r1 && r <= selRange.r2 ? 'bg-brand-blue/10 text-brand-blue' : 'bg-sidebar text-muted'}`}>{r + 1}</td>
                {Array.from({ length: COLS }, (_, c) => {
                  const ref = makeRef(c, r);
                  const isActive = active.r === r && active.c === c;
                  const d = display(ref);
                  return (
                    <td
                      key={c}
                      data-cell={ref}
                      onMouseDown={e => {
                        if (editing !== null) finishEdit(true);
                        const pos = { r, c };
                        setActive(pos);
                        if (!e.shiftKey) setAnchor(pos);
                        setDragging(true);
                        gridRef.current?.focus();
                      }}
                      onMouseEnter={() => { if (dragging && !resizeRef.current) setActive({ r, c }); }}
                      onDoubleClick={() => startEdit()}
                      className={`border border-border px-1.5 overflow-hidden whitespace-nowrap text-ellipsis relative ${inSel(r, c) && !isActive ? 'bg-brand-blue/5' : ''} ${isActive ? 'outline outline-2 outline-brand-blue -outline-offset-1 z-[5]' : ''} ${d.num ? 'text-right font-mono text-ink' : 'text-left text-ink'} ${d.err ? 'text-status-red font-bold' : ''} ${(cells[ref] || '').startsWith('=') && !d.err ? 'text-brand-blue' : ''}`}
                    >
                      {isActive && editing !== null ? (
                        <input
                          ref={editorRef}
                          autoFocus
                          value={editing}
                          onChange={e => setEditing(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); finishEdit(true, e.shiftKey ? -1 : 1, 0); }
                            else if (e.key === 'Tab') { e.preventDefault(); finishEdit(true, 0, e.shiftKey ? -1 : 1); }
                            else if (e.key === 'Escape') { e.preventDefault(); finishEdit(false); }
                          }}
                          onBlur={() => finishEdit(true)}
                          className="absolute inset-0 w-full h-full px-1.5 font-mono text-[11px] bg-white outline-none"
                        />
                      ) : d.text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-4 text-[10px] font-bold text-muted uppercase tracking-widest px-2 min-h-[1rem]">
        {selSum && (<>
          <span>Recuento: {selSum.count}</span>
          <span>Promedio: {formatNumber(selSum.avg, 0, 4)}</span>
          <span className="text-brand-blue">Suma: {formatNumber(selSum.sum, 0, 4)}</span>
        </>)}
        {!selSum && activeDisplay.text && <span>{activeRef}: {activeDisplay.text}</span>}
      </div>
    </div>
  );
};

export default ProjectSheet;
