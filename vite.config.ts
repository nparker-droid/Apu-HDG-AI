import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Carga las variables de entorno de .env y del sistema (como las de Vercel)
    const env = loadEnv(mode, '.', '');
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Inyectamos la llave en múltiples formatos para máxima compatibilidad
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          // Permite usar '@' para referirse a la raíz del proyecto
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // Asegura que el directorio de salida coincida con la configuración de Vercel
        outDir: 'dist',
      }
    };
});
