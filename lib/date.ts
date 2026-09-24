/** Formatea una fecha ISO ("2026-09-24") como "Septiembre 2026" en español. */
export const formatMonthYear = (isoDate: string): string => {
  if (!isoDate) return '';
  const d = new Date(`${isoDate}T00:00:00`);
  if (isNaN(d.getTime())) return '';
  const text = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(d);
  return text.charAt(0).toUpperCase() + text.slice(1);
};
