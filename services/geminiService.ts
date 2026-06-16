import { GoogleGenAI, Type } from "@google/genai";
import { ItemCategory, SingleFieldSuggestion } from "../types";

const SYSTEM_CONTEXT = "Eres un experto en ingenieria de costos y presupuestos en Chile. Proporcionas analisis tecnicos precisos, rendimientos realistas y precios unitarios actualizados para el periodo 2025-2026 en CLP. No incluyas IVA en los precios.";

// En producción (Vercel), todas las llamadas pasan por /api/gemini donde la key es server-side.
// En desarrollo local (npm run dev), se llama a Gemini directamente para simplificar.
const IS_DEV = import.meta.env.DEV;

// ── Llamada al proxy de producción ─────────────────────────────────────────────

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

// ── Helpers para llamadas directas en dev ──────────────────────────────────────

const getApiKey = () => {
  const processKey = typeof process !== 'undefined' ? process.env?.API_KEY : undefined;
  const viteKey = import.meta.env?.VITE_GEMINI_API_KEY || import.meta.env?.VITE_API_KEY;
  return processKey || viteKey || '';
};

const getAi = () => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API Key no configurada. Agrega GEMINI_API_KEY a .env.local para desarrollo local.');
  return new GoogleGenAI({ apiKey });
};

const parseJsonObject = (text: string) => {
  const cleaned = text.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found');
  return JSON.parse(cleaned.slice(start, end + 1));
};

const extractPriceFromText = (text: string) => {
  const candidates = Array.from(text.matchAll(/\$?\s?(\d{1,3}(?:\.\d{3})+|\d{4,9})(?:\s?CLP)?/gi))
    .map(match => Number(match[1].replace(/\./g, '')))
    .filter(value => value > 0);
  if (candidates.length === 0) return 0;
  const reasonable = candidates.filter(value => value >= 100 && value <= 500_000_000);
  return Math.round(reasonable[0] || candidates[0] || 0);
};

// ── API pública ────────────────────────────────────────────────────────────────

export const getApuSuggestions = async (name: string) => {
  if (!IS_DEV) return callProxy('suggestApu', { name });

  const response = await getAi().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: `${SYSTEM_CONTEXT} Genera un analisis de precio unitario (APU) detallado para la partida: "${name}".` }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          materials: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { description: { type: Type.STRING }, unit: { type: Type.STRING }, unitPrice: { type: Type.NUMBER }, quantity: { type: Type.NUMBER } }, required: ["description","unit","unitPrice","quantity"] } },
          labor: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { description: { type: Type.STRING }, unit: { type: Type.STRING }, unitPrice: { type: Type.NUMBER }, performance: { type: Type.NUMBER } }, required: ["description","unit","unitPrice","performance"] } },
          equipment: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { description: { type: Type.STRING }, unit: { type: Type.STRING }, unitPrice: { type: Type.NUMBER }, performance: { type: Type.NUMBER } }, required: ["description","unit","unitPrice","performance"] } }
        },
        required: ["materials","labor","equipment"]
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const getDeviationReasoning = async (
  category: ItemCategory,
  description: string,
  userVal: number,
  avgVal: number,
  type: string
): Promise<string> => {
  if (!IS_DEV) {
    const result = await callProxy('deviation', { category, description, userVal, avgVal, type });
    return result.text || "Desviacion fuera de rango.";
  }

  const response = await getAi().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `${SYSTEM_CONTEXT} En el contexto de "${description}" (${category}), el usuario ingreso un ${type} de ${userVal} CLP, pero el promedio de mercado es ${avgVal} CLP. Explica brevemente, maximo 15 palabras, por que podria existir esta desviacion en Chile.`
  });
  return response.text?.trim() || "Desviacion fuera de rango.";
};

export const getFieldSuggestion = async (
  context: string,
  description: string,
  field: 'price' | 'performance'
): Promise<SingleFieldSuggestion> => {
  if (!IS_DEV) return callProxy('fieldSuggestion', { context, description, field });

  const response = await getAi().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: `${SYSTEM_CONTEXT} Sugiere un ${field === 'price' ? 'precio unitario en CLP' : 'rendimiento'} para el recurso "${description}" usado en "${context}".` }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: { value: { type: Type.NUMBER }, reasoning: { type: Type.STRING } },
        required: ["value","reasoning"]
      }
    }
  });
  return JSON.parse(response.text || '{"value": 0, "reasoning": "Error"}');
};

export const getResourcePriceFromWeb = async (
  description: string,
  unit: string,
  apuContext: string
): Promise<{ price: number; reasoning: string; sources: string[] }> => {
  if (!IS_DEV) return callProxy('webPrice', { description, unit, apuContext });

  try {
    const prompt = `${SYSTEM_CONTEXT}\nBusca en la web precios reales y actualizados de mercado en Chile para el siguiente recurso de construccion:\nRecurso: "${description}"\nUnidad de medida: "${unit}"\nContexto de la partida de obra: "${apuContext}"\n\nPrioriza comercios, proveedores, licitaciones, presupuestos o referencias chilenas. Estima un precio unitario neto en CLP, entero, sin IVA.\nDevuelve solamente JSON valido, sin markdown y sin texto adicional:\n{"price":12345,"reasoning":"explicacion corta en maximo 35 palabras","sources":["url o comercio consultado"]}`;

    const response = await getAi().models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { tools: [{ googleSearch: {} }] }
    });

    if (response.text) {
      let parsed: { price?: number; reasoning?: string; sources?: string[] };
      try { parsed = parseJsonObject(response.text); }
      catch {
        parsed = { price: extractPriceFromText(response.text), reasoning: response.text.replace(/\s+/g, ' ').slice(0, 180), sources: [] };
      }

      const groundingSources = (response as any).candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((chunk: any) => chunk.web?.uri || chunk.web?.title)
        ?.filter(Boolean) || [];

      const price = Math.round(Number(parsed.price) || 0);
      if (price > 0) {
        return { price, reasoning: parsed.reasoning || "Precio estimado con busqueda web.", sources: Array.from(new Set([...(parsed.sources || []), ...groundingSources])) };
      }
    }

    const fallback = await getAi().models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${SYSTEM_CONTEXT} Estima un precio unitario neto en CLP sin IVA para "${description}", unidad "${unit}", usado en "${apuContext}" en Chile. Devuelve JSON valido: {"price":12345,"reasoning":"maximo 35 palabras","sources":[]}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { price: { type: Type.NUMBER }, reasoning: { type: Type.STRING }, sources: { type: Type.ARRAY, items: { type: Type.STRING } } },
          required: ["price","reasoning","sources"]
        }
      }
    });

    if (fallback.text) {
      const parsed = parseJsonObject(fallback.text);
      return { price: Math.round(Number(parsed.price) || 0), reasoning: parsed.reasoning || "Precio estimado por IA sin fuente web directa.", sources: parsed.sources || [] };
    }
  } catch (error) {
    console.error("Error fetching price from Gemini:", error);
  }

  return { price: 0, reasoning: "No se pudo obtener informacion. Verifica la API key y la conexion.", sources: [] };
};
