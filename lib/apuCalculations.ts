import { APU, Project, ItemCategory } from '../types';

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
