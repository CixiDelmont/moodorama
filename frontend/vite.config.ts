import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  // Production is served from https://tonicturtle.com/moodorama/
  base: mode === 'production' ? '/moodorama/' : '/',
  plugins: [react()],
  server: {
    port: 5173,
  },
}));
