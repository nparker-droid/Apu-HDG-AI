import { Project, Chapter, APU, ItemCategory } from '../types';
import { LOGO_BASE64 } from './logoData';
import { saveBlobWithPicker } from './fileSaveService';
import { calculateApuTotals, CATEGORIES } from '../lib/apuCalculations';
import { formatCLP as fmtCLP, formatNumber } from '../lib/number';

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

const drawCorporateHeader = (doc: any, project: Project, title: string) => {
  const pageWidth = 210;
  doc.setFillColor(COLOR_HDG_BLUE[0], COLOR_HDG_BLUE[1], COLOR_HDG_BLUE[2]);
  doc.rect(0, 0, pageWidth, 35, 'F');
  doc.setFillColor(COLOR_HDG_LIME[0], COLOR_HDG_LIME[1], COLOR_HDG_LIME[2]);
  doc.rect(0, 35, pageWidth, 1.2, 'F');

  try {
    doc.addImage(LOGO_BASE64, 'PNG', 14, 5, 46, 20);
  } catch (e) {
    console.error("Error cargando logo:", e);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title.toUpperCase(), 196, 15, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`PROYECTO: ${project.name.toUpperCase()}`, 196, 25, { align: 'right' });
  doc.text(`VERSIÓN: ${project.version} | FECHA: ${formatDate(project.date)}`, 196, 30, { align: 'right' });
};

const addPageNumbers = (doc: any) => {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i} de ${pageCount}`, 196, 288, { align: 'right' });
  }
};

// Fuente única de verdad: lib/apuCalculations
const calculateTotals = (apu: APU, project: Project) => calculateApuTotals(apu, project);

export const exportProjectToPDF = async (project: Project, chapters: Chapter[], apus: APU[]) => {
  const jsPDF = getJsPDF();
  if (!jsPDF) return;

  const doc = new jsPDF();
  let currentY = 42;

  drawCorporateHeader(doc, project, 'Análisis de Precios Unitarios');

  const projectChapters = chapters
    .filter(c => c.projectId === project.id)

  projectChapters.forEach((chapter, cIdx) => {
    const chapterNumber = cIdx + 1;
    const chapterApus = apus
      .filter(a => a.chapterId === chapter.id);

    chapterApus.forEach((apu, aIdx) => {
      const apuNumber = `${chapterNumber}.${aIdx + 1}`;
      const stats = calculateTotals(apu, project);
      const totalRows = CATEGORIES.reduce((n, c) => n + (apu.items?.[c]?.length ?? 0) + 1, 0);
      const estimatedHeight = 50 + (totalRows * 7) + 25;

      if (currentY + estimatedHeight > 275) {
        doc.addPage();
        drawCorporateHeader(doc, project, 'Análisis de Precios Unitarios');
        currentY = 42;
      }

      const startY = currentY;

      doc.setTextColor(COLOR_HDG_BLUE[0], COLOR_HDG_BLUE[1], COLOR_HDG_BLUE[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`CAPÍTULO ${chapterNumber}: ${chapter.name.toUpperCase()}`, 14, currentY + 8);

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
          margin: { left: 14, right: 14 }
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

  addPageNumbers(doc);
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
  drawCorporateHeader(doc, project, 'Presupuesto de Obras');

  let currentY = 45;
  let totalNetoProyecto = 0;
  const chapterSummary: { n: number; name: string; total: number }[] = [];

  const projectChapters = chapters
    .filter(c => c.projectId === project.id)

  projectChapters.forEach((chap, cIdx) => {
    const chapterNumber = cIdx + 1;
    const chapApus = apus
      .filter(a => a.chapterId === chap.id);

    if (chapApus.length === 0) return;

    let chapterTotal = 0;
    const rows = chapApus.map((apu, aIdx) => {
      const apuNumber = `${chapterNumber}.${aIdx + 1}`;
      const stats = calculateTotals(apu, project);
      const subtotalPartida = stats.precioUnitarioNeto * apu.quantity;
      totalNetoProyecto += subtotalPartida;
      chapterTotal += subtotalPartida;
      return [apuNumber, apu.name, pdfUnit(apu.unit), formatNumPresupuesto(apu.quantity), formatCLP(stats.precioUnitarioNeto), formatCLP(subtotalPartida)];
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
      drawCorporateHeader(doc, project, 'Presupuesto de Obras');
      currentY = 45;
    }
    (doc as any).autoTable({
      startY: currentY + 5,
      head: [[{ content: 'RESUMEN POR CAPÍTULO', colSpan: 4, styles: { halign: 'left' } }], ['N°', 'CAPÍTULO', 'TOTAL NETO', '% ']],
      body: chapterSummary.map(r => [String(r.n), r.name, formatCLP(r.total), totalNetoProyecto > 0 ? `${formatNumber(r.total / totalNetoProyecto * 100, 1, 1)}%` : '—']),
      foot: [[{ content: 'TOTAL NETO', colSpan: 2, styles: { halign: 'right' } }, formatCLP(totalNetoProyecto), '100,0%']],
      theme: 'grid',
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
  if (finalY > 250) {
    doc.addPage();
    drawCorporateHeader(doc, project, 'Presupuesto de Obras');
    finalY = 45;
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

  addPageNumbers(doc);
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