import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
      plugins: [react()],
      // En modo desarrollo exponemos la key solo para dev local.
      // En producción la key vive en process.env del servidor (Vercel) — nunca en el bundle del cliente.
      define: mode === 'development' ? {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      } : {},
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      server: {
        // En dev sin vercel dev, el /api no existe; las llamadas caen al modo directo de geminiService.ts
        proxy: {}
      }
    };
});