import { GoogleGenAI, Type } from "@google/genai";
import { ItemCategory, SingleFieldSuggestion } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_CONTEXT = "Eres un experto en ingeniería de costos y presupuestos en Chile. Proporcionas análisis técnicos precisos, rendimientos realistas y precios unitarios actualizados para el año 2024-2025 en CLP. No incluyas IVA en los precios.";

const parseJsonObject = (text: string) => {
  const cleaned = text.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found');
  return JSON.parse(cleaned.slice(start, end + 1));
};

export const getApuSuggestions = async (name: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: `${SYSTEM_CONTEXT} Genera un análisis de precio unitario (APU) detallado para la partida: "${name}".` }] }],
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
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `${SYSTEM_CONTEXT} En el contexto de "${description}" (${category}), el usuario ingresó un ${type} de ${userVal} CLP, pero el promedio de mercado es ${avgVal} CLP. Explica brevemente (máx 15 palabras) por qué podría existir esta desviación en Chile.`
  });
  return response.text?.trim() || "Desviación fuera de rango.";
};

export const getFieldSuggestion = async (
  context: string, 
  description: string, 
  field: 'price' | 'performance'
): Promise<SingleFieldSuggestion> => {
  const response = await ai.models.generateContent({
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
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [{
          text: `${SYSTEM_CONTEXT}
Busca en la web precios reales y actualizados de mercado en Chile para el siguiente recurso de construcción:
Recurso: "${description}"
Unidad de medida: "${unit}"
Contexto de la partida de obra: "${apuContext}"

Genera una estimación de precio unitario neto en CLP, entero, sin IVA.
Devuelve solamente JSON válido, sin markdown:
{"price":12345,"rea