import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Em desenvolvimento, /api vai para o Fastify: mesma origem, cookie sem CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
});
