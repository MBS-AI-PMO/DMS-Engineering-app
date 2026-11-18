/*
 * dms-head-tags: puts each page's <head> tags (title, description, link
 * preview and X card, canonical, icons, the admin's own tags…) into the
 * HTML the server sends, so crawlers and link previews that don't run
 * JavaScript (Facebook, LinkedIn, WhatsApp, X, Slack) see them too.
 * client/index.html itself holds none of them.
 *
 *   vite          (local dev)   transformIndexHtml adds them to every page.
 *   vite preview  (production)  page navigations (what the SPA fallback turns
 *                               into /index.html) are answered here with the
 *                               built index.html plus the tags.
 *
 * The tags come from the backend: GET {apiTarget}/api/seo/head?path=…
 * (backend/routes/seo.js), kept per page for a minute. The app applies the
 * same list when the visitor moves between pages (utils/seo applyHeadTags).
 *
 * Never holds a page up: it waits at most 1.5 s for the backend. When the
 * backend is slow or down the page goes out with the tags it last had for
 * that page, else the site-wide ones it last had (kept on disk, so they
 * survive a restart), else none; the answer still lands in the cache when
 * it comes.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'

const TTL_MS = 60 * 1000          // a page's tags are asked for again after this
const WAIT_MS = 1500              // longest a page waits for the backend
const FETCH_TIMEOUT_MS = 8000     // a slow answer still fills the cache up to this
const RETRY_MS = 5000             // after a failure, pages don't wait for this long
const MAX_PAGES = 500             // pages kept (any URL serves the app, so bounded)

const HOST_RE = /^[a-z0-9.-]+(:\d{1,5})?$/i

/* The address the visitor used (for full URLs while no site address is set in admin). */
function originOf(req) {
  const host = String(req.headers.host || '').toLowerCase()
  if (!HOST_RE.test(host)) return ''
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase()
  const proto = forwarded === 'https' || forwarded === 'http' ? forwarded : (req.socket?.encrypted ? 'https' : 'http')
  return `${proto}://${host}`
}

/* '/metals?x=1' -> '/metals'; '/index.html' -> '/'. */
function pagePathOf(url) {
  let p = String(url || '/').split(/[?#]/)[0] || '/'
  if (p === '/index.html') p = '/'
  return p.slice(0, 500)
}

/* The tags go last in <head>, after everything the build put there. */
function inject(html, tags) {
  if (!tags) return html
  return html.replace(/<\/head>/i, (end) => `  ${tags}\n${end}`)
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}

/* headFor(path, origin) -> the tags' HTML ('' when there is nothing yet). */
function createHeadSource({ apiTarget, cacheFile, logger }) {
  const pages = new Map()     // `${origin}|${path}` -> { html, at }
  const pending = new Map()
  let fallback = cacheFile ? (readJson(cacheFile)?.html || '') : ''
  let downUntil = 0
  let warnedAt = 0

  const remember = (key, html) => {
    pages.delete(key)
    pages.set(key, { html, at: Date.now() })
    if (pages.size > MAX_PAGES) pages.delete(pages.keys().next().value)
  }

  const keepFallback = (html) => {
    if (typeof html !== 'string' || html === fallback) return
    fallback = html
    if (!cacheFile) return
    try {
      fs.mkdirSync(path.dirname(cacheFile), { recursive: true })
      fs.writeFileSync(cacheFile, JSON.stringify({ html, savedAt: new Date().toISOString() }))
    } catch { /* only a convenience */ }
  }

  function ask(key, pagePath, origin) {
    if (pending.has(key)) return pending.get(key)
    const url = new URL('/api/seo/head', apiTarget)
    url.searchParams.set('path', pagePath)
    if (origin) url.searchParams.set('origin', origin)
    url.searchParams.set('fallback', '1')
    const request = fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (!res.ok || !body?.success || typeof body.data?.html !== 'string') throw new Error(body?.error || `HTTP ${res.status}`)
        remember(key, body.data.html)
        keepFallback(body.data.fallback)
        downUntil = 0
        return body.data.html
      })
      .catch((err) => {
        downUntil = Date.now() + RETRY_MS
        if (Date.now() - warnedAt > 60 * 1000) {
          warnedAt = Date.now()
          logger.warn(`[dms-head-tags] could not get the page tags from ${apiTarget} (${err.message || err}); pages use the last ones known.`)
        }
        throw err
      })
      .finally(() => pending.delete(key))
    pending.set(key, request)
    return request
  }

  return async function headFor(pagePath, origin = '') {
    const key = `${origin}|${pagePath}`
    const hit = pages.get(key)
    if (hit && Date.now() - hit.at < TTL_MS) return hit.html
    // The site-wide fallback must not tell search engines to index a private page.
    const known = hit ? hit.html : keepPrivateOut(fallback, pagePath)
    const request = ask(key, pagePath, origin)
    request.catch(() => { /* reported in ask() */ })
    if (Date.now() < downUntil) return known
    let timer
    const tooSlow = new Promise((resolve) => { timer = setTimeout(resolve, WAIT_MS, null) })
    try {
      const html = await Promise.race([request, tooSlow])
      if (html !== null) return html
      // Too slow: the next pages don't wait either until it answers (or RETRY_MS passes).
      downUntil = Math.max(downUntil, Date.now() + RETRY_MS)
      return known
    } catch {
      return known
    } finally {
      clearTimeout(timer)
    }
  }
}

