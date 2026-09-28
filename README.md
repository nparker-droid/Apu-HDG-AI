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

Consideraciones del nivel gratuito:
- Google puede usar el contenido enviado para mejorar sus productos (con revisión humana). No ingresar información confidencial.
- Las cuotas son dinámicas; las vigentes para la key se ven en AI Studio → *Rate limits*.
- La búsqueda web (Google Search) no está disponible en nivel gratuito para Gemini 3.x. La app intenta usarla con la familia 2.5 Flash y, si no está disponible, entrega una **estimación IA sin fuente web**, marcada como tal.

Variables opcionales del servidor:

| Variable | Valor por defecto | Uso |
|---|---|---|
| `GEMINI_MODELS` | `gemini-3.5-flash-lite,gemini-3.1-flash-lite` | Modelos de texto en orden de preferencia (si uno no está disponible se usa el siguiente) |
| `GEMINI_SEARCH_MODELS` | `gemini-2.5-flash,gemini-2.5-flash-lite` | Modelos para búsqueda de precios en la web |
| `ALLOWED_ORIGINS` | — | Orígenes adicionales autorizados a usar `/api/gemini` (el dominio propio siempre lo está) |
