import { GoogleGenAI, Type } from "@google/genai";
import { ItemCategory, SingleFieldSuggestion } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_CONTEXT = "Eres un experto en ingeniería de costos y presupuestos en Chile. Proporcionas análisis técnicos precisos, rendimientos realistas y precios unitarios actualizados para el año 2024-2025 en CLP. No incluyas IVA en los precios.";

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
          text: `Busca en la web precios reales y actualizados de mercado en Chile para el siguiente recurso de construcción:
Recurso: "${description}"
Unidad de medida: "${unit}"
Contexto de la partida de obra: "${apuContext}"

Genera una estimación de precio unitario neto (en CLP, número entero, sin IVA). Devuelve un JSON estructurado con:
- "price": el valor numérico en CLP (entero neto, mayor a 0).
- "reasoning": explicación corta de por qué se estima ese precio y qué fuentes o comercios (como Sodimac, Easy, Construmart, etc.) se tomaron como referencia en Chile (máx 35 palabras).
- "sources": un arreglo de URLs o nombres de los sitios consultados.`
        }]
      }],
      config: {
        tools: [{ googleSearch: {} }],
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
          required: ["price", "reasoning"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
  } catch (error) {
    console.error("Error fetching price from Gemini Web Search:", error);
  }
  
  return {
    price: 0,
    reasoning: "No se pudo obtener información en la web para este recurso.",
    sources: []
  };
};