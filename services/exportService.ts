import { Project, Chapter, APU, ItemCategory } from '../types';
import { LOGO_COLOR_BASE64, LOGO_COLOR_RATIO } from './logoData';
import { saveBlobWithPicker } from './fileSaveService';
import { calculateApuTotals, CATEGORIES } from '../lib/apuCalculations';
import { formatCLP as fmtCLP, formatNumber } from '../lib/number';
import { buildChapterOutline } from '../lib/chapters';

const getJsPDF = () => {
  const g = window as any;
  return g.jspdf ? g.jspdf.jsPDF : null;
};

export const formatCLP = fmtCLP;
const formatNumAPU = (val: number) => formatNumber(Number(val) || 0, 3, 4);
const formatNumPresupuesto = (val: number) => formatNumber(Number(val) || 0, 2, 3);

export const formatUnit = (unit: string) => {
  if (!unit) return '';
  return unit
    .replace(/m2/gi, 'm²')
    .replace(/m3/gi, 'm³')
    .replace(/km2/gi, 'km²')
    .replace(/km3/gi, 'km³');
};

// jsPDF (helvetica estándar) no dibuja bien superíndices: en PDF se usa m2/m3 plano
const pdfUnit = (unit: string) => (unit || '').replace(/²/g, '2').replace(/³/g, '3');

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

const COLOR_HDG_BLUE = [0, 64, 113];
const COLOR_HDG_LIME = [136, 193, 62];
const COLOR_GREY = [110, 110, 110];

const COMPANY_CONTACT = [
  'Av. Providencia 2330 Of. 63 – Providencia · +562 2333 7038',
  'mail@hidrogestion.cl',
  'Santiago – Chile'
];

// Layout A4 (mm): el contenido va entre el cajetín y el pie en todas las páginas
const PAGE_WIDTH = 210;
const MARGIN_X = 14;
const CONTENT_TOP = 32;
const FOOTER_TOP = 275;
const CONTENT_BOTTOM = FOOTER_TOP - 3;
const TABLE_MARGIN = { top: CONTENT_TOP, bottom: 297 - CONTENT_BOTTOM, left: MARGIN_X, right: MARGIN_X };