// Never indexed (same list as backend/seo/crawl.js PRIVATE_PATHS and utils/seo.js).
const PRIVATE_PAGE = /^\/(admin|cart|checkout|orders|settings)(\/|$)|^\/track-order\/[^/]+/i
const ROBOTS_TAG = /<meta name="robots" content="[^"]*"([^>]*)>/i

/* The fallback tags for a private page: robots switched to noindex, nofollow. */
function keepPrivateOut(html, pagePath) {
  if (!html || !PRIVATE_PAGE.test(String(pagePath || ''))) return html
  return ROBOTS_TAG.test(html)
    ? html.replace(ROBOTS_TAG, '<meta name="robots" content="noindex, nofollow"$1>')
    : `${html}
  <meta name="robots" content="noindex, nofollow" data-head="dms">`
}

/* What vite's own HTML responses carry: no-cache with an ETag, plus the configured headers. */
function sendHtml(req, res, html, headers) {
  const etag = `W/"${Buffer.byteLength(html).toString(16)}-${crypto.createHash('sha1').update(html).digest('base64url').slice(0, 27)}"`
  if (req.headers['if-none-match'] === etag) {
    res.statusCode = 304
    res.end()
    return
  }
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('ETag', etag)
  for (const [name, value] of Object.entries(headers || {})) res.setHeader(name, value)
  res.end(req.method === 'HEAD' ? undefined : html)
}

export default function headTags({ apiTarget }) {
  let headFor = null
  const requestOrigin = new AsyncLocalStorage()

  return {
    name: 'dms-head-tags',

    configResolved(config) {
      if (config.command !== 'serve') return // `vite build`: index.html stays tag-free
      headFor = createHeadSource({
        apiTarget,
        cacheFile: config.cacheDir ? path.join(config.cacheDir, 'dms-head-fallback.json') : null,
        logger: config.logger,
      })
    },

    // Dev: remember the address of each request for transformIndexHtml.
    configureServer(server) {
      server.middlewares.use((req, res, next) => requestOrigin.run(originOf(req), next))
    },

    transformIndexHtml: {
      order: 'post',
      async handler(html, ctx) {
        if (!ctx.server || !headFor) return html
        const tags = await headFor(pagePathOf(ctx.originalUrl || ctx.path), requestOrigin.getStore() || '').catch(() => '')
        return inject(html, tags)
      },
    },

    configurePreviewServer(server) {
      const { config } = server
      const indexFile = path.resolve(config.root, config.build.outDir, 'index.html')
      let template = null // { html, mtimeMs }
      const readTemplate = () => {
        const { mtimeMs } = fs.statSync(indexFile)
        if (!template || template.mtimeMs !== mtimeMs) template = { html: fs.readFileSync(indexFile, 'utf8'), mtimeMs }
        return template.html
      }

      // /index.html asked for by name is the home page (the static files
      // middleware would otherwise send the bare file).
      server.middlewares.use((req, res, next) => {
        const [pathname, query] = String(req.url || '').split(/\?(.*)/s)
        if (pathname === '/index.html' && (req.method === 'GET' || req.method === 'HEAD')) req.url = query ? `/?${query}` : '/'
        next()
      })

      // After the SPA fallback has turned a page address into /index.html.
      return () => {
        server.middlewares.use(async (req, res, next) => {
          if ((req.method !== 'GET' && req.method !== 'HEAD') || String(req.url || '').split('?')[0] !== '/index.html') return next()
          let html
          try { html = readTemplate() } catch { return next() }
          const tags = headFor ? await headFor(pagePathOf(req.originalUrl), originOf(req)).catch(() => '') : ''
          sendHtml(req, res, inject(html, tags), config.preview.headers)
        })
      }
    },
  }
}
