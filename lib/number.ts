// Utilidades numéricas — formato oficial chileno: "." miles, "," decimales.

/**
 * Convierte texto ingresado por el usuario a número.
 * Acepta "." o "," como separador decimal.
 * - Ambos presentes: el último que aparece es el decimal ("1.234,5" / "1,234.5").
 * - Solo ",": decimal (salvo varias comas → miles).
 * - Solo ".": decimal, salvo varios puntos → miles.
 *   En modo 'money', un único "." seguido de exactamente 3 dígitos se interpreta como miles ("1.500" → 1500).
 */
export const parseNumber = (value: string | number | null | undefined, mode: 'decimal' | 'money' = 'decimal'): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  let s = String(value).replace(/[\s$]/g, '').replace(/[^\d.,\-]/g, '');
  if (!s) return 0;
  const neg = s.startsWith('-');
  s = s.replace(/-/g, '');
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  const dots = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;

  if (dots > 0 && commas > 0) {
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (commas > 0) {
    s = commas > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (dots > 1) {
    s = s.replace(/\./g, '');
  } else if (dots === 1 && mode === 'money' && /^\d{1,3}\.\d{3}$/.test(s)) {
    s = s.replace('.', '');
  }
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return neg ? -n : n;
};

/** Formato es-CL determinístico (no depende del ICU del navegador). */
export const formatNumber = (value: number, minDecimals = 0, maxDecimals = minDecimals): string => {
  const n = Number(value) || 0;
  const fixed = Math.abs(n).toFixed(maxDecimals);
  let [intPart, decPart = ''] = fixed.split('.');
  while (decPart.length > minDecimals && decPart.endsWith('0')) decPart = decPart.slice(0, -1);
  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = n < 0 && (Number(intPart.replace(/\./g, '')) > 0 || Number(decPart) > 0) ? '-' : '';
  return `${sign}${intPart}${decPart ? ',' + decPart : ''}`;
};

export const formatCLP = (value: number) => `$${formatNumber(Math.round(Number(value) || 0))}`;

/** Cantidad: hasta 3 decimales, sin ceros sobrantes (mín. los indicados). */
export const formatQty = (value: number, minDecimals = 0) => formatNumber(value, minDecimals, 3);
