import { GoogleGenAI, Type } from "@google/genai";

const SYSTEM_CONTEXT = "Eres un experto en ingenieria de costos y presupuestos en Chile. Proporcionas analisis tecnicos precisos, rendimientos realistas y precios unitarios actualizados para el periodo 2025-2026 en CLP. No incluyas IVA en los precios.";

const parseJsonObject = (text: string) => {
  const cleaned = text.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found');
  return JSON.parse(cleaned.slice(start, end + 1));
};

const extractPriceFromText = (text: string): number => {
  const candidates = Array.from(text.matchAll(/\$?\s?(\d{1,3}(?:\.\d{3})+|\d{4,9})(?:\s?CLP)?/gi))
    .map(match => Number(match[1].replace(/\./g, '')))
    .filter(value => value > 0);
  if (candidates.length === 0) return 0;
  const reasonable = candidates.filter(value => value >= 100 && value <= 500_000_000);
  return Math.round(reasonable[0] || candidates[0] || 0);
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no configurada en el servidor. Agrega la variable de entorno en Vercel.' });
  }

  const { action, ...params } = req.body || {};
  if (!action) return res.status(400).json({ error: 'Campo "action" requerido' });

  const ai = new GoogleGenAI({ apiKey });

  try {
    switch (action) {
      case 'suggestApu': {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ role: "user", parts: [{ text: `${SYSTEM_CONTEXT} Genera un analisis de precio unitario (APU) detallado para la partida: "${params.name}".` }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
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
            }
          }
        });
        return res.json(JSON.parse(response.text || '{}'));
      }

      case 'deviation': {
        const { category, description, userVal, avgVal, type } = params;
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `${SYSTEM_CONTEXT} En el contexto de "${description}" (${category}), el usuario ingreso un ${type} de ${userVal} CLP, pero el promedio de mercado es ${avgVal} CLP. Explica brevemente, maximo 15 palabras, por que podria existir esta desviacion en Chile.`
        });
        return res.json({ text: response.text?.trim() || "Desviacion fuera de rango." });
      }

      case 'fieldSuggestion': {
        const { context, description, field } = params;
        const response = await ai.models.generateContent({
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
        return res.json(JSON.parse(response.text || '{"value":0,"reasoning":"Error"}'));
      }

      case 'webPrice': {
        const { description, unit, apuContext } = params;
        const prompt = `${SYSTEM_CONTEXT}\nBusca en la web precios reales y actualizados de mercado en Chile para el siguiente recurso de construccion:\nRecurso: "${description}"\nUnidad de medida: "${unit}"\nContexto de la partida de obra: "${apuContext}"\n\nPrioriza comercios, proveedores, licitaciones, presupuestos o referencias chilenas. Estima un precio unitario neto en CLP, entero, sin IVA.\nDevuelve solamente JSON valido, sin markdown y sin texto adicional:\n{"price":12345,"reasoning":"explicacion corta en maximo 35 palabras","sources":["url o comercio consultado"]}`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: { tools: [{ googleSearch: {} }] }
        });

        if (response.text) {
          let parsed: any;
          try { parsed = parseJsonObject(response.text); }
          catch {
            parsed = { price: extractPriceFromText(response.text), reasoning: response.text.replace(/\s+/g, ' ').slice(0, 180), sources: [] };
          }

          const groundingSources = (response as any).candidates?.[0]?.groundingMetadata?.groundingChunks
            ?.map((chunk: any) => chunk.web?.uri || chunk.web?.title)
            ?.filter(Boolean) || [];

          const price = Math.round(Number(parsed.price) || 0);
          if (price > 0) {
            return res.json({
              price,
              reasoning: parsed.reasoning || "Precio estimado con busqueda web.",
              sources: Array.from(new Set([...(parsed.sources || []), ...groundingSources]))
            });
          }
        }

        const fallback = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `${SYSTEM_CONTEXT} Estima un precio unitario neto en CLP sin IVA para "${description}", unidad "${unit}", usado en "${apuContext}" en Chile. Devuelve JSON: {"price":12345,"reasoning":"maximo 35 palabras","sources":[]}`,
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
          return res.json({ price: Math.round(Number(parsed.price) || 0), reasoning: parsed.reasoning || "Estimacion IA sin fuente web.", sources: parsed.sources || [] });
        }

        return res.json({ price: 0, reasoning: "No se pudo obtener precio. Verifica la conexion y la API key.", sources: [] });
      }

      default:
        return res.status(400).json({ error: `Accion desconocida: ${action}` });
    }
  } catch (error: any) {
    console.error('[Gemini Proxy]', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor Gemini' });
  }
}
