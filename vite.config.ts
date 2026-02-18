import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Carga las variables de entorno (como GEMINI_API_KEY de Vercel)
    const env = loadEnv(mode, '.', '');
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Mapeo crítico: transforma la variable de Vercel en lo que el código busca
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          // Permite usar '@' para rutas relativas
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // Directorio de salida que espera Vercel
        outDir: 'dist',
      }
    };
});