import { Project, Chapter, APU, ItemCategory } from '../types';
import { saveBlobWithPicker } from './fileSaveService';
import { calculateApuTotals, CATEGORIES, itemAmount } from '../lib/apuCalculations';
import { buildChapterOutline } from '../lib/chapters';

// Exportación Excel con FÓRMULAS (trazable): cada total de línea, subtotal, CD, GG, Utilidad y P.U.
// se calcula en la planilla; el presupuesto referencia el P.U. de cada hoja APU.
// Los valores calculados se escriben también como caché (v) para lectores sin motor de cálculo.

const XLSX = () => (window as any).XLSX;

const FMT_CLP = '#,##0';
const FMT_QTY = '#,##0.000';
const FMT_PCT = '0.00%';

const num = (v: number, z = FMT_CLP) => ({ t: 'n', v: Number(v) || 0, z });
const fx = (f: string, v: number, z = FMT_CLP) => ({ t: 'n', f, v: Number(v) || 0, z });
const str = (v: string) => ({ t: 's', v: v ?? '' });

const safeSheetName = (name: string, used: Set<string>) => {
  let base = (name || 'APU').replace(/[\\/?*[\]:]/g, ' ').trim().substring(0, 31) || 'APU';
  let candidate = base; let i = 2;
  while (used.has(candidate.toLowerCase())) { const suf = ` (${i++})`; candidate = base.substring(0, 31 - suf.length) + suf; }
  used.add(candidate.toLowerCase());
  return candidate;
};
const quoteSheet = (name: string) => `'${name.replace(/'/g, "''")}'`;

const saveWorkbook = async (wb: any, fileName: string) => {
  const buffer = XLSX().write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await saveBlobWithPicker(blob, fileName, 'Excel', { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] });
};

/** Construye hoja de un array de filas (celdas ya tipadas o strings). */
const buildSheet = (rows: any[][], cols: number[]) => {
  const ws: any = {};
  let maxC = 0;
  rows.forEach((row, r) => row.forEach((cell, c) => {
    if (cell === undefined || cell === null || cell === '') return;
    ws[XLSX().utils.encode_cell({ r, c })] = typeof cell === 'object' ? cell : (typeof cell === 'number' ? num(cell) : str(String(cell)));
    maxC = Math.max(maxC, c);
  }));
  ws['!ref'] = XLSX().utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length - 1, 0), c: Math.max(maxC, cols.length - 1) } });
  ws['!cols'] = cols.map(wch => ({ wch }));
  return ws;
};

