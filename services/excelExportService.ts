
import { Project, Chapter, APU, ItemCategory } from '../types';

const XLSX = (window as any).XLSX;

const formatCurrency = (val: number) => Math.round(val);

// Helper para crear celdas con formato de número (separador de miles)
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

export const exportProjectToExcel = (project: Project, chapters: Chapter[], apus: APU[]) => {
    if (!XLSX) return alert("Librería Excel no cargada.");

    const wb = XLSX.utils.book_new();

    // --- HOJA 1: PRESUPUESTO GENERAL ---
    const budgetRows: any[] = [
        ["HIDROGESTIÓN - REPORTE DE PRESUPUESTO"],
        [`PROYECTO: ${project.name.toUpperCase()}`],
        [`CÓDIGO: ${project.code} | FECHA: ${project.date} | VERSIÓN: ${project.version}`],
        [],
        ["ÍTEM", "DESCRIPCIÓN", "UNIDAD", "CANTIDAD", "P.U. NETO", "TOTAL NETO"]
    ];

    let grandTotalNeto = 0;
    const sortedChapters = chapters
        .filter(c => c.projectId === project.id)
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    sortedChapters.forEach(chap => {
        // Fila de Capítulo
        budgetRows.push([chap.code, chap.name.toUpperCase(), "", "", "", ""]);
        
        const chapApus = apus
            .filter(a => a.chapterId === chap.id)
            .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

        chapApus.forEach(apu => {
            const stats = calculateApuTotals(apu, project);
            const totalPartida = stats.precioUnitarioNeto * apu.quantity;
            grandTotalNeto += totalPartida;
            
            budgetRows.push([
                apu.code,
                apu.name,
                apu.unit,
                decCell(apu.quantity.toFixed(1)),
                numCell(stats.precioUnitarioNeto),
                numCell(totalPartida)
            ]);
        });
        budgetRows.push([]); // Espacio entre capítulos
    });

    // Totales del Presupuesto
    budgetRows.push(
        [],
        ["", "", "", "", "SUBTOTAL NETO", numCell(grandTotalNeto)],
        ["", "", "", "", "IVA (19%)", numCell(grandTotalNeto * 0.19)],
        ["", "", "", "", "TOTAL PROYECTO (CLP)", numCell(grandTotalNeto * 1.19)]
    );

    const wsBudget = XLSX.utils.aoa_to_sheet(budgetRows);
    
    // Configurar anchos de columna para Presupuesto
    wsBudget['!cols'] = [
        { wch: 10 }, // Ítem
        { wch: 50 }, // Descripción
        { wch: 10 }, // Unidad
        { wch: 12 }, // Cantidad
        { wch: 15 }, // P.U
        { wch: 18 }  // Total
    ];

    XLSX.utils.book_append_sheet(wb, wsBudget, "Presupuesto");

    // --- HOJAS ADICIONALES: UN APU POR HOJA ---
    apus.filter(a => a.projectId === project.id).forEach(apu => {
        const wsApu = createApuWorksheet(apu, project);
        // Nombre de hoja seguro (max 31 chars)
        const sheetName = `APU ${apu.code}`.substring(0, 31);
        XLSX.utils.book_append_sheet(wb, wsApu, sheetName);
    });

    XLSX.writeFile(wb, `HDG_REPORTE_${project.code}.xlsx`);
};

export const exportSingleApuToExcel = (project: Project, apu: APU) => {
    if (!XLSX) return alert("Librería Excel no cargada.");
    const wb = XLSX.utils.book_new();
    const wsApu = createApuWorksheet(apu, project);
    const sheetName = `APU ${apu.code}`.substring(0, 31);
    XLSX.utils.book_append_sheet(wb, wsApu, sheetName);
    XLSX.writeFile(wb, `HDG_APU_${apu.code}_${apu.name.substring(0, 20)}.xlsx`);
};

const createApuWorksheet = (apu: APU, project: Project) => {
    const stats = calculateApuTotals(apu, project);
    const apuRows: any[] = [
        ["ANÁLISIS DE PRECIO UNITARIO"],
        [`PARTIDA: ${apu.code} - ${apu.name.toUpperCase()}`],
        [`UNIDAD: ${apu.unit} | CANTIDAD PROYECTO: ${apu.quantity}`],
        [],
        ["CATEGORÍA", "RECURSO / DESCRIPCIÓN", "UNIDAD", "REND/CANT", "P. UNITARIO", "TOTAL"]
    ];

    Object.values(ItemCategory).forEach(cat => {
        const items = apu.items[cat];
        if (items.length > 0) {
            apuRows.push([cat, "", "", "", "", ""]); // Encabezado de categoría
            items.forEach(i => {
                apuRows.push([
                    "",
                    i.description,
                    i.unit,
                    decCell(i.quantity || i.performance || 0),
                    numCell(i.unitPrice),
                    numCell(i.total)
                ]);
            });
            const subCat = items.reduce((s, i) => s + i.total, 0);
            apuRows.push(["", `SUBTOTAL ${cat}`, "", "", "", numCell(subCat)]);
            apuRows.push([]); // Espacio
        }
    });

    // Bloque de cierre de APU
    apuRows.push(
        ["", "COSTO DIRECTO UNITARIO", "", "", "", numCell(stats.costoDirecto)],
        ["", `GASTOS GENERALES (${stats.overhead}%)`, "", "", "", numCell(stats.costoDirecto * stats.overhead / 100)],
        ["", `UTILIDAD (${stats.utility}%)`, "", "", "", numCell(stats.costoDirecto * stats.utility / 100)],
        ["", "PRECIO UNITARIO NETO", "", "", "", numCell(stats.precioUnitarioNeto)]
    );

    const wsApu = XLSX.utils.aoa_to_sheet(apuRows);
    wsApu['!cols'] = [
        { wch: 15 }, // Cat
        { wch: 45 }, // Desc
        { wch: 10 }, // Unid
        { wch: 12 }, // Rend
        { wch: 15 }, // P.U
        { wch: 15 }  // Total
    ];
    return wsApu;
};

const calculateApuTotals = (apu: APU, project: Project) => {
  const laws = apu.useProjectGlobalRates ? project.globalSocialLaws : apu.socialLawsPercentage;
  const overhead = apu.useProjectGlobalRates ? project.globalOverhead : apu.overheadPercentage;
  const utility = apu.useProjectGlobalRates ? project.globalUtility : apu.utilityPercentage;
  
  const sMat = apu.items[ItemCategory.MATERIAL].reduce((s, i) => s + i.total, 0);
  const sMoB = apu.items[ItemCategory.MANO_DE_OBRA].reduce((s, i) => s + i.total, 0);
  const sEq = apu.items[ItemCategory.EQUIPO].reduce((s, i) => s + i.total, 0);
  const sOt = apu.items[ItemCategory.OTROS].reduce((s, i) => s + i.total, 0);
  
  const costoDirecto = sMat + (sMoB * (1 + laws / 100)) + sEq + sOt;
  const factorIndirectos = 1 + (overhead + utility) / 100;
  const precioUnitarioNeto = costoDirecto * factorIndirectos;
  
  return { costoDirecto, precioUnitarioNeto, overhead, utility };
};
