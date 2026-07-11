import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import path from 'node:path';

// shared with the backend - see ../.env (BACKEND_PORT is the single source of truth)
const envDir = path.resolve(process.cwd(), '..');

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  const backendPort = env.BACKEND_PORT || '5004';

  return {
    plugins: [react(), wasm(), topLevelAwait()],
    css: {
      postcss: './postcss.config.js',
    },
    envDir,
    server: {
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${backendPort}`,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
