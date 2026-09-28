import { GoogleGenAI, Type } from "@google/genai";

/*
 * Proxy de Gemini pensado para el NIVEL GRATUITO de la Gemini API.
 * El costo cero lo garantiza la key: debe pertenecer a un proyecto de Google AI Studio
 * SIN facturación. En ese caso, al agotar la cuota Google responde 429 y no cobra.
 *
 * Variables de entorno (Vercel):
 *   GEMINI_API_KEY          key del proyecto sin facturación (obligatoria)
 *   GEMINI_MODELS           modelos de texto en orden de preferencia, separados por coma
 *   GEMINI_SEARCH_MODELS    modelos para búsqueda web (Google Search). En nivel gratuito solo
 *                           la familia 2.5 Flash la incluye (cuota diaria compartida)
 *   ALLOWED_ORIGINS         orígenes adicionales permitidos (el dominio propio siempre se permite)
 */

const SYSTEM_CONTEXT = "Eres un experto en ingenieria de costos y presupuestos de obras en Chile. Proporcionas analisis tecnicos precisos, rendimientos realistas y precios unitarios de mercado vigentes en CLP. No incluyas IVA en los precios.";

const parseList = (value: string | undefined, fallback: string[]) => {
  const list = (value || '').split(',').map(s => s.trim()).filter(Boolean);
  return list.length ? list : fallback;
};

const TEXT_MODELS = parseList(process.env.GEMINI_MODELS, ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']);
const SEARCH_MODELS = parseList(process.env.GEMINI_SEARCH_MODELS, ['gemini-2.5-flash', 'gemini-2.5-flash-lite']);

const MAX_TEXT = 300;
const RATE_LIMIT = 20;               // solicitudes por minuto por IP (por instancia)
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const parseJsonObject = (text: string) => {
  const cleaned = text.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found');
  return JSON.parse(cleaned.slice(start, end + 1));
};

const text = (value: unknown, field: string, required = true): string => {
  const s = typeof value === 'string' ? value.trim() : '';
  if (required && !s) throw new HttpError(400, `Campo "${field}" requerido`);
  if (s.length > MAX_TEXT) throw new HttpError(400, `Campo "${field}" excede ${MAX_TEXT} caracteres`);
  return s;
};

const num = (value: unknown, field: string): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new HttpError(400, `Campo "${field}" debe ser numérico`);
  return n;
};

const errorStatus = (e: any): number => Number(e?.status || e?.code || e?.error?.code) || 0;

/** Modelo inexistente, retirado o no disponible para esta key: se prueba el siguiente */
const isModelUnavailable = (e: any) => {
  const status = errorStatus(e);
  return status === 404 || (status === 400 && /not (found|supported|available)/i.test(e?.message || ''));
};

const quotaError = () => new HttpError(429, 'Se agotó la cuota gratuita de Gemini. Se renueva diariamente (medianoche, hora del Pacífico). Mientras tanto, ingresa los valores manualmente.');

/** Ejecuta la llamada con el primer modelo disponible de la lista */
const withModels = async <T>(models: string[], call: (model: string) => Promise<T>): Promise<T> => {
  let lastError: any;
  for (const model of models) {
    try {
      return await call(model);
    } catch (e: any) {
      if (errorStatus(e) === 429) throw quotaError();
      if (!isModelUnavailable(e)) throw e;
      lastError = e;
    }
  }
  throw new HttpError(503, `Ningún modelo de Gemini disponible (${models.join(', ')}). Revisa GEMINI_MODELS / GEMINI_SEARCH_MODELS. Detalle: ${lastError?.message || ''}`);
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

const apuSchema = {
  type: Type.OBJECT,
  properties: {
    materials: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { description: { type: Type.STRING }, unit: { type: Type.STRING }, unitPrice: { type: Type.NUMBER }, quantity: { type: Type.NUMBER } }, required: ["description","unit","unitPrice","quantity"] }
    },
    labor: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { description: { type: Type.STRING }, unit: { type: Type.STRING }, unitPrice: { type: Type.NUMBER }, performance: { type: Type.NUMBER } }, required: ["description","unit","unitPrice","performance"] }
    },
    equipment: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { description: { type: Type.STRING }, unit: { type: Type.STRING }, unitPrice: { type: Type.NUMBER }, performance: { type: Type.NUMBER } }, required: ["description","unit","unitPrice","performance"] }
    }
  },
  required: ["materials","labor","equipment"]
};

