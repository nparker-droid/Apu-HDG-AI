import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Project, Chapter, APU, ItemCategory } from '../types';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
};

const formatQuantity = (value: number) => {
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
};

export const exportBudgetToPDF = (project: Project, chapters: Chapter[], apus: APU[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // Header
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

  chapters
    .filter(c => c.projectId === project.id)
    .forEach(chapter => {
      const chapterApus = apus.filter(a => a.chapterId === chapter.id);
      let chapterTotal = 0;

      const apuRows = chapterApus.map(apu => {
        const laws = apu.useProjectGlobalRates ? project.globalSocialLaws : apu.socialLawsPercentage;
        const overhead = apu.useProjectGlobalRates ? project.globalOverhead : apu.overheadPercentage;
        const utility = apu.useProjectGlobalRates ? project.globalUtility : apu.utilityPercentage;

        const sMat = apu.items[ItemCategory.MATERIAL].reduce((s, i) => s + (i.total || 0), 0);
        const sMoB = apu.items[ItemCategory.MANO_DE_OBRA].reduce((s, i) => s + (i.total || 0), 0);
        const sMoBTotal = sMoB * (1 + laws / 100);
        const sEq = apu.items[ItemCategory.EQUIPO].reduce((s, i) => s + (i.total || 0), 0);
        const sOt = apu.items[ItemCategory.OTROS].reduce((s, i) => s + (i.total || 0), 0);

        const costoDirecto = sMat + sMoBTotal + sEq + sOt;
        const unitarioNeto = costoDirecto * (1 + (overhead + utility) / 100);
        const totalApu = unitarioNeto * apu.quantity;
        
        chapterTotal += totalApu;

        return [
          apu.code,
          apu.name,
          apu.unit,
          formatQuantity(apu.quantity),
          formatCurrency(unitarioNeto),
          formatCurrency(totalApu)
        ];
      });

      totalNeto += chapterTotal;

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
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 35, halign: 'right' }
    },
    styles: { fontSize: 7, cellPadding: 2 },
    didDrawPage: (data) => {
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(`Página ${data.pageNumber}`, pageWidth - 20, doc.internal.pageSize.height - 10);
    }
  });

  // Cuadro Resumen (Inmediatamente después de la tabla)
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const summaryWidth = 70;
  const summaryX = pageWidth - summaryWidth - 14;

  // Verificar si cabe en la página actual
  if (finalY + 30 > doc.internal.pageSize.height) {
    doc.addPage();
    // Reiniciar posición en nueva página
    var currentY = 20;
  } else {
    var currentY = finalY;
  }

  const iva = totalNeto * 0.19;
  const totalBruto = totalNeto + iva;

  doc.setDrawColor(0, 64, 113);
  doc.setLineWidth(0.5);
  doc.rect(summaryX, currentY, summaryWidth, 25);

  doc.setFontSize(8);
  doc.setTextColor(0, 64, 113);
  
  doc.setFont('helvetica', 'normal');
  doc.text('SUBTOTAL NETO:', summaryX + 2, currentY + 7);
  doc.text(formatCurrency(totalNeto), summaryX + summaryWidth - 2, currentY + 7, { align: 'right' });
  
  doc.text('IVA (19%):', summaryX + 2, currentY + 14);
  doc.text(formatCurrency(iva), summaryX + summaryWidth - 2, currentY + 14, { align: 'right' });
  
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL PROYECTO:', summaryX + 2, currentY + 21);
  doc.text(formatCurrency(totalBruto), summaryX + summaryWidth - 2, currentY + 21, { align: 'right' });

  doc.save(`Presupuesto_${project.name}.pdf`);
};