/** Hoja APU con fórmulas. Devuelve la hoja y la celda del P.U. neto. */
const createApuWorksheet = (apu: APU, project: Project, apuNumber: string) => {
  const st = calculateApuTotals(apu, project);
  const rows: any[][] = [
    ['ANÁLISIS DE PRECIO UNITARIO'],
    [`PARTIDA: ${apuNumber} - ${(apu.name || '').toUpperCase()}`],
    [`UNIDAD: ${apu.unit} | CANTIDAD PROYECTO: ${apu.quantity}`],
    [],
    ['CATEGORÍA', 'RECURSO / DESCRIPCIÓN', 'UNIDAD', 'REND/CANT', 'P. UNITARIO', 'TOTAL', 'NOTA']
  ];
  const R = () => rows.length + 1; // número de fila Excel de la próxima fila
  const subtotalRefs: string[] = [];

  CATEGORIES.forEach(cat => {
    const items = apu.items?.[cat] ?? [];
    if (items.length === 0) return;
    const isLabor = cat === ItemCategory.MANO_DE_OBRA;
    rows.push([cat]);
    const first = R();
    items.forEach(i => {
      const r = R();
      rows.push(['', i.description, i.unit, num(itemAmount(cat, i), FMT_QTY), num(Number(i.unitPrice) || 0), fx(`D${r}*E${r}`, i.total), i.note || '']);
    });
    const last = R() - 1;
    const rawSum = items.reduce((s, i) => s + (Number(i.total) || 0), 0);
    if (isLabor) {
      const rSub = R();
      rows.push(['', 'SUBTOTAL MANO DE OBRA (sin leyes sociales)', '', '', '', fx(`SUM(F${first}:F${last})`, rawSum)]);
      const rLs = R();
      rows.push(['', 'LEYES SOCIALES', '', '', num(st.laws / 100, FMT_PCT), fx(`F${rSub}*E${rLs}`, st.lawsAmount)]);
      const rTot = R();
      rows.push(['', 'SUBTOTAL MANO DE OBRA', '', '', '', fx(`F${rSub}+F${rLs}`, st.subMoTotal)]);
      subtotalRefs.push(`F${rTot}`);
    } else {
      const rTot = R();
      rows.push(['', `SUBTOTAL ${cat}`, '', '', '', fx(`SUM(F${first}:F${last})`, rawSum)]);
      subtotalRefs.push(`F${rTot}`);
    }
    rows.push([]);
  });

  const rCd = R();
  rows.push(['', 'COSTO DIRECTO UNITARIO', '', '', '', fx(subtotalRefs.length ? subtotalRefs.join('+') : '0', st.costoDirecto)]);
  const rGg = R();
  rows.push(['', 'GASTOS GENERALES', '', '', num(st.overhead / 100, FMT_PCT), fx(`F${rCd}*E${rGg}`, st.costoDirecto * st.overhead / 100)]);
  const rUt = R();
  rows.push(['', 'UTILIDAD', '', '', num(st.utility / 100, FMT_PCT), fx(`F${rCd}*E${rUt}`, st.costoDirecto * st.utility / 100)]);
  const rNeto = R();
  rows.push(['', 'COSTO NETO UNITARIO', '', '', '', fx(`F${rCd}+F${rGg}+F${rUt}`, st.costoNetoUnitario)]);
  let puRow = rNeto;
  if (apu.divideUnitPrice && (apu.divisorQuantity || 0) > 0) {
    puRow = R();
    rows.push(['', `PRECIO UNITARIO NETO (por ${apu.divisorQuantity} ${apu.unit})`, '', num(apu.divisorQuantity!, FMT_QTY), '', fx(`F${rNeto}/D${puRow}`, st.precioUnitarioNeto)]);
  }

  const ws = buildSheet(rows, [15, 48, 10, 12, 15, 15, 40]);
  return { ws, puCell: `F${puRow}`, pu: st.precioUnitarioNeto };
};

