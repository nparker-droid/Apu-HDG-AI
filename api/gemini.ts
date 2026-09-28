import { GoogleGenAI, Type } from "@google/genai";

/*
 * Proxy de Gemini pensado para el NIVEL GRATUITO de la Gemini API.
 * Única función: estructurar un APU (recursos, unidades, cantidades y rendimientos) SIN precios.
 *
 * El costo cero lo garantiza la key: debe pertenecer a un proyecto de Google AI Studio
 * SIN facturación. En ese caso, al agotar la cuota Google responde 429 y no cobra.
 *
 * Variables de entorno (Vercel):
 *   GEMINI_API_KEY    key del proyecto sin facturación (obligatoria)
 *   GEMINI_MODELS     modelos en orden de preferencia, separados por coma. Si uno no existe
 *                     o agotó su cuota diaria, se usa el siguiente.
 *   ALLOWED_ORIGINS   orígenes adicionales permitidos (el dominio propio siempre se permite)
 */

const parseList = (value: string | undefined, fallback: string[]) => {
  const list = (value || '').split(',').map(s => s.trim()).filter(Boolean);
  return list.length ? list : fallback;
};

// Flash (mejor calidad, ~20 solicitudes/día gratis) → Flash-Lite (~500/día gratis)
const MODELS = parseList(process.env.GEMINI_MODELS, ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']);

const MAX_TEXT = 300;
const MAX_KNOWN_PER_CATEGORY = 40;
const MAX_ITEMS_PER_CATEGORY = 15;
const RATE_LIMIT = 20;               // solicitudes por minuto por IP (por instancia)
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const text = (value: unknown, field: string, required = true): string => {
  const s = typeof value === 'string' ? value.trim() : '';
  if (required && !s) throw new HttpError(400, `Campo "${field}" requerido`);
  if (s.length > MAX_TEXT) throw new HttpError(400, `Campo "${field}" excede ${MAX_TEXT} caracteres`);
  return s;
};

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string').map(v => v.trim().slice(0, 80)).filter(Boolean).slice(0, MAX_KNOWN_PER_CATEGORY)
    : [];

const errorStatus = (e: any): number => Number(e?.status || e?.code || e?.error?.code) || 0;

/** Modelo inexistente, retirado o no disponible para esta key */
const isModelUnavailable = (e: any) => {
  const status = errorStatus(e);
  return status === 404 || (status === 400 && /not (found|supported|available)/i.test(e?.message || ''));
};

const QUOTA_MESSAGE = 'Se agotó la cuota gratuita diaria de Gemini. Se renueva cada día (medianoche, hora del Pacífico).';

/** Ejecuta la llamada con el primer modelo disponible y con cuota */
const withModels = async <T>(call: (model: string) => Promise<T>): Promise<T> => {
  let quotaExhausted = false;
  let lastError: any;
  for (const model of MODELS) {
    try {
      return await call(model);
    } catch (e: any) {
      if (errorStatus(e) === 429) { quotaExhausted = true; continue; }
      if (!isModelUnavailable(e)) throw e;
      lastError = e;
    }
  }
  if (quotaExhausted) throw new HttpError(429, QUOTA_MESSAGE);
  throw new HttpError(503, `Ningún modelo de Gemini disponible (${MODELS.join(', ')}). Revisa GEMINI_MODELS. Detalle: ${lastError?.message || ''}`);
};

const isAllowedOrigin = (req: any): boolean => {
  const origin = req.headers?.origin;
  if (!origin) return false;
  let originHost: string;
  try { originHost = new URL(origin).host; } catch { return false; }
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (originHost === host) return true;
  return parseList(process.env.ALLOWED_ORIGINS, []).includes(origin);
};

const isRateLimited = (req: any): boolean => {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_LIMIT;
};

const resourceList = (quantityDescription: string) => ({
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      description: { type: Type.STRING, description: 'Denominación técnica del recurso' },
      unit: { type: Type.STRING, description: 'Unidad del recurso' },
      quantity: { type: Type.NUMBER, description: quantityDescription },
      note: { type: Type.STRING, description: 'Supuesto o criterio de la cantidad, máximo 20 palabras' }
    },
    required: ['description', 'unit', 'quantity', 'note']
  }
});

const structureSchema = {
  type: Type.OBJECT,
  properties: {
    unit: { type: Type.STRING, description: 'Unidad de pago de la partida' },
    assumptions: { type: Type.STRING, description: 'Condiciones supuestas para el análisis, máximo 50 palabras' },
    materials: resourceList('Cantidad del material por 1 unidad de la partida, incluyendo pérdidas'),
    labor: resourceList('Horas-hombre (HH) de esta especialidad por 1 unidad de la partida'),
    equipment: resourceList('Horas-máquina (HM) u otra unidad del equipo por 1 unidad de la partida'),
    others: resourceList('Cantidad por 1 unidad de la partida')
  },
  required: ['unit', 'assumptions', 'materials', 'labor', 'equipment', 'others']
};

