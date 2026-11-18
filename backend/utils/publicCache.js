/**
 * A short in-memory cache for the public, read-only JSON the site pages load
 * on every visit (settings, metals, services, FAQs, categories, guidelines).
 * That data only changes when an admin edits it, so:
 *
 *  - only the GET paths listed in PUBLIC_GET are cached (never admin or
 *    per-user responses), keyed by the full URL, for TTL_MS at most;
 *  - every successful write made by an admin (any non-GET request that was
 *    authenticated as an admin, or that went to an /admin path) empties the
 *    whole cache as soon as it finishes, so admin edits show on the next
 *    page load;
 *  - the TTL bounds anything else (seed scripts, edits made straight in the
 *    database) to a minute.
 *
 * Responses carry `X-Cache: HIT` or `MISS`.
 */

// PUBLIC_CACHE_TTL_MS=0 turns the cache off.
const envTtl = Number(process.env.PUBLIC_CACHE_TTL_MS);
const TTL_MS = process.env.PUBLIC_CACHE_TTL_MS !== undefined && Number.isFinite(envTtl) && envTtl >= 0 ? envTtl : 60 * 1000;
const MAX_ENTRIES = 300;

// Paths relative to /api. Only routes that answer the same to everyone.
const PUBLIC_GET = [
    /^\/settings$/,
    /^\/metals$/,
    /^\/metals\/[^/]+$/,
    /^\/metals\/[^/]+\/services$/,
    /^\/categories$/,
    /^\/services$/,
    /^\/services\/slug\/[^/]+$/,
    /^\/services\/\d+\/metals$/,
    /^\/faqs$/,
    /^\/faqs\/categories$/,
    /^\/faqs\/for-page$/, // one entry per ?path= (the key is the full URL)
    /^\/faqs\/placed$/,
    /^\/guidelines$/,
    /^\/guidelines\/[^/]+$/,
    /^\/hardware\/all$/,
    // Blog: live posts only. The TTL also bounds how late a scheduled post
    // shows up (the query checks the clock), so at most a minute.
    /^\/blog$/,
    /^\/blog\/[^/]+$/,
    // <head> tags of one page (routes/seo.js): one entry per ?path= (and origin).
    /^\/seo\/head$/,
];

const store = new Map(); // url -> { body, expires }
let generation = 0;

// Other in-memory copies of public data (seo/crawl.js) empty with this one.
const listeners = [];
const onClear = (fn) => { listeners.push(fn); };

const clear = () => {
    store.clear();
    generation += 1;
    listeners.forEach(fn => { try { fn(); } catch { /* ignore */ } });
};

const isCacheable = (req) => {
    if (req.method !== 'GET' || TTL_MS === 0) return false;
    if (/\/admin(\/|$)/.test(req.path)) return false;
    // Admin pages ask for hidden services too; leave those uncached.
    if (String(req.query.includeInactive || '').toLowerCase() === 'true') return false;
    return PUBLIC_GET.some(re => re.test(req.path));
};

/** Mount on /api before the routers. */
const publicCache = (req, res, next) => {
    // Writes: empty the cache once an admin change has gone through.
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
        res.on('finish', () => {
            const byAdmin = req.user?.role === 'admin' || /\/admin(\/|$)/.test(req.originalUrl.split('?')[0]);
            // A route that only reads (the admin head preview) sets res.locals.keepPublicCache.
            if (byAdmin && res.statusCode < 400 && !res.locals.keepPublicCache) clear();
        });
        return next();
    }
    if (!isCacheable(req)) return next();

    const key = req.originalUrl;
    const hit = store.get(key);
    if (hit && hit.expires > Date.now()) {
        res.set('X-Cache', 'HIT');
        res.type('application/json');
        return res.send(hit.body);
    }
    if (hit) store.delete(key);

    const startedIn = generation;
    const json = res.json.bind(res);
    res.json = (payload) => {
        // Not cached if an admin changed something while this was being read.
        if (res.statusCode === 200 && startedIn === generation && payload && payload.success !== false) {
            const body = JSON.stringify(payload);
            if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value);
            store.set(key, { body, expires: Date.now() + TTL_MS });
            res.type('application/json');
            return res.send(body);
        }
        return json(payload);
    };
    res.set('X-Cache', 'MISS');
    return next();
};

module.exports = { publicCache, clearPublicCache: clear, onPublicCacheClear: onClear, PUBLIC_CACHE_TTL_MS: TTL_MS };
