/* eslint-env node */
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import headTags from './vite/headTags.js'

// Production runs `vite preview`, which sends every file with
// `Cache-Control: no-cache`, so each visit re-checks every script, style and
// picture. Files the build names with a content hash (dist/assets/name-HASH.ext)
// never change under the same name: let browsers keep those for a year.
// Files copied as-is from public/ (favicon, logo, public/assets/*) keep no-cache.
const IMMUTABLE = 'public, max-age=31536000, immutable'
function cacheHashedAssets() {
  return {
    name: 'dms-cache-hashed-assets',
    configurePreviewServer(server) {
      const { root, build, publicDir } = server.config
      const assetsDir = path.resolve(root, build.outDir, build.assetsDir)
      const publicAssets = publicDir ? path.join(publicDir, build.assetsDir) : null
      const hashed = new Set(
        (fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [])
          .filter(name => !(publicAssets && fs.existsSync(path.join(publicAssets, name))))
          .map(name => `/${build.assetsDir}/${name}`),
      )
      server.middlewares.use((req, res, next) => {
        if (!hashed.has((req.url || '').split('?')[0])) return next()
        res.setHeader('Cache-Control', IMMUTABLE)
        // The static server passes its own Cache-Control to writeHead; replace it there too.
        const writeHead = res.writeHead
        res.writeHead = function (code, ...rest) {
          const headers = rest.find(arg => arg && typeof arg === 'object')
          if (headers) {
            for (const key of Object.keys(headers)) if (key.toLowerCase() === 'cache-control') delete headers[key]
            headers['Cache-Control'] = IMMUTABLE
          }
          return writeHead.call(this, code, ...rest)
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_URL || 'http://localhost:5000'

  return {
    plugins: [
      react(),
      cacheHashedAssets(),
      // Each page's <head> tags (Admin > SEO & tracking), in the HTML itself, dev and preview.
      headTags({ apiTarget }),
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
          // Only libraries every page uses are grouped by hand. Everything
          // else is left to the bundler so it loads with the pages that use
          // it (a catch-all 'vendor' group would pull the 3D viewers, PayPal,
          // etc. into the first load of every page).
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|cookie|set-cookie-parser)[\\/]/.test(id)) return 'vendor-react'
            if (/[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'vendor-motion'
            if (/[\\/]node_modules[\\/]three[\\/]/.test(id)) return 'vendor-three'
            if (id.includes('online-3d-viewer')) return 'vendor-ov'
          },
        },
      },
    },

    server: {
      host: '0.0.0.0',
      // Local development. Production (`vite preview`, below) stays on 3000: the live server's proxy points there.
      port: 5176,
      strictPort: true,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
      },
      // `vite preview` (production) uses these too.
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        // Built by the backend from the site's pages, metals, services and blog posts (backend/seo/crawl.js).
        '/robots.txt': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: () => '/api/seo/robots.txt',
        },
        '/sitemap.xml': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: () => '/api/seo/sitemap.xml',
        },
        '/uploads': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/temp_uploads': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },

    preview: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: [
        'dmscuts.com',
        'www.dmscuts.com',
        'htnxpk7uxwuu2rr97t3dma4z.2.25.152.142.sslip.io',
      ],
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
      },
    },
  }
})