export const exportApuToPDF = (apu: APU, project: Project, chapter: Chapter) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // Header Blue
  doc.setFillColor(0, 64, 113);
  doc.rect(0, 0, pageWidth, 45, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('HIDROGESTIÓN', 14, 15);
  doc.setFontSize(12);
  doc.text('ANÁLISIS DE PRECIOS UNITARIOS', 14, 25);

  doc.setFontSize(8);
  doc.text(`PROYECTO: ${project.name.toUpperCase()}`, pageWidth - 14, 15, { align: 'right' });
  doc.text(`PARTIDA: ${apu.code} - ${apu.name.toUpperCase()}`, pageWidth - 14, 22, { align: 'right' });
  doc.text(`UNIDAD: ${apu.unit} | CANTIDAD: ${formatQuantity(apu.quantity)}`, pageWidth - 14, 29, { align: 'right' });
  doc.text(`FECHA: ${new Date().toLocaleDateString('es-CL')}`, pageWidth - 14, 36, { align: 'right' });

  let currentY = 55;

  const categories = [
    { id: ItemCategory.MATERIAL, name: 'MATERIALES' },
    { id: ItemCategory.MANO_DE_OBRA, name: 'MANO DE OBRA' },
    { id: ItemCategory.EQUIPO, name: 'EQUIPOS Y HERRAMIENTAS' },
    { id: ItemCategory.OTROS, name: 'OTROS' }
  ];

  let subtotalDirecto = 0;
  let manoObraBase = 0;

  categories.forEach(cat => {
    const items = apu.items[cat.id] || [];
    if (items.length === 0) return;

    const catSubtotal = items.reduce((s, i) => s + (i.total || 0), 0);
    if (cat.id === ItemCategory.MANO_DE_OBRA) manoObraBase = catSubtotal;
    subtotalDirecto += catSubtotal;

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
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 64, 113], fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 7 },
      columnStyles: { 4: { halign: 'right' }, 3: { halign: 'right' }, 2: { halign: 'center' } }
    });

    currentY = (doc as any).lastAutoTable.finalY + 5;
  });

  // Totales Finales APU
  const laws = apu.useProjectGlobalRates ? project.globalSocialLaws : apu.socialLawsPercentage;
  const overhead = apu.useProjectGlobalRates ? project.globalOverhead : apu.overheadPercentage;
  const utility = apu.useProjectGlobalRates ? project.globalUtility : apu.utilityPercentage;

  const socialLawsVal = manoObraBase * (laws / 100);
  const totalCostoDirecto = subtotalDirecto + socialLawsVal;
  const overheadVal = totalCostoDirecto * (overhead / 100);
  const utilityVal = totalCostoDirecto * (utility / 100);
  const totalUnitarioNeto = totalCostoDirecto + overheadVal + utilityVal;

  const summaryData = [
    ['COSTO DIRECTO BASE', formatCurrency(subtotalDirecto)],
    [`LEYES SOCIALES (${laws}%)`, formatCurrency(socialLawsVal)],
    ['TOTAL COSTO DIRECTO', formatCurrency(totalCostoDirecto)],
    [`GASTOS GENERALES (${overhead}%)`, formatCurrency(overheadVal)],
    [`UTILIDAD (${utility}%)`, formatCurrency(utilityVal)],
    [{ content: 'PRECIO UNITARIO NETO', styles: { fontStyle: 'bold', fontSize: 9 } }, { content: formatCurrency(totalUnitarioNeto), styles: { fontStyle: 'bold', fontSize: 9 } }]
  ];

  autoTable(doc, {
    startY: currentY + 5,
    body: summaryData,
    theme: 'plain',
    styles: { fontSize: 8, halign: 'right' },
    columnStyles: { 0: { cellWidth: 140 }, 1: { cellWidth: 40 } }
  });

  doc.save(`APU_${apu.code}_${apu.name}.pdf`);
};

export const formatUnit = (unit: string) => {
  if (!unit) return '';
  const u = unit.toLowerCase().trim();
  if (u === 'gl' || u === 'global') return 'GL';
  if (u === 'un' || u === 'unidad') return 'Un';
  if (u === 'm2' || u === 'm2') return 'm2';
  if (u === 'm3' || u === 'm3') return 'm3';
  if (u === 'ml' || u === 'm' || u === 'metro') return 'm';
  if (u === 'kg' || u === 'kilo') return 'kg';
  if (u === 'ton') return 'ton';
  if (u === 'dia') return 'Día';
  if (u === 'mes') return 'Mes';
  return unit;
};