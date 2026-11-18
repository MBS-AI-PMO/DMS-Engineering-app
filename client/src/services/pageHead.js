import { http } from './http';

/*
 * The <head> tags of one page (GET /api/seo/head, backend/routes/seo.js):
 * the same list the server already put into the page HTML, so the app can
 * swap them when the visitor moves to another page (utils/seo
 * applyHeadTags). Kept for a minute per page; the admin SEO page empties
 * it after a save.
 *
 *   -> { path, title, tags: [{ tag, attrs, content? }] }
 */

const TTL_MS = 60 * 1000;
const cache = new Map(); // path -> { promise, at }

/* '/metals/' -> '/metals' (the backend reads it the same way). */
const pagePath = (pathname = '/') => {
    const path = String(pathname).split(/[?#]/)[0].replace(/\/{2,}/g, '/');
    return path.length > 1 ? path.replace(/\/+$/, '') : '/';
};

export function fetchPageHead(pathname) {
    const path = pagePath(pathname);
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
    const entry = {
        at: Date.now(),
        promise: http.get('/seo/head', { query: { path, origin: window.location.origin } }).then((head) => {
            if (!head || typeof head.title !== 'string' || !Array.isArray(head.tags)) throw new Error('Unexpected page tags');
            return head;
        }),
    };
    cache.set(path, entry);
    entry.promise.catch(() => { if (cache.get(path) === entry) cache.delete(path); });
    return entry.promise;
}

export function clearPageHeadCache() {
    cache.clear();
}