const priceSchema = {
  type: Type.OBJECT,
  properties: { price: { type: Type.NUMBER }, reasoning: { type: Type.STRING } },
  required: ["price","reasoning"]
};

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
  const ai = new GoogleGenAI({ apiKey });

  try {
    switch (action) {
      case 'suggestApu': {
        const name = text(params.name, 'name');
        const response = await withModels(TEXT_MODELS, model => ai.models.generateContent({
          model,
          contents: `${SYSTEM_CONTEXT} Genera un analisis de precio unitario (APU) detallado para la partida: "${name}".`,
          config: { responseMimeType: "application/json", responseSchema: apuSchema }
        }));
        return res.json(JSON.parse(response.text || '{}'));
      }

      case 'deviation': {
        const category = text(params.category, 'category');
        const description = text(params.description, 'description');
        const type = text(params.type, 'type');
        const userVal = num(params.userVal, 'userVal');
        const avgVal = num(params.avgVal, 'avgVal');
        const response = await withModels(TEXT_MODELS, model => ai.models.generateContent({
          model,
          contents: `${SYSTEM_CONTEXT} En el contexto de "${description}" (${category}), el usuario ingreso un ${type} de ${userVal} CLP, pero el promedio de mercado es ${avgVal} CLP. Explica brevemente, maximo 15 palabras, por que podria existir esta desviacion en Chile.`
        }));
        return res.json({ text: response.text?.trim() || "Desviacion fuera de rango." });
      }

      case 'webPrice': {
        const description = text(params.description, 'description');
        const unit = text(params.unit, 'unit', false) || 'UN';
        const apuContext = text(params.apuContext, 'apuContext', false);

        // 1) Búsqueda web con Google Search: en nivel gratuito solo la familia 2.5 Flash la incluye.
        //    Si no está disponible para la key o se agotó su cuota, se pasa a la estimación sin web.
        try {
          const prompt = `${SYSTEM_CONTEXT}\nBusca en la web precios reales y actualizados de mercado en Chile para el siguiente recurso de construccion:\nRecurso: "${description}"\nUnidad de medida: "${unit}"\nContexto de la partida de obra: "${apuContext}"\n\nPrioriza comercios, proveedores, licitaciones, presupuestos o referencias chilenas. Estima un precio unitario neto en CLP, entero, sin IVA.\nDevuelve solamente JSON valido, sin markdown y sin texto adicional:\n{"price":12345,"reasoning":"explicacion corta en maximo 35 palabras","sources":["url o comercio consultado"]}`;
          const response = await withModels(SEARCH_MODELS, model => ai.models.generateContent({
            model,
            contents: prompt,
            config: { tools: [{ googleSearch: {} }] }
          }));
          // Sin JSON válido no se intenta adivinar el precio desde el texto (capturaba años u otras cifras)
          const parsed = parseJsonObject(response.text || '');
          const price = Math.round(Number(parsed.price) || 0);
          const groundingSources = (response as any).candidates?.[0]?.groundingMetadata?.groundingChunks
            ?.map((chunk: any) => chunk.web?.uri || chunk.web?.title)
            ?.filter(Boolean) || [];
          if (price > 0 && groundingSources.length > 0) {
            return res.json({
              price,
              reasoning: parsed.reasoning || "Precio estimado con busqueda web.",
              sources: Array.from(new Set([...(parsed.sources || []), ...groundingSources])),
              source: 'web'
            });
          }
        } catch (e: any) {
          console.warn('[Gemini Proxy] busqueda web no disponible, se usa estimacion sin web:', e?.message);
        }

        // 2) Estimación del modelo sin búsqueda web (sin fuentes verificables)
        const fallback = await withModels(TEXT_MODELS, model => ai.models.generateContent({
          model,
          contents: `${SYSTEM_CONTEXT} Estima un precio unitario neto en CLP sin IVA para "${description}", unidad "${unit}", usado en "${apuContext}" en Chile.`,
          config: { responseMimeType: "application/json", responseSchema: priceSchema }
        }));
        const parsed = parseJsonObject(fallback.text || '{}');
        return res.json({
          price: Math.round(Number(parsed.price) || 0),
          reasoning: parsed.reasoning || "Estimacion IA sin fuente web.",
          sources: [],
          source: 'ia'
        });
      }

      default:
        return res.status(400).json({ error: `Accion desconocida: ${action}` });
    }
  } catch (error: any) {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    if (errorStatus(error) === 429) return res.status(429).json({ error: quotaError().message });
    console.error('[Gemini Proxy]', error);
    return res.status(502).json({ error: 'Error al consultar Gemini. Intenta nuevamente.' });
  }
}
