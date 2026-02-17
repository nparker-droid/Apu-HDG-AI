
import { GoogleGenAI, Type } from "@google/genai";
import { ItemCategory, SingleFieldSuggestion } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_CONTEXT = "Eres un experto en ingeniería de costos y presupuestos para el mercado de la construcción en CHILE. Todos los precios deben ser en PESOS CHILENOS (CLP) vigentes para el año 2026, considerando la inflación proyectada y costos locales de mano de obra y materiales.";

export const getApuSuggestions = async (name: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `${SYSTEM_CONTEXT} Genera un análisis de precio unitario (APU) detallado para la partida: "${name}". No uses IVA.`,
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
                unitPrice: { type: Type.NUMBER, description: "Precio en CLP sin puntos ni comas" },
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
                unit: { type: Type.STRING, description: "Usar 'hr' o 'dia'" },
                unitPrice: { type: Type.NUMBER, description: "Sueldo liquido diario o hora en CLP" },
                performance: { type: Type.NUMBER, description: "Rendimiento (HH/Unidad)" }
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
                unitPrice: { type: Type.NUMBER, description: "Costo arriendo/hora en CLP" },
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
    contents: `${SYSTEM_CONTEXT} En el contexto de "${description}" (${category}), el usuario ingresó un ${type} de ${userVal} CLP, pero el promedio de mercado es ${avgVal} CLP. Explica brevemente (máx 15 palabras) por qué podría existir esta desviación en Chile 2026.`,
  });
  return response.text?.trim() || "Desviación fuera de rango estándar.";
};

export const getFieldSuggestion = async (
  context: string, 
  description: string, 
  field: 'price' | 'performance'
): Promise<SingleFieldSuggestion> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `${SYSTEM_CONTEXT} Sugiere un ${field === 'price' ? 'precio unitario en CLP' : 'rendimiento'} para el recurso "${description}" usado en "${context}".`,
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
