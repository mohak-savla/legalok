import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Shared condition/document engine — canonical source lives in server/src/engine
      '@engine': path.resolve(__dirname, '../server/src/engine'),
    },
  },
  server: {
    port: 5173,
    fs: { allow: ['..'] }, // serve the shared engine from ../server during dev
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});