export const exportProjectToExcel = async (project: Project, chapters: Chapter[], apus: APU[]) => {
  if (!XLSX()) { console.error('XLSX no cargado'); return; }
  const wb = XLSX().utils.book_new();
  const used = new Set<string>(['presupuesto']);
  const outline = buildChapterOutline(chapters, apus, project.id);

  // 1) Hojas APU (primero, para conocer sus nombres y celda de P.U.)
  const apuSheets: { name: string; ws: any }[] = [];
  const puRef = new Map<string, { ref: string; pu: number }>();
  const addApuSheet = (apu: APU, number: string) => {
    const { ws, puCell, pu } = createApuWorksheet(apu, project, number);
    const name = safeSheetName(`APU ${number}`, used);
    apuSheets.push({ name, ws });
    puRef.set(apu.id, { ref: `${quoteSheet(name)}!${puCell}`, pu });
  };
  outline.forEach(({ entries }) => entries.forEach(entry => {
    if (entry.kind === 'apu') addApuSheet(entry.apu, entry.number);
    else entry.apus.forEach(({ apu, number }) => addApuSheet(apu, number));
  }));

  // 2) Presupuesto
  const rows: any[][] = [
    ['HIDROGESTIÓN - REPORTE DE PRESUPUESTO'],
    [`PROYECTO: ${(project.name || '').toUpperCase()}`],
    [`CÓDIGO: ${project.code} | FECHA: ${project.date} | VERSIÓN: ${project.version}`],
    [],
    ['ÍTEM', 'DESCRIPCIÓN', 'UNIDAD', 'CANTIDAD', 'P.U. NETO', 'TOTAL NETO']
  ];
  const R = () => rows.length + 1;
  const chapterTotals: string[] = [];
  let grand = 0;
  outline.forEach(({ chapter: chap, number: n, entries }) => {
    rows.push([n, (chap.name || '').toUpperCase()]);
    // Suma por referencias explícitas: subtotales de subcapítulo + partidas propias (nunca las de un subcapítulo dos veces)
    const subtotalCellRefs: string[] = [];
    let chapSum = 0;

    // Filas en el orden mezclado del capítulo: partidas propias y subcapítulos intercalados
    entries.forEach(entry => {
      if (entry.kind === 'apu') {
        const apu = entry.apu;
        const r = R();
        const ref = puRef.get(apu.id)!;
        const qty = Number(apu.quantity) || 0;
        const total = ref.pu * qty;
        chapSum += total;
        rows.push([entry.number, apu.name, apu.unit, num(qty, FMT_QTY), fx(ref.ref, ref.pu), fx(`D${r}*E${r}`, total)]);
        subtotalCellRefs.push(`F${r}`);
        return;
      }
      if (entry.apus.length === 0) return;
      const subNumber = entry.number;
      rows.push(['', `  ${subNumber} ${(entry.chapter.name || '').toUpperCase()}`]);
      const subApuCellRefs: string[] = [];
      let subSum = 0;
      entry.apus.forEach(({ apu, number }) => {
        const r = R();
        const ref = puRef.get(apu.id)!;
        const qty = Number(apu.quantity) || 0;
        const total = ref.pu * qty;
        subSum += total; chapSum += total;
        rows.push([number, apu.name, apu.unit, num(qty, FMT_QTY), fx(ref.ref, ref.pu), fx(`D${r}*E${r}`, total)]);
        subApuCellRefs.push(`F${r}`);
      });
      const rSubSub = R();
      rows.push(['', `SUBTOTAL SUBCAPÍTULO ${subNumber}`, '', '', '', fx(subApuCellRefs.length ? subApuCellRefs.join('+') : '0', subSum)]);
      subtotalCellRefs.push(`F${rSubSub}`);
    });

    const rSub = R();
    rows.push(['', `SUBTOTAL CAPÍTULO ${n}`, '', '', '', fx(subtotalCellRefs.length ? subtotalCellRefs.join('+') : '0', chapSum)]);
    chapterTotals.push(`F${rSub}`);
    grand += chapSum;
    rows.push([]);
  });
  const rNet = R();
  rows.push(['', '', '', '', 'SUBTOTAL NETO', fx(chapterTotals.length ? chapterTotals.join('+') : '0', grand)]);
  const rIva = R();
  rows.push(['', '', '', '', 'IVA (19%)', fx(`F${rNet}*0.19`, grand * 0.19)]);
  rows.push(['', '', '', '', 'TOTAL PROYECTO (CLP)', fx(`F${rNet}+F${rIva}`, grand * 1.19)]);

  XLSX().utils.book_append_sheet(wb, buildSheet(rows, [10, 55, 10, 12, 18, 18]), 'Presupuesto');
  apuSheets.forEach(s => XLSX().utils.book_append_sheet(wb, s.ws, s.name));
  await saveWorkbook(wb, `HDG_REPORTE_${project.code}.xlsx`);
};

export const exportSingleApuToExcel = async (project: Project, apu: APU) => {
  if (!XLSX()) { console.error('XLSX no cargado'); return; }
  const wb = XLSX().utils.book_new();
  const { ws } = createApuWorksheet(apu, project, apu.code);
  XLSX().utils.book_append_sheet(wb, ws, safeSheetName(`APU ${apu.code}`, new Set()));
  await saveWorkbook(wb, `HDG_APU_${apu.code}_${(apu.name || '').substring(0, 20)}.xlsx`);
};
