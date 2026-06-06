import { GoogleGenAI, Type } from "@google/genai";
import { ItemCategory, SingleFieldSuggestion } from "../types";

const SYSTEM_CONTEXT = "Eres un experto en ingenieria de costos y presupuestos en Chile. Proporcionas analisis tecnicos precisos, rendimientos realistas y precios unitarios actualizados para el periodo 2025-2026 en CLP. No incluyas IVA en los precios.";

const getApiKey = () => {
  const processKey = typeof process !== 'undefined' ? process.env?.API_KEY : undefined;
  const viteKey = import.meta.env?.VITE_GEMINI_API_KEY || import.meta.env?.VITE_API_KEY;
  return processKey || viteKey || '';
};

const getAi = () => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API_KEY no configurada');
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
  const reasonable = candidates.filter(value => value >= 100 && value <= 500000000);
  return Math.round(reasonable[0] || candidates[0] || 0);
};

export const getApuSuggestions = async (name: string) => {
  const response = await getAi().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: `${SYSTEM_CONTEXT} Genera un analisis de precio unitario (APU) detallado para la partida: "${name}".` }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          materials: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                unit: { type: Type.STRING },
                unitPrice: { type: Type.NUMBER },
                quantity: { type: Type.NUMBER }
              },
              required: ["description", "unit", "unitPrice", "quantity"]
            }
          },
          labor: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                unit: { type: Type.STRING },
                unitPrice: { type: Type.NUMBER },
                performance: { type: Type.NUMBER }
              },
              required: ["description", "unit", "unitPrice", "performance"]
            }
          },
          equipment: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                unit: { type: Type.STRING },
                unitPrice: { type: Type.NUMBER },
                performance: { type: Type.NUMBER }
              },
              required: ["description", "unit", "unitPrice", "performance"]
            }
          }
        },
        required: ["materials", "labor", "equipment"]
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
  const response = await getAi().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: `${SYSTEM_CONTEXT} Sugiere un ${field === 'price' ? 'precio unitario en CLP' : 'rendimiento'} para el recurso "${description}" usado en "${context}".` }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          value: { type: Type.NUMBER },
          reasoning: { type: Type.STRING }
        },
        required: ["value", "reasoning"]
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
  try {
    const prompt = `${SYSTEM_CONTEXT}
Busca en la web precios reales y actualizados de mercado en Chile para el siguiente recurso de construccion:
Recurso: "${description}"
Unidad de medida: "${unit}"
Contexto de la partida de obra: "${apuContext}"

Prioriza comercios, proveedores, licitaciones, presupuestos o referencias chilenas. Estima un precio unitario neto en CLP, entero, sin IVA.
Devuelve solamente JSON valido, sin markdown y sin texto adicional:
{"price":12345,"reasoning":"explicacion corta en maximo 35 palabras","sources":["url o comercio consultado"]}`;

    const response = await getAi().models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    if (response.text) {
      let parsed: { price?: number; reasoning?: string; sources?: string[] };
      try {
        parsed = parseJsonObject(response.text);
      } catch {
        parsed = {
          price: extractPriceFromText(response.text),
          reasoning: response.text.replace(/\s+/g, ' ').slice(0, 180),
          sources: []
        };
      }

      const groundingSources = (response as any).candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((chunk: any) => chunk.web?.uri || chunk.web?.title)
        ?.filter(Boolean) || [];

      const price = Math.round(Number(parsed.price) || 0);
      if (price > 0) {
        return {
          price,
          reasoning: parsed.reasoning || "Precio estimado con busqueda web.",
          sources: Array.from(new Set([...(parsed.sources || []), ...groundingSources]))
        };
      }
    }

    const fallback = await getAi().models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${SYSTEM_CONTEXT} Estima un precio unitario neto en CLP sin IVA para "${description}", unidad "${unit}", usado en "${apuContext}" en Chile. Devuelve JSON valido: {"price":12345,"reasoning":"maximo 35 palabras","sources":[]}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            price: { type: Type.NUMBER },
            reasoning: { type: Type.STRING },
            sources: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["price", "reasoning", "sources"]
        }
      }
    });

    if (fallback.text) {
      const parsed = parseJsonObject(fallback.text);
      return {
        price: Math.round(Number(parsed.price) || 0),
        reasoning: parsed.reasoning || "Precio estimado por IA sin fuente web directa.",
        sources: parsed.sources || []
      };
    }
  } catch (error) {
    console.error("Error fetching price from Gemini Web Search:", error);
  }

  return {
    price: 0,
    reasoning: "No se pudo obtener informacion en la web para este recurso. Verifica la API key y la conexion.",
    sources: []
  };
};