const buildPrompt = (p: {
  name: string; unit: string; chapter: string; project: string; location: string;
  known: Record<string, string[]>;
}) => {
  const knownBlock = Object.entries(p.known)
    .filter(([, list]) => list.length)
    .map(([cat, list]) => `${cat}: ${list.join(' | ')}`)
    .join('\n');

  return `Eres ingeniero de costos con experiencia en presupuestos de obras civiles, hidráulicas y de edificación en Chile.
Estructura el análisis de precio unitario (APU) de la partida indicada. NO entregues precios: solo recursos, unidades y cantidades.

Partida: "${p.name}"
Unidad de la partida: ${p.unit ? `"${p.unit}" (obligatoria: todas las cantidades se refieren a 1 ${p.unit})` : 'no definida: propone la unidad de pago habitual en Chile'}
${p.chapter ? `Capítulo: "${p.chapter}"\n` : ''}${p.project ? `Proyecto: "${p.project}"\n` : ''}${p.location ? `Ubicación: "${p.location}"\n` : ''}
Reglas:
1. Todas las cantidades se expresan por 1 unidad de la partida.
2. Materiales: cantidad neta más pérdidas o despuntes habituales; indica el % de pérdida en la nota.
3. Mano de obra: cantidad = horas-hombre (HH) de cada especialidad por unidad de partida. NO uses rendimientos en unidades/día. Unidad "HH". Sin leyes sociales.
4. Equipos: horas-máquina (HM) por unidad de partida, salvo que otra unidad sea más apropiada.
5. Otros: solo si aplican (herramientas menores, fletes, ensayos, elementos de seguridad específicos).
6. Usa denominaciones técnicas usadas en Chile (p.ej. "Hormigón G25", "Maestro de primera", "Jornal", "Retroexcavadora").
7. Incluye solo recursos necesarios; usa listas vacías cuando una categoría no aplique.
8. Si el título es ambiguo, adopta el caso más típico y decláralo en los supuestos.
${knownBlock ? `9. Recursos ya usados por el usuario: si alguno equivale a un recurso que necesitas, usa EXACTAMENTE esa descripción.\n${knownBlock}` : ''}`;
};

interface CleanItem { description: string; unit: string; quantity: number; note: string }

const cleanItems = (value: unknown): CleanItem[] =>
  (Array.isArray(value) ? value : [])
    .map((i: any) => ({
      description: String(i?.description || '').trim().slice(0, 120),
      unit: String(i?.unit || '').trim().slice(0, 12),
      quantity: Math.round(Number(i?.quantity) * 10000) / 10000,
      note: String(i?.note || '').trim().slice(0, 200)
    }))
    .filter(i => i.description && Number.isFinite(i.quantity) && i.quantity > 0)
    .slice(0, MAX_ITEMS_PER_CATEGORY);

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'Origen no permitido' });
  if (isRateLimited(req)) return res.status(429).json({ error: 'Demasiadas solicitudes seguidas. Espera un minuto.' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no configurada en el servidor. Agrega la variable de entorno en Vercel.' });
  }

  const { action, ...params } = req.body || {};
  if (action !== 'structureApu') return res.status(400).json({ error: `Accion desconocida: ${action}` });

  try {
    const known = params.known || {};
    const prompt = buildPrompt({
      name: text(params.name, 'name'),
      unit: text(params.unit, 'unit', false),
      chapter: text(params.chapter, 'chapter', false),
      project: text(params.project, 'project', false),
      location: text(params.location, 'location', false),
      known: {
        Materiales: stringList(known.materials),
        'Mano de obra': stringList(known.labor),
        Equipos: stringList(known.equipment),
        Otros: stringList(known.others)
      }
    });

    const ai = new GoogleGenAI({ apiKey });
    const { response, model } = await withModels(async model => ({
      model,
      response: await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: structureSchema, temperature: 0.2 }
      })
    }));

    const raw = JSON.parse(response.text || '{}');
    return res.json({
      unit: String(raw.unit || '').trim().slice(0, 12),
      assumptions: String(raw.assumptions || '').trim().slice(0, 400),
      materials: cleanItems(raw.materials),
      labor: cleanItems(raw.labor),
      equipment: cleanItems(raw.equipment),
      others: cleanItems(raw.others),
      model
    });
  } catch (error: any) {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    if (errorStatus(error) === 429) return res.status(429).json({ error: QUOTA_MESSAGE });
    console.error('[Gemini Proxy]', error);
    return res.status(502).json({ error: 'Error al consultar Gemini. Intenta nuevamente.' });
  }
}
