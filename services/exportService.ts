
import { Project, Chapter, APU, ItemCategory } from '../types';
import { LOGO_BASE64 } from './logoData';

const getJsPDF = () => {
  const g = window as any;
  return g.jspdf ? g.jspdf.jsPDF : null;
};

const formatCLP = (val: number) => `$${Math.round(val).toLocaleString('es-CL')}`;
const formatNum = (val: number) => val.toLocaleString('es-CL', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export const formatUnit = (unit: string) => {
  if (!unit) return '';
  return unit
    .replace(/m2/gi, 'm²')
    .replace(/m3/gi, 'm³')
    .replace(/km2/gi, 'km²')
    .replace(/km3/gi, 'km³');
};

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

const calculateTotals = (apu: APU, project: Project) => {
  const laws = apu.useProjectGlobalRates ? project.globalSocialLaws : apu.socialLawsPercentage;
  const overhead = apu.useProjectGlobalRates ? project.globalOverhead : apu.overheadPercentage;
  const utility = apu.useProjectGlobalRates ? project.globalUtility : apu.utilityPercentage;
  
  const factorIndirectos = 1 + (overhead + utility) / 100;
  const sMat = apu.items[ItemCategory.MATERIAL].reduce((s, i) => s + i.total, 0);
  const sMoB = apu.items[ItemCategory.MANO_DE_OBRA].reduce((s, i) => s + i.total, 0);
  const sEq = apu.items[ItemCategory.EQUIPO].reduce((s, i) => s + i.total, 0);
  const sOt = apu.items[ItemCategory.OTROS].reduce((s, i) => s + i.total, 0);
  
  const costoDirecto = sMat + (sMoB * (1 + laws / 100)) + sEq + sOt;
  const precioUnitarioNeto = costoDirecto * factorIndirectos;
  
  return { costoDirecto, precioUnitarioNeto, factorIndirectos, laws, overhead, utility };
};

export const exportProjectToPDF = (project: Project, chapters: Chapter[], apus: APU[]) => {
  const jsPDF = getJsPDF();
  if (!jsPDF) return;

  const doc = new jsPDF();
  let currentY = 42;

  drawCorporateHeader(doc, project, 'Análisis de Precios Unitarios');

  const projectChapters = chapters
    .filter(c => c.projectId === project.id)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  projectChapters.forEach((chapter) => {
    const chapterApus = apus
      .filter(a => a.chapterId === chapter.id)
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    chapterApus.forEach((apu) => {
      const stats = calculateTotals(apu, project);
      const totalRows = Object.values(apu.items).flat().length;
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
      doc.text(`CAPÍTULO ${chapter.code}: ${chapter.name.toUpperCase()}`, 14, currentY + 8);
      
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(11);
      doc.text(`PARTIDA ${apu.code}: ${apu.name.toUpperCase()}`, 14, currentY + 15);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`UNIDAD: ${formatUnit(apu.unit)} | CANTIDAD: ${formatNum(apu.quantity.toFixed(1))}`, 14, currentY + 20);

      currentY += 25;

      Object.values(ItemCategory).forEach(cat => {
        const items = apu.items[cat];
        if (items.length === 0) return;

        (doc as any).autoTable({
          startY: currentY,
          head: [[cat.toUpperCase(), 'UNID.', cat === ItemCategory.MANO_DE_OBRA ? 'REND.' : 'CANT.', 'P. UNITARIO', 'TOTAL']],
          body: items.map(i => [
            i.description, 
            formatUnit(i.unit), 
            formatNum(cat === ItemCategory.MANO_DE_OBRA ? (i.performance || 0) : i.quantity), 
            formatCLP(i.unitPrice), 
            formatCLP(i.total)
          ]),
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
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`PRECIO UNITARIO NETO:`, 120, currentY + 22);
      doc.text(formatCLP(stats.precioUnitarioNeto), 196, currentY + 22, { align: 'right' });

      currentY += 28;

      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.1);
      doc.rect(12, startY + 2, 186, currentY - startY - 2);
      
      currentY += 10;
    });
  });

  addPageNumbers(doc);
  doc.save(`HDG_APU_PROYECTO_${project.code}.pdf`);
};

export const exportBudgetToPDF = (project: Project, chapters: Chapter[], apus: APU[]) => {
  const jsPDF = getJsPDF();
  if (!jsPDF) return;

  const doc = new jsPDF();
  drawCorporateHeader(doc, project, 'Presupuesto de Obras');

  let currentY = 45;
  let totalNetoProyecto = 0;

  const projectChapters = chapters
    .filter(c => c.projectId === project.id)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  projectChapters.forEach(chap => {
    const chapApus = apus
      .filter(a => a.chapterId === chap.id)
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    if (chapApus.length === 0) return;

    const rows = chapApus.map(apu => {
      const stats = calculateTotals(apu, project);
      const subtotalPartida = stats.precioUnitarioNeto * apu.quantity;
      totalNetoProyecto += subtotalPartida;
      return [apu.code, apu.name, formatUnit(apu.unit), formatNum(apu.quantity), formatCLP(stats.precioUnitarioNeto), formatCLP(subtotalPartida)];
    });

    (doc as any).autoTable({
      startY: currentY,
      head: [
        [{ content: `${chap.code}. ${chap.name.toUpperCase()}`, colSpan: 6, styles: { fillColor: [240, 244, 250], textColor: COLOR_HDG_BLUE, fontStyle: 'bold', halign: 'left' } }],
        ['CÓD.', 'DESCRIPCIÓN', 'UNID.', 'CANT.', 'P. UNIT. NETO', 'TOTAL NETO']
      ],
      body: rows,
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
  });

  const finalY = currentY + 10;
  if (finalY > 250) { doc.addPage(); drawCorporateHeader(doc, project, 'Presupuesto de Obras'); }

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
  doc.save(`HDG_PRESUPUESTO_${project.code}.pdf`);
};

export const exportSingleApuPDF = (project: Project, chapter: Chapter, apu: APU) => {
  const jsPDF = getJsPDF();
  if (!jsPDF) return;
  exportProjectToPDF(project, [chapter], [apu]);
};
