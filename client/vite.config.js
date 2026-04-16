/* eslint-env node */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_URL || 'http://localhost:5000';

  return {
    plugins: [
      react(),
      ViteImageOptimizer({
        png: { quality: 80 },
        jpeg: { quality: 80 },
        jpg: { quality: 80 },
        webp: { quality: 80, lossless: false },
        avif: { quality: 80, lossless: false },
        svg: {
          plugins: [
            { name: 'preset-default' },
            { name: 'removeDimensions' },
          ],
        },
        logStats: true,
      }),
    ],
    optimizeDeps: {
      include: ['occt-import-js'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) return 'vendor-react';
              if (id.includes('three')) return 'vendor-three';
              if (id.includes('framer-motion')) return 'vendor-motion';
              if (id.includes('online-3d-viewer')) return 'vendor-ov';
              return 'vendor';
            }
          },
        },
      },
    },
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
      },
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/temp_uploads': {
          target: apiTarget,
          changeOrigin: true,
        }
      }
    }
  }
})
