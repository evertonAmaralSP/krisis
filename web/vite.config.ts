import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Em desenvolvimento, /api vai para o Fastify: mesma origem, cookie sem CORS.
// API_PORT e WEB_PORT permitem rodar uma segunda cópia (ex.: numa worktree) ao lado da principal.
const apiPort = process.env.API_PORT ?? '3001';
const webPort = Number(process.env.WEB_PORT ?? 5173);

export default defineConfig({
  plugins: [react()],
  server: {
    port: webPort,
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${apiPort}` },
  },
});
