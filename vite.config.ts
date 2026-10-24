import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // GitHub Pages は https://<user>.github.io/korea-trip/ で配信されるので、ビルド時だけパスを合わせる
  base: process.env.GITHUB_PAGES ? '/korea-trip/' : '/',
  plugins: [react(), tailwindcss()],
  // MapLibre 6 は Web Worker を自分の URL から読み込むので、事前バンドルの対象から外す
  optimizeDeps: { exclude: ['maplibre-gl'] },
  worker: { format: 'es' },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
});
