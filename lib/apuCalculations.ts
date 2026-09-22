import { APU, APUItem, Project, ItemCategory } from '../types';

export interface ApuTotals {
  subMat: number;
  subMoRaw: number;
  lawsAmount: number;
  subMoTotal: number;
  subEq: number;
  subOt: number;
  costoDirecto: number;
  costoNetoUnitario: number;
  precioUnitarioNeto: number;
  laws: number;
  overhead: number;
  utility: number;
}

export const calculateApuTotals = (apu: APU, project: Project): ApuTotals => {
  const laws = apu.useProjectGlobalRates ? project.globalSocialLaws : apu.socialLawsPercentage;
  const overhead = apu.useProjectGlobalRates ? project.globalOverhead : apu.overheadPercentage;
  const utility = apu.useProjectGlobalRates ? project.globalUtility : apu.utilityPercentage;

  const subMat = (apu.items[ItemCategory.MATERIAL] ?? []).reduce((s, i) => s + (i.total || 0), 0);
  const subMoRaw = (apu.items[ItemCategory.MANO_DE_OBRA] ?? []).reduce((s, i) => s + (i.total || 0), 0);
  const lawsAmount = subMoRaw * (laws / 100);
  const subMoTotal = subMoRaw + lawsAmount;
  const subEq = (apu.items[ItemCategory.EQUIPO] ?? []).reduce((s, i) => s + (i.total || 0), 0);
  const subOt = (apu.items[ItemCategory.OTROS] ?? []).reduce((s, i) => s + (i.total || 0), 0);

  const costoDirecto = subMat + subMoTotal + subEq + subOt;
  const costoNetoUnitario = costoDirecto * (1 + (overhead + utility) / 100);
  const precioUnitarioNeto = (apu.divideUnitPrice && (apu.divisorQuantity ?? 0) > 0)
    ? costoNetoUnitario / (apu.divisorQuantity || 1)
    : costoNetoUnitario;

  return {
    subMat, subMoRaw, lawsAmount, subMoTotal, subEq, subOt,
    costoDirecto, costoNetoUnitario, precioUnitarioNeto,
    laws, overhead, utility
  };
};

export const CATEGORIES: ItemCategory[] = [ItemCategory.MATERIAL, ItemCategory.MANO_DE_OBRA, ItemCategory.EQUIPO, ItemCategory.OTROS];

/**
 * Total de una línea de recurso.
 * - Mano de obra: Rend. (unid. recurso por unid. de partida, p.ej. HH/m³) × P.Unit.
 * - Resto: Cant. × P.Unit.
 */
export const computeItemTotal = (category: ItemCategory, item: APUItem): number => {
  const price = Number(item.unitPrice) || 0;
  if (category === ItemCategory.MANO_DE_OBRA) return (Number(item.performance) || 0) * price;
  return (Number(item.quantity) || 0) * price;
};

/** Cantidad efectiva que muestra/edita la UI según categoría */
export const itemAmount = (category: ItemCategory, item: APUItem): number =>
  category === ItemCategory.MANO_DE_OBRA ? (Number(item.performance) || 0) : (Number(item.quantity) || 0);

/**
 * Normaliza un APU (datos antiguos, biblioteca, importaciones):
 * - Garantiza las 4 categorías.
 * - Equipos/Materiales/Otros con rendimiento ≠ 1 (p.ej. retro 0,12 hm/m³): se consolida en la cantidad
 *   para que el total sea siempre Cant. × P.Unit. (antes se perdía al editar).
 * - Recalcula todos los totales con una única regla.
 * - Si la bandera de tasas no está definida: usa tasas del proyecto cuando los % coinciden con los globales.
 */
export const normalizeApu = (apu: APU, project?: Project | null): APU => {
  const items = {} as APU['items'];
  CATEGORIES.forEach(cat => {
    items[cat] = (apu.items?.[cat] ?? []).map(raw => {
      const it: APUItem = { ...raw, id: raw.id || crypto.randomUUID() };
      if (cat !== ItemCategory.MANO_DE_OBRA) {
        const perf = Number(it.performance);
        if (Number.isFinite(perf) && perf > 0 && perf !== 1) {
          it.quantity = (Number(it.quantity) || 1) * perf;
        }
        it.performance = 1;
      }
      it.total = computeItemTotal(cat, it);
      return it;
    });
  });
  let useGlobal = apu.useProjectGlobalRates;
  if (useGlobal === undefined || useGlobal === null) {
    useGlobal = !project || (
      Number(apu.socialLawsPercentage) === Number(project.globalSocialLaws) &&
      Number(apu.overheadPercentage) === Number(project.globalOverhead) &&
      Number(apu.utilityPercentage) === Number(project.globalUtility)
    );
  }
  return {
    ...apu,
    items,
    useProjectGlobalRates: useGlobal,
    socialLawsPercentage: Number(apu.socialLawsPercentage ?? project?.globalSocialLaws ?? 0),
    overheadPercentage: Number(apu.overheadPercentage ?? project?.globalOverhead ?? 0),
    utilityPercentage: Number(apu.utilityPercentage ?? project?.globalUtility ?? 0),
    quantity: Number(apu.quantity) || 0,
  };
};

/** Detecta partidas incompletas: P.U. en $0 o recursos con total $0. */
export const getZeroCostInfo = (apu: APU, project: Project): { isZero: boolean; zeroItems: number } => {
  const { precioUnitarioNeto } = calculateApuTotals(apu, project);
  let zeroItems = 0;
  CATEGORIES.forEach(cat => (apu.items?.[cat] ?? []).forEach(i => { if (!(Number(i.total) > 0)) zeroItems++; }));
  return { isZero: !(precioUnitarioNeto > 0) || zeroItems > 0, zeroItems };
};