// Recorta el texto con "…" para que quepa en maxWidth con la fuente activa
const fitText = (doc: any, text: string, maxWidth: number) => {
  let t = text || '—';
  if (doc.getTextWidth(t) <= maxWidth) return t;
  while (t.length > 1 && doc.getTextWidth(`${t}…`) > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
};

// Encabezado tipo cajetín: título y proyecto | Proyecto, Mandante, Versión/Fecha
const drawHeader = (doc: any, project: Project, title: string) => {
  const x0 = MARGIN_X, x1 = PAGE_WIDTH - MARGIN_X, xMeta = 128, y = 8, h = 17;
  doc.setDrawColor(COLOR_HDG_BLUE[0], COLOR_HDG_BLUE[1], COLOR_HDG_BLUE[2]);
  doc.setLineWidth(0.35);
  doc.rect(x0, y, x1 - x0, h);
  doc.line(xMeta, y, xMeta, y + h);

  doc.setTextColor(COLOR_HDG_BLUE[0], COLOR_HDG_BLUE[1], COLOR_HDG_BLUE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title.toUpperCase(), x0 + 4, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  const nameLines = doc.splitTextToSize((project.name || '').toUpperCase(), xMeta - x0 - 8).slice(0, 2);
  doc.text(nameLines, x0 + 4, y + 11.5);

  const meta: [string, string][] = [
    ['PROYECTO', project.code],
    ['MANDANTE', project.mandante],
    ['VERSIÓN / FECHA', `${project.version || '—'} · ${formatDate(project.date)}`]
  ];
  const rowH = h / meta.length;
  meta.forEach(([label, value], j) => {
    const yy = y + j * rowH;
    if (j) doc.line(xMeta, yy, x1, yy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.6);
    doc.setTextColor(COLOR_GREY[0], COLOR_GREY[1], COLOR_GREY[2]);
    doc.text(label, xMeta + 2, yy + 3.6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(30, 30, 30);
    doc.text(fitText(doc, value, 42), x1 - 2, yy + 3.8, { align: 'right' });
  });

  doc.setFillColor(COLOR_HDG_LIME[0], COLOR_HDG_LIME[1], COLOR_HDG_LIME[2]);
  doc.rect(x0, y + h + 0.8, x1 - x0, 0.7, 'F');
};

// Pie: barra azul, logo a color a la izquierda, datos de contacto a la derecha, paginación al centro
const drawFooter = (doc: any, page: number, pageCount: number) => {
  const x0 = MARGIN_X, x1 = PAGE_WIDTH - MARGIN_X, y = FOOTER_TOP;
  doc.setFillColor(COLOR_HDG_BLUE[0], COLOR_HDG_BLUE[1], COLOR_HDG_BLUE[2]);
  doc.rect(x0, y, x1 - x0, 0.7, 'F');

  try {
    const logoW = 44;
    doc.addImage(LOGO_COLOR_BASE64, 'PNG', x0, y + 3, logoW, logoW / LOGO_COLOR_RATIO);
  } catch (e) {
    console.error("Error cargando logo:", e);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(COLOR_GREY[0], COLOR_GREY[1], COLOR_GREY[2]);
  COMPANY_CONTACT.forEach((line, i) => doc.text(line, x1, y + 5 + i * 3.3, { align: 'right' }));

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLOR_HDG_BLUE[0], COLOR_HDG_BLUE[1], COLOR_HDG_BLUE[2]);
  doc.text(`Pág. ${page} / ${pageCount}`, PAGE_WIDTH / 2, 292, { align: 'center' });
};

// Se dibuja al final sobre todas las páginas, incluidas las que crea autoTable al cortar tablas
const drawPageFrames = (doc: any, project: Project, title: string) => {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawHeader(doc, project, title);
    drawFooter(doc, i, pageCount);
  }
};

// Fuente única de verdad: lib/apuCalculations
const calculateTotals = (apu: APU, project: Project) => calculateApuTotals(apu, project);

export const exportProjectToPDF = async (project: Project, chapters: Chapter[], apus: APU[]) => {
  const jsPDF = getJsPDF();
  if (!jsPDF) return;

  const doc = new jsPDF();
  let currentY = CONTENT_TOP;

  buildChapterOutline(chapters, apus, project.id).forEach(({ chapter, number: chapterNumber, entries: outlineEntries }) => {
    // Partidas en el orden mezclado del capítulo (propias y de subcapítulos intercaladas)
    const entries: { apu: APU; apuNumber: string; headerText: string }[] = [];
    outlineEntries.forEach(entry => {
      if (entry.kind === 'apu') {
        entries.push({ apu: entry.apu, apuNumber: entry.number, headerText: `CAPÍTULO ${chapterNumber}: ${chapter.name.toUpperCase()}` });
        return;
      }
      entry.apus.forEach(({ apu, number }) => entries.push({
        apu,
        apuNumber: number,
        headerText: `CAPÍTULO ${chapterNumber}: ${chapter.name.toUpperCase()} — SUBCAPÍTULO ${entry.number}: ${entry.chapter.name.toUpperCase()}`
      }));
    });

    entries.forEach(({ apu, apuNumber, headerText }) => {
      const stats = calculateTotals(apu, project);
      const totalRows = CATEGORIES.reduce((n, c) => n + (apu.items?.[c]?.length ?? 0) + 1, 0);
      const estimatedHeight = 50 + (totalRows * 7) + 25;

      if (currentY + estimatedHeight > CONTENT_BOTTOM) {
        doc.addPage();
        currentY = CONTENT_TOP;
      }

      const startY = currentY;

      doc.setTextColor(COLOR_HDG_BLUE[0], COLOR_HDG_BLUE[1], COLOR_HDG_BLUE[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(headerText, 14, currentY + 8);

      doc.setTextColor(40, 40, 40);
      doc.setFontSize(11);
      doc.text(`PARTIDA ${apuNumber}: ${apu.name.toUpperCase()}`, 14, currentY + 15);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`UNIDAD: ${pdfUnit(apu.unit)} | CANTIDAD: ${formatNumAPU(apu.quantity)}`, 14, currentY + 20);

      currentY += 25;

      CATEGORIES.forEach(cat => {
        const items = apu.items?.[cat] ?? [];
        if (items.length === 0) return;
        const isLabor = cat === ItemCategory.MANO_DE_OBRA;
        const body: any[] = items.map(i => [
          i.description,
          pdfUnit(i.unit),
          formatNumAPU(isLabor ? (i.performance || 0) : i.quantity),
          formatCLP(i.unitPrice),
          formatCLP(i.total)
        ]);
        if (isLabor && stats.lawsAmount > 0) {
          body.push([{ content: `LEYES SOCIALES (${formatNumber(stats.laws, 0, 2)}% s/ ${formatCLP(stats.subMoRaw)})`, colSpan: 4, styles: { fontStyle: 'italic', halign: 'right' } }, formatCLP(stats.lawsAmount)]);
        }
        const catSubtotal = isLabor ? stats.subMoTotal : items.reduce((acc, i) => acc + (Number(i.total) || 0), 0);
        body.push([{ content: `SUBTOTAL ${cat}`, colSpan: 4, styles: { fontStyle: 'bold', halign: 'right', fillColor: [245, 247, 250] } }, { content: formatCLP(catSubtotal), styles: { fontStyle: 'bold', fillColor: [245, 247, 250] } }]);

        (doc as any).autoTable({
          startY: currentY,
          head: [[cat.toUpperCase(), 'UNID.', isLabor ? 'REND.' : 'CANT.', 'P. UNITARIO', 'TOTAL']],
          body,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: COLOR_HDG_BLUE, textColor: [255, 255, 255], halign: 'center' },
          columnStyles: {
            0: { cellWidth: 'auto', halign: 'left' },
            1: { cellWidth: 15, halign: 'center' },
            2: { cellWidth: 25, halign: 'right' },
            3: { cellWidth: 30, halign: 'right' },
            4: { cellWidth: 30, halign: 'right' }
          },
          margin: TABLE_MARGIN
        });
        currentY = (doc as any).lastAutoTable.finalY + 2;
      });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(COLOR_HDG_BLUE[0], COLOR_HDG_BLUE[1], COLOR_HDG_BLUE[2]);

      doc.text(`COSTO DIRECTO UNITARIO:`, 120, currentY + 5);
      doc.text(formatCLP(stats.costoDirecto), 196, currentY + 5, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.text(`GASTOS GENERALES (${stats.overhead}%):`, 120, currentY + 10);
      doc.text(formatCLP(stats.costoDirecto * (stats.overhead / 100)), 196, currentY + 10, { align: 'right' });

      doc.text(`UTILIDAD (${stats.utility}%):`, 120, currentY + 15);
      doc.text(formatCLP(stats.costoDirecto * (stats.utility / 100)), 196, currentY + 15, { align: 'right' });

      const unitPriceLabel = apu.divideUnitPrice
        ? `P.U. NETO (por ${apu.divisorQuantity || 1} ${pdfUnit(apu.unit)}):`
        : `PRECIO UNITARIO NETO:`;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(unitPriceLabel, 120, currentY + 22);
      doc.text(formatCLP(stats.precioUnitarioNeto), 196, currentY + 22, { align: 'right' });

      currentY += 28;

      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.1);
      doc.rect(12, startY + 2, 186, currentY - startY - 2);

      currentY += 10;
    });
  });

  drawPageFrames(doc, project, 'Análisis de Precios Unitarios');
  await saveBlobWithPicker(
    doc.output('blob'),
    `HDG_APU_PROYECTO_${project.code}.pdf`,
    'PDF',
    { 'application/pdf': ['.pdf'] }
  );
};

export const exportBudgetToPDF = async (project: Project, chapters: Chapter[], apus: APU[]) => {
  const jsPDF = getJsPDF();
  if (!jsPDF) return;

  const doc = new jsPDF();
  let currentY = CONTENT_TOP + 3;
  let totalNetoProyecto = 0;
  const chapterSummary: { n: number; name: string; total: number }[] = [];

  buildChapterOutline(chapters, apus, project.id).forEach(({ chapter: chap, number, entries }) => {
    const chapterNumber = Number(number);
    const totalApuCount = entries.reduce((n, e) => n + (e.kind === 'apu' ? 1 : e.apus.length), 0);

    if (totalApuCount === 0) return;

    let chapterTotal = 0;
    const rows: any[] = [];

    // Filas en el orden mezclado del capítulo: partidas propias y subcapítulos intercalados
    entries.forEach(entry => {
      if (entry.kind === 'apu') {
        const apu = entry.apu;
        const stats = calculateTotals(apu, project);
        const subtotalPartida = stats.precioUnitarioNeto * apu.quantity;
        totalNetoProyecto += subtotalPartida;
        chapterTotal += subtotalPartida;
        rows.push([entry.number, apu.name, pdfUnit(apu.unit), formatNumPresupuesto(apu.quantity), formatCLP(stats.precioUnitarioNeto), formatCLP(subtotalPartida)]);
        return;
      }
      if (entry.apus.length === 0) return;
      const subNumber = entry.number;
      rows.push([{ content: `${subNumber} ${entry.chapter.name.toUpperCase()}`, colSpan: 6, styles: { fillColor: [248, 250, 253], textColor: COLOR_HDG_BLUE, fontStyle: 'bold' } }]);
      let subTotal = 0;
      entry.apus.forEach(({ apu, number: apuNumber }) => {
        const stats = calculateTotals(apu, project);
        const subtotalPartida = stats.precioUnitarioNeto * apu.quantity;
        subTotal += subtotalPartida; chapterTotal += subtotalPartida; totalNetoProyecto += subtotalPartida;
        rows.push([apuNumber, apu.name, pdfUnit(apu.unit), formatNumPresupuesto(apu.quantity), formatCLP(stats.precioUnitarioNeto), formatCLP(subtotalPartida)]);
      });
      rows.push([
        { content: `SUBTOTAL SUBCAPÍTULO ${subNumber}`, colSpan: 5, styles: { halign: 'right', fontStyle: 'italic' } },
        { content: formatCLP(subTotal), styles: { fontStyle: 'italic' } }
      ]);
    });

    (doc as any).autoTable({
      startY: currentY,
      head: [
        [{ content: `${chapterNumber}. ${chap.name.toUpperCase()}`, colSpan: 6, styles: { fillColor: [240, 244, 250], textColor: COLOR_HDG_BLUE, fontStyle: 'bold', halign: 'left' } }],
        ['CÓD.', 'DESCRIPCIÓN', 'UNID.', 'CANT.', 'P. UNIT. NETO', 'TOTAL NETO']
      ],
      body: rows,
      foot: [[
        { content: `SUBTOTAL CAPÍTULO ${chapterNumber}`, colSpan: 5, styles: { halign: 'right' } },
        { content: formatCLP(chapterTotal), styles: { halign: 'right' } }
      ]],
      showFoot: 'lastPage',
      footStyles: { fillColor: [240, 244, 250], textColor: COLOR_HDG_BLUE, fontStyle: 'bold', fontSize: 7.5 },
      theme: 'grid',
      margin: TABLE_MARGIN,
      styles: { fontSize: 7.5, font: 'helvetica' },
      headStyles: { fillColor: COLOR_HDG_BLUE, halign: 'center' },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 'auto', halign: 'left' },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' },
        5: { cellWidth: 30, halign: 'right' }
      }
    });
    currentY = (doc as any).lastAutoTable.finalY + 5;
    chapterSummary.push({ n: chapterNumber, name: chap.name.toUpperCase(), total: chapterTotal });
  });

  // Resumen por capítulo
  if (chapterSummary.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = CONTENT_TOP + 3;
    }
    (doc as any).autoTable({
      startY: currentY + 5,
      head: [[{ content: 'RESUMEN POR CAPÍTULO', colSpan: 4, styles: { halign: 'left' } }], ['N°', 'CAPÍTULO', 'TOTAL NETO', '% ']],
      body: chapterSummary.map(r => [String(r.n), r.name, formatCLP(r.total), totalNetoProyecto > 0 ? `${formatNumber(r.total / totalNetoProyecto * 100, 1, 1)}%` : '—']),
      foot: [[{ content: 'TOTAL NETO', colSpan: 2, styles: { halign: 'right' } }, formatCLP(totalNetoProyecto), '100,0%']],
      theme: 'grid',
      margin: TABLE_MARGIN,
      styles: { fontSize: 7.5, font: 'helvetica' },
      headStyles: { fillColor: COLOR_HDG_BLUE, halign: 'center' },
      footStyles: { fillColor: [240, 244, 250], textColor: COLOR_HDG_BLUE, fontStyle: 'bold', halign: 'right' },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 'auto', halign: 'left' },
        2: { cellWidth: 35, halign: 'right' },
        3: { cellWidth: 20, halign: 'right' }
      }
    });
    currentY = (doc as any).lastAutoTable.finalY + 2;
  }

  let finalY = currentY + 10;
  if (finalY + 28 > CONTENT_BOTTOM) {
    doc.addPage();
    finalY = CONTENT_TOP + 3;
  }

  const boxWidth = 85;
  const startX = 196 - boxWidth;

  doc.setDrawColor(COLOR_HDG_BLUE[0], COLOR_HDG_BLUE[1], COLOR_HDG_BLUE[2]);
  doc.setFillColor(255, 255, 255);
  doc.rect(startX, finalY, boxWidth, 28, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('SUBTOTAL NETO:', startX + 2, finalY + 7);
  doc.text('IVA (19%):', startX + 2, finalY + 14);

  doc.setFontSize(9);
  doc.setTextColor(COLOR_HDG_BLUE[0], COLOR_HDG_BLUE[1], COLOR_HDG_BLUE[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL PROYECTO:', startX + 2, finalY + 22);

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCLP(totalNetoProyecto), 194, finalY + 7, { align: 'right' });
  doc.text(formatCLP(totalNetoProyecto * 0.19), 194, finalY + 14, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.text(formatCLP(totalNetoProyecto * 1.19), 194, finalY + 22, { align: 'right' });

  drawPageFrames(doc, project, 'Presupuesto de Obras');
  await saveBlobWithPicker(
    doc.output('blob'),
    `HDG_PRESUPUESTO_${project.code}.pdf`,
    'PDF',
    { 'application/pdf': ['.pdf'] }
  );
};

export const exportSingleApuPDF = async (project: Project, chapter: Chapter, apu: APU) => {
  const jsPDF = getJsPDF();
  if (!jsPDF) return;
  await exportProjectToPDF(project, [chapter], [apu]);
};