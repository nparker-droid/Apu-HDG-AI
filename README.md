# APU Master AI – Hidrogestión

Herramienta de Análisis de Precios Unitarios (APU) con sugerencias de IA (Gemini) y respaldo en Google Drive.

## Ejecutar en local

1. `npm install`
2. Crear `.env.local` con:
   ```
   GEMINI_API_KEY=tu_key
   VITE_GOOGLE_CLIENT_ID=tu_client_id_oauth   # opcional, para respaldo en Drive
   ```
3. `npm run dev`

La key de Gemini se usa solo en el servidor (`api/gemini.ts`). En desarrollo la sirve un middleware de Vite; en producción, la función serverless de Vercel. Nunca se incluye en el código del navegador.

## Gemini en nivel gratuito (costo cero)

El costo cero depende de **la key**, no del código: debe pertenecer a un proyecto **sin facturación**.

1. Crear la key en [Google AI Studio](https://aistudio.google.com/apikey) en un proyecto nuevo, **sin** vincular una cuenta de facturación.
2. Verificar en AI Studio → *Projects* que la columna *Billing Tier* diga **Free** / "Set up billing". Si aparece un plan pagado, esa key cobra.
3. No activar facturación en ese proyecto en Google Cloud Console. Activarla elimina la cuota gratuita (no se suma a ella).
4. En Vercel → *Settings → Environment Variables*: `GEMINI_API_KEY` = esa key. **No** crear variables `VITE_GEMINI_*` (quedarían públicas en el navegador).

Sin facturación, al agotar la cuota diaria Google responde con error 429 y no cobra. La app muestra "Se agotó la cuota gratuita de Gemini".

La IA se usa solo para **estructurar partidas**: a partir del título y la unidad propone materiales, mano de obra (HH por unidad) y equipos (HM por unidad), sin precios. Los precios se completan desde el historial del usuario o el catálogo estándar cuando la descripción coincide.

Consideraciones del nivel gratuito:
- Google puede usar el contenido enviado para mejorar sus productos (con revisión humana). No ingresar información confidencial.
- Las cuotas son dinámicas; las vigentes para la key se ven en AI Studio → *Rate limits*. La app usa primero un modelo Flash (mejor calidad, cuota diaria baja) y, al agotarse, pasa a Flash-Lite.

Variables opcionales del servidor:

| Variable | Valor por defecto | Uso |
|---|---|---|
| `GEMINI_MODELS` | `gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite` | Modelos en orden de preferencia; si uno no existe o agotó su cuota se usa el siguiente |
| `ALLOWED_ORIGINS` | — | Orígenes adicionales autorizados a usar `/api/gemini` (el dominio propio siempre lo está) |
