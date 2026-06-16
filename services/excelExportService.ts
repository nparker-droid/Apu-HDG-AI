import { Project, Chapter, APU, ItemCategory } from '../types';
import { saveBlobWithPicker } from './fileSaveService';
import { calculateApuTotals } from '../lib/apuCalculations';

const XLSX = (window as any).XLSX;

const numCell = (value: number) => ({
    v: value,
    t: 'n',
    z: '#,##0'
});

const decCell = (value: number) => ({
    v: value,
    t: 'n',
    z: '#,##0.00'
});

const safeSheetName = (name: string, fallback: string) => {
    const cleaned = (name || fallback).replace(/[\\/?*[\]:]/g, ' ').trim() || fallback;
    return cleaned.substring(0, 31);
};

const saveWorkbook = async (wb: any, fileName: string) => {
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    await saveBlobWithPicker(
        blob,
        fileName,
        'Excel',
        { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
    );
};

export const exportProjectToExcel = async (project: Project, chapters: Chapter[], apus: APU[]) => {
    if (!XLSX) { console.error("XLSX no cargado"); return; }

    const wb = XLSX.utils.book_new();

    const budgetRows: any[] = [
        ["HIDROGESTIÓN - REPORTE DE PRESUPUESTO"],
        [`PROYECTO: ${project.name.toUpperCase()}`],
        [`CÓDIGO: ${project.code} | FECHA: ${project.date} | VERSIÓN: ${project.version}`],
        [],
        ["ÍTEM", "DESCRIPCIÓN", "UNIDAD", "CANTIDAD", "P.U. NETO", "TOTAL NETO"]
    ];

    let grandTotalNeto = 0;
    const sortedChapters = chapters.filter(c => c.projectId === project.id);

    sortedChapters.forEach((chap, cIdx) => {
        const chapterNumber = cIdx + 1;
        budgetRows.push([chapterNumber, chap.name.toUpperCase(), "", "", "", ""]);

        const chapApus = apus.filter(a => a.chapterId === chap.id);

        chapApus.forEach((apu, aIdx) => {
            const apuNumber = `${chapterNumber}.${aIdx + 1}`;
            const stats = calculateApuTotals(apu, project);
            const totalPartida = stats.precioUnitarioNeto * apu.quantity;
            grandTotalNeto += totalPartida;

            budgetRows.push([
                apuNumber,
                apu.name,
                apu.unit,
                decCell(Number(apu.quantity) || 0),
                numCell(stats.precioUnitarioNeto),
                numCell(totalPartida)
            ]);
        });
        budgetRows.push([]);
    });

    budgetRows.push(
        [],
        ["", "", "", "", "SUBTOTAL NETO", numCell(grandTotalNeto)],
        ["", "", "", "", "IVA (19%)", numCell(grandTotalNeto * 0.19)],
        ["", "", "", "", "TOTAL PROYECTO (CLP)", numCell(grandTotalNeto * 1.19)]
    );

    const wsBudget = XLSX.utils.aoa_to_sheet(budgetRows);

    wsBudget['!cols'] = [
        { wch: 10 },
        { wch: 50 },
        { wch: 10 },
        { wch: 12 },
        { wch: 15 },
        { wch: 18 }
    ];

    XLSX.utils.book_append_sheet(wb, wsBudget, "Presupuesto");

    apus.filter(a => a.projectId === project.id).forEach((apu, idx) => {
        const chapterIndices = chapters.filter(c => c.projectId === project.id);
        const cIdx = chapterIndices.findIndex(c => c.id === apu.chapterId);
        const chapterApus = apus.filter(a => a.chapterId === apu.chapterId);
        const aIdx = chapterApus.findIndex(a => a.id === apu.id);

        const apuNumber = (cIdx !== -1) ? `${cIdx + 1}.${aIdx + 1}` : apu.code;
        const wsApu = createApuWorksheet(apu, project, apuNumber);
        const sheetName = safeSheetName(`APU ${apu.code || idx + 1}`, `APU ${idx + 1}`);
        XLSX.utils.book_append_sheet(wb, wsApu, sheetName);
    });

    await saveWorkbook(wb, `HDG_REPORTE_${project.code}.xlsx`);
};

export const exportSingleApuToExcel = async (project: Project, apu: APU) => {
    if (!XLSX) { console.error("XLSX no cargado"); return; }
    const wb = XLSX.utils.book_new();
    const wsApu = createApuWorksheet(apu, project, apu.code);
    const sheetName = safeSheetName(`APU ${apu.code}`, 'APU');
    XLSX.utils.book_append_sheet(wb, wsApu, sheetName);
    await saveWorkbook(wb, `HDG_APU_${apu.code}_${apu.name.substring(0, 20)}.xlsx`);
};

const createApuWorksheet = (apu: APU, project: Project, apuNumber: string) => {
    const stats = calculateApuTotals(apu, project);
    const apuRows: any[] = [
        ["ANÁLISIS DE PRECIO UNITARIO"],
        [`PARTIDA: ${apuNumber} - ${apu.name.toUpperCase()}`],
        [`UNIDAD: ${apu.unit} | CANTIDAD PROYECTO: ${apu.quantity}`],
        [],
        ["CATEGORÍA", "RECURSO / DESCRIPCIÓN", "UNIDAD", "REND/CANT", "P. UNITARIO", "TOTAL"]
    ];

    Object.values(ItemCategory).forEach(cat => {
        const items = apu.items[cat];
        if (items.length > 0) {
            apuRows.push([cat, "", "", "", "", ""]);
            items.forEach(i => {
                apuRows.push([
                    "",
                    i.description,
                    i.unit,
                    decCell(cat === ItemCategory.MANO_DE_OBRA ? (Number(i.performance) || 0) : (Number(i.quantity) || 0)),
                    numCell(i.unitPrice),
                    numCell(i.total)
                ]);
            });
            const subCat = items.reduce((s, i) => s + i.total, 0);
            apuRows.push(["", `SUBTOTAL ${cat}`, "", "", "", numCell(subCat)]);
            apuRows.push([]);
        }
    });

    const unitPriceRowLabel = apu.divideUnitPrice
        ? `PRECIO UNITARIO NETO (por ${apu.divisorQuantity || 1} ${apu.unit})`
        : "PRECIO UNITARIO NETO";

    apuRows.push(
        ["", "COSTO DIRECTO UNITARIO", "", "", "", numCell(stats.costoDirecto)],
        ["", `GASTOS GENERALES (${stats.overhead}%)`, "", "", "", numCell(stats.costoDirecto * (stats.overhead / 100))],
        ["", `UTILIDAD (${stats.utility}%)`, "", "", "", numCell(stats.costoDirecto * (stats.utility / 100))],
        ["", unitPriceRowLabel, "", "", "", numCell(stats.precioUnitarioNeto)]
    );

    const wsApu = XLSX.utils.aoa_to_sheet(apuRows);
    wsApu['!cols'] = [
        { wch: 15 },
        { wch: 45 },
        { wch: 10 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 }
    ];
    return wsApu;
};

// calculateApuTotals importado desde lib/apuCalculations — fuente única de verdad para todos los módulos