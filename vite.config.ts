import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          const moduleId = id.replace(/\\/g, '/');
          // Keep shared runtime helpers out of lazy UI and animation bundles.
          if (moduleId.includes('commonjsHelpers') || /\/node_modules\/(react|react-dom|scheduler)\//.test(moduleId)) return 'vendor-react';
          if (/\/node_modules\/(recharts|recharts-scale|d3-[^/]+)\//.test(moduleId)) return 'vendor-charts';
          if (/\/node_modules\/(framer-motion|motion-dom|motion-utils)\//.test(moduleId)) return 'vendor-motion';
          if (moduleId.includes('/node_modules/@radix-ui/')) return 'vendor-ui';
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
