import { http } from './http';

/*
 * FAQs admin placed on pages of the public site. One request
 * (GET /api/faqs/placed) brings every page's list at once, so after the
 * first page of a visit every page has its FAQs straight away. A page shows
 * its own key's FAQs first, then those placed on every page of its type
 * ('/metal/*' for /metal/<slug>), without repeats (same rule as the backend's
 * /for-page). Kept for 10 minutes; admin changes made in this tab empty it.
 */

const TTL_MS = 10 * 60 * 1000;
let store = null; // { at, promise, pages (once loaded) }

/* '/About/' -> '/about' (the backend reads it the same way). */
export const pagePath = (pathname = '/') => {
    const path = String(pathname).split(/[?#]/)[0].toLowerCase().replace(/\/{2,}/g, '/');
    return path.length > 1 ? path.replace(/\/+$/, '') : '/';
};

/* '/metal/5052' -> ['/metal/5052', '/metal/*'] (backend faqs/pages.js keysForPath). */
const keysForPath = (path) => {
    const segments = path.split('/').filter(Boolean);
    return segments.length >= 2 ? [path, `/${segments[0]}/*`] : [path];
};

const listFor = (pages, pathname) => {
    const seen = new Set();
    return keysForPath(pagePath(pathname))
        .flatMap(key => pages?.[key] || [])
        .filter(row => (seen.has(row.id) ? false : seen.add(row.id)));
};

/** Every page's placed FAQs ({ page_key: [...] }), one request per visit. */
export function loadPlacedFaqs() {
    if (store && Date.now() - store.at < TTL_MS) return store.promise;
    const entry = { at: Date.now(), pages: null };
    entry.promise = http.get('/faqs/placed')
        .then(data => {
            entry.pages = data?.pages && typeof data.pages === 'object' ? data.pages : {};
            return entry.pages;
        });
    store = entry;
    entry.promise.catch(() => { if (store === entry) store = null; });
    return entry.promise;
}

/** -> [{ id, question, answer, category_name, page_key, position }] */
export const fetchPageFaqs = (pathname) => loadPlacedFaqs().then(pages => listFor(pages, pathname));

/** This page's FAQs if they are already here (no request needed), else null. */
export const peekPageFaqs = (pathname) => (
    store?.pages && Date.now() - store.at < TTL_MS ? listFor(store.pages, pathname) : null
);

export const hasPageFaqs = (pathname) => peekPageFaqs(pathname) !== null;

export function clearPageFaqsCache() {
    store = null;
}
