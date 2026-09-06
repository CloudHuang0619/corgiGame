import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 之後用 Capacitor 包成 App 時，資源要走相對路徑才找得到
  base: './',
  server: {
    port: 5173,
    host: true,
    watch: {
      /*
       * art/ 是原始素材與校正腳本的產物，不參與打包。
       * 而且校正腳本會覆寫這些檔案，Windows 上檔案鎖會讓監看器丟 EBUSY
       * 而整個 dev server 崩潰 —— 排除掉最乾脆。
       */
      ignored: ['**/art/**'],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
