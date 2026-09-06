import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 之後用 Capacitor 包成 App 時，資源要走相對路徑才找得到
  base: './',
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
