import path from 'path';
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * En desarrollo sirve /api/gemini con el mismo handler que usa Vercel en producción,
 * así la key de Gemini queda en el servidor local y nunca llega al navegador.
 */
const geminiDevApi = (): Plugin => ({
  name: 'gemini-dev-api',
  apply: 'serve',
  configureServer(server: ViteDevServer) {
    server.middlewares.use('/api/gemini', async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      let body: unknown = {};
      try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { /**/ }

      const { default: handler } = await server.ssrLoadModule('/api/gemini.ts');
      const vercelRes = Object.assign(res, {
        status(code: number) { res.statusCode = code; return vercelRes; },
        json(data: unknown) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); return vercelRes; }
      });
      await handler(Object.assign(req, { body }), vercelRes);
    });
  }
});

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    // Variables del servidor para el handler local (GEMINI_API_KEY, GEMINI_MODELS, etc.)
    for (const key of ['GEMINI_API_KEY', 'GEMINI_MODELS', 'GEMINI_SEARCH_MODELS', 'ALLOWED_ORIGINS']) {
      if (env[key] && !process.env[key]) process.env[key] = env[key];
    }
    return {
      plugins: [react(), geminiDevApi()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
