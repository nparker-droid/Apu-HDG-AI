import { ItemCategory } from "../types";

// Todas las llamadas pasan por /api/gemini, donde vive la key (server-side).
// En producción lo sirve Vercel; en desarrollo (npm run dev) lo sirve un middleware de Vite
// (ver vite.config.ts) que ejecuta el mismo handler. La key nunca llega al navegador.

const callProxy = async (action: string, params: object): Promise<any> => {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(err.error || `Error del servidor: ${response.status}`);
  }
  return response.json();
};

// ── API pública ────────────────────────────────────────────────────────────────

export const getApuSuggestions = async (name: string) => callProxy('suggestApu', { name });

export const getDeviationReasoning = async (
  category: ItemCategory,
  description: string,
  userVal: number,
  avgVal: number,
  type: string
): Promise<string> => {
  try {
    const result = await callProxy('deviation', { category, description, userVal, avgVal, type });
    return result.text || "Desviacion fuera de rango.";
  } catch {
    // Explicación opcional: si no hay cuota o conexión, basta con la alerta de desviación
    return "Desviacion fuera de rango.";
  }
};

/**
 * Precio de un recurso. `source` indica el origen:
 * 'web' → búsqueda en Google con fuentes; 'ia' → estimación del modelo sin fuentes verificables.
 */
export const getResourcePriceFromWeb = async (
  description: string,
  unit: string,
  apuContext: string
): Promise<{ price: number; reasoning: string; sources: string[]; source: 'web' | 'ia' }> =>
  callProxy('webPrice', { description, unit, apuContext: apuContext.slice(0, 300) });
