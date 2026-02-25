import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Project, Chapter, APU, ItemCategory } from '../types';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(Math.round(value));
};

const formatQuantity = (value: number) => {
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number(value) || 0);
};

export const exportBudgetToPDF = (project: Project, chapters: Chapter[], apus: APU[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // Header Azul Superior
  doc.setFillColor(0, 64, 113);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('HIDROGESTIÓN', 14, 20);
  
  doc.setFontSize(14);
  doc.text('PRESUPUESTO DE OBRAS', pageWidth - 14, 20, { align: 'right' });
  
  doc.setFontSize(8);
  doc.text(`PROYECTO: ${project.name.toUpperCase()}`, pageWidth - 14, 30, { align: 'right' });
  doc.text(`FECHA: ${new Date().toLocaleDateString('es-CL')}`, pageWidth - 14, 35, { align: 'right' });

  let totalNeto = 0;
  const tableData: any[] = [];

  const projectChapters = chapters
    .filter(c => c.projectId === project.id)
    .sort((a, b) => (Number(a.code) || 0) - (Number(b.code) || 0));

  projectChapters.forEach(chapter => {
    const chapterApus = apus.filter(a => a.chapterId === chapter.id);
    let chapterTotal = 0;

    const apuRows = chapterApus.map(apu => {
      const laws = apu.useProjectGlobalRates ? project.globalSocialLaws : apu.socialLawsPercentage;
      const overhead = apu.useProjectGlobalRates ? project.globalOverhead : apu.overheadPercentage;
      const utility = apu.useProjectGlobalRates ? project.globalUtility : apu.utilityPercentage;

      const sMat = (apu.items[ItemCategory.MATERIAL] || []).reduce((s, i) => s + (i.total || 0), 0);
      const sMoB = (apu.items[ItemCategory.MANO_DE_OBRA] || []).reduce((s, i) => s + (i.total || 0), 0);
      const sMoBTotal = sMoB * (1 + laws / 100);
      const sEq = (apu.items[ItemCategory.EQUIPO] || []).reduce((s, i) => s + (i.total || 0), 0);
      const sOt = (apu.items[ItemCategory.OTROS] || []).reduce((s, i) => s + (i.total || 0), 0);

      const costoDirecto = sMat + sMoBTotal + sEq + sOt;
      const unitarioNeto = costoDirecto * (1 + (overhead + utility) / 100);
      const subtotalApu = unitarioNeto * Number(apu.quantity);
      
      chapterTotal += subtotalApu;

      return [
        apu.code,
        apu.name,
        apu.unit,
        formatQuantity(Number(apu.quantity)),
        formatCurrency(unitarioNeto),
        formatCurrency(subtotalApu)
      ];
    });

    totalNeto += chapterTotal;

    // Fila Capítulo
    tableData.push([
      { content: chapter.code, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
      { content: chapter.name.toUpperCase(), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
      { content: '', styles: { fillColor: [240, 240, 240] } },
      { content: '', styles: { fillColor: [240, 240, 240] } },
      { content: '', styles: { fillColor: [240, 240, 240] } },
      { content: formatCurrency(chapterTotal), styles: { fontStyle: 'bold', fillColor: [240, 240, 240], halign: 'right' } }
    ]);

    tableData.push(...apuRows);
  });

  autoTable(doc, {
    startY: 50,
    head: [['ÍTEM', 'DESCRIPCIÓN DE PARTIDA', 'UNIDAD', 'CANT.', 'P. UNITARIO', 'TOTAL NETO']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [0, 64, 113], fontSize: 8, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 35, halign: 'right' }
    }
  });

  // CUADRO RESUMEN DINÁMICO (Pegado a la tabla)
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const summaryWidth = 60;
  const summaryHeight = 25;
  const summaryX = pageWidth - summaryWidth - 14;

  // Validación de espacio: si no cabe, saltar página
  let currentY = finalY;
  if (finalY + summaryHeight > doc.internal.pageSize.height - 20) {
    doc.addPage();
    currentY = 20;
  }

  const iva = totalNeto * 0.19;
  const total = totalNeto + iva;

  doc.setDrawColor(0, 64, 113);
  doc.setLineWidth(0.5);
  doc.rect(summaryX, currentY, summaryWidth, summaryHeight);

  doc.setFontSize(8);
  doc.setTextColor(0, 64, 113);
  doc.setFont('helvetica', 'normal');
  doc.text('SUBTOTAL NETO:', summaryX + 2, currentY + 7);
  doc.text(formatCurrency(totalNeto), summaryX + summaryWidth - 2, currentY + 7, { align: 'right' });
  
  doc.text('IVA (19%):', summaryX + 2, currentY + 14);
  doc.text(formatCurrency(iva), summaryX + summaryWidth - 2, currentY + 14, { align: 'right' });
  
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL PROYECTO:', summaryX + 2, currentY + 21);
  doc.text(formatCurrency(total), summaryX + summaryWidth - 2, currentY + 21, { align: 'right' });

  doc.save(`Presupuesto_${project.name}.pdf`);
};

export const exportApuToPDF = (apu: APU, project: Project, chapter: Chapter) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  doc.setFillColor(0, 64, 113);
  doc.rect(0, 0, pageWidth, 45, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('HIDROGESTIÓN', 14, 15);
  doc.setFontSize(10);
  doc.text('ANÁLISIS DE PRECIOS UNITARIOS (APU)', 14, 25);

  doc.setFontSize(8);
  doc.text(`PROYECTO: ${project.name.toUpperCase()}`, pageWidth - 14, 15, { align: 'right' });
  doc.text(`PARTIDA: ${apu.code} - ${apu.name.toUpperCase()}`, pageWidth - 14, 22, { align: 'right' });
  doc.text(`UNIDAD: ${apu.unit} | CANTIDAD: ${formatQuantity(Number(apu.quantity))}`, pageWidth - 14, 29, { align: 'right' });
  doc.text(`FECHA: ${new Date().toLocaleDateString('es-CL')}`, pageWidth - 14, 36, { align: 'right' });

  let currentY = 55;
  const categories = [
    { id: ItemCategory.MATERIAL, name: 'MATERIALES' },
    { id: ItemCategory.MANO_DE_OBRA, name: 'MANO DE OBRA' },
    { id: ItemCategory.EQUIPO, name: 'EQUIPOS Y HERRAMIENTAS' },
    { id: ItemCategory.OTROS, name: 'OTROS' }
  ];

  let subtotalDirecto = 0;
  let moBase = 0;

  categories.forEach(cat => {
    const items = apu.items[cat.id] || [];
    if (items.length === 0) return;

    const sub = items.reduce((s, i) => s + (i.total || 0), 0);
    subtotalDirecto += sub;
    if (cat.id === ItemCategory.MANO_DE_OBRA) moBase = sub;

    autoTable(doc, {
      startY: currentY,
      head: [[cat.name, 'UNID.', 'CANT/REND.', 'P. UNITARIO', 'TOTAL']],
      body: items.map(i => [
        i.description,
        i.unit,
        formatQuantity(cat.id === ItemCategory.MANO_DE_OBRA ? (i.performance || 0) : (i.quantity || 0)),
        formatCurrency(i.unitPrice),
        formatCurrency(i.total || 0)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 64, 113], fontSize: 8 },
      styles: { fontSize: 7 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 5;
  });

  doc.save(`APU_${apu.code}_${apu.name}.pdf`);
};