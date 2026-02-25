import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Project, Chapter, APU, ItemCategory } from '../types';

const fmtCurr = (v: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Math.round(v));
const fmtQty = (v: number) => new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v || 0);

export const exportBudgetToPDF = (project: Project, chapters: Chapter[], apus: APU[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  doc.setFillColor(0, 64, 113);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.text('HIDROGESTIÓN', 14, 20);
  doc.setFontSize(10); doc.text('PRESUPUESTO DE OBRAS', pageWidth - 14, 20, { align: 'right' });
  doc.setFontSize(8); doc.text(`PROYECTO: ${project.name.toUpperCase()}`, pageWidth - 14, 30, { align: 'right' });

  let totalNeto = 0;
  const rows: any[] = [];
  chapters.filter(c => c.projectId === project.id).forEach(ch => {
    let chTotal = 0;
    const apuRows = apus.filter(a => a.chapterId === ch.id).map(a => {
      const oh = a.useProjectGlobalRates ? project.globalOverhead : a.overheadPercentage;
      const ut = a.useProjectGlobalRates ? project.globalUtility : a.utilityPercentage;
      const direct = Object.values(a.items).flat().reduce((acc, i) => acc + (i.total || 0), 0);
      const unitNeto = direct * (1 + (oh + ut) / 100);
      const sub = unitNeto * a.quantity;
      chTotal += sub;
      return [a.code, a.name, a.unit, fmtQty(a.quantity), fmtCurr(unitNeto), fmtCurr(sub)];
    });
    totalNeto += chTotal;
    rows.push([{ content: ch.code, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, { content: ch.name.toUpperCase(), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, '', '', '', { content: fmtCurr(chTotal), styles: { fontStyle: 'bold', fillColor: [240, 240, 240], halign: 'right' } }]);
    rows.push(...apuRows);
  });

  (doc as any).autoTable({
    startY: 50, head: [['ÍTEM', 'DESCRIPCIÓN', 'UNID', 'CANT', 'UNITARIO', 'TOTAL']], body: rows,
    theme: 'striped', headStyles: { fillColor: [0, 64, 113] }, styles: { fontSize: 7 },
    columnStyles: { 3: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right' } }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  let currentY = finalY;
  if (finalY + 30 > doc.internal.pageSize.height) { doc.addPage(); currentY = 20; }

  doc.setDrawColor(0, 64, 113); doc.rect(pageWidth - 84, currentY, 70, 25);
  doc.setFontSize(8); doc.setTextColor(0, 64, 113);
  doc.text('SUBTOTAL NETO:', pageWidth - 82, currentY + 7); doc.text(fmtCurr(totalNeto), pageWidth - 16, currentY + 7, { align: 'right' });
  doc.text('IVA (19%):', pageWidth - 82, currentY + 14); doc.text(fmtCurr(totalNeto * 0.19), pageWidth - 16, currentY + 14, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL PROYECTO:', pageWidth - 82, currentY + 21); doc.text(fmtCurr(totalNeto * 1.19), pageWidth - 16, currentY + 21, { align: 'right' });

  doc.save(`Presupuesto_${project.name}.pdf`);
};

export const exportApuToPDF = (apu: APU, project: Project) => {
  const doc = new jsPDF();
  doc.setFillColor(0, 64, 113); doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(255, 255, 255); doc.text('HIDROGESTIÓN - APU', 14, 20);
  doc.setFontSize(8); doc.text(`PARTIDA: ${apu.code} - ${apu.name}`, 14, 30);
  
  let y = 50;
  Object.entries(apu.items).forEach(([cat, items]: [any, any]) => {
    if (items.length === 0) return;
    doc.setFontSize(9); doc.setTextColor(0, 64, 113); doc.text(cat.toUpperCase(), 14, y);
    (doc as any).autoTable({
      startY: y + 2, body: items.map((i:any) => [i.description, i.unit, fmtQty(i.quantity || i.performance), fmtCurr(i.unitPrice), fmtCurr(i.total)]),
      theme: 'grid', styles: { fontSize: 7 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  });
  doc.save(`APU_${apu.code}.pdf`);
};