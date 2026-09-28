// Todas las llamadas pasan por /api/gemini, donde vive la key (server-side).
// En producción lo sirve Vercel; en desarrollo (npm run dev) lo sirve un middleware de Vite
// (ver vite.config.ts) que ejecuta el mismo handler. La key nunca llega al navegador.

export interface StructuredResource {
  description: string;
  unit: string;
  /** Por 1 unidad de partida. Mano de obra: HH por unidad; equipos: HM por unidad */
  quantity: number;
  note: string;
}

export interface StructuredApu {
  unit: string;
  assumptions: string;
  materials: StructuredResource[];
  labor: StructuredResource[];
  equipment: StructuredResource[];
  others: StructuredResource[];
  model: string;
}

export interface StructureApuRequest {
  name: string;
  unit?: string;
  chapter?: string;
  project?: string;
  location?: string;
  /** Descripciones de recursos ya usados por el usuario, para reutilizar su nomenclatura */
  known?: { materials?: string[]; labor?: string[]; equipment?: string[]; others?: string[] };
}

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

/** Estructura un APU (recursos, unidades y cantidades por unidad de partida) sin precios */
export const structureApu = async (req: StructureApuRequest): Promise<StructuredApu> =>
  callProxy('structureApu', req);
