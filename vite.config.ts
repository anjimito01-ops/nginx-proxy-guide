import { defineConfig } from 'vite';

export default defineConfig({
  // Capacitor は file:// で index.html を読み込むため相対パスで出力する
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    host: true,
    port: 5173,
  },
});
