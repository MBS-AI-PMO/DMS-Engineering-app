import { useEffect, useState } from 'react';
import { fetchPageFaqs, peekPageFaqs } from '../../services/pageFaqs';

/*
 * FAQs admin placed on a page (Admin > FAQs > "Show on pages").
 *
 * Most pages show them in their own block directly above the footer
 * (PageFaqsSlot, wired once in the public layout). Pages whose last section
 * is already an FAQ list (so it sits right above the footer too) show them
 * inside it instead, so a visitor never sees two FAQ lists one after the
 * other; those pages are listed here and use usePlacedFaqs():
 *
 *   /             components/FAQ.jsx (home FAQ section: the placed FAQs
 *                 replace its built-in questions)
 *   /metal/…      components/MetalDetail.jsx ("Questions about <metal>":
 *                 the metal's own questions, then the placed ones)
 *   /faq          the FAQ page lists every FAQ on it already
 */
const SHOWN_BY_PAGE = [/^\/$/, /^\/faq$/, /^\/metal\//, /^\/metal-by-id\//];

export const showsOwnFaqs = (path) => SHOWN_BY_PAGE.some(re => re.test(path));

/**
 * The FAQs placed on `path` ([] while loading, when there are none, or when
 * the request fails: the page then simply shows no extra FAQs). Every page's
 * list comes in one request made as soon as the first page opens, so later
 * pages have theirs at once. `nearRef` is no longer needed (kept so callers
 * don't have to change).
 */
// eslint-disable-next-line no-unused-vars
export function usePlacedFaqs(path, nearRef) {
    const [loaded, setLoaded] = useState(() => ({ path, items: (path && peekPageFaqs(path)) || [] }));

    useEffect(() => {
        if (!path) return undefined;
        let cancelled = false;
        fetchPageFaqs(path)
            .then(items => { if (!cancelled) setLoaded(prev => (prev.path === path && sameIds(prev.items, items) ? prev : { path, items })); })
            .catch(() => { if (!cancelled) setLoaded({ path, items: [] }); });
        return () => { cancelled = true; };
    }, [path]);

    if (loaded.path === path) return loaded.items;
    // A new page: what is already in memory, until the effect catches up.
    return (path && peekPageFaqs(path)) || [];
}

const sameIds = (a, b) => a.length === b.length && a.every((item, i) => item.id === b[i].id);

const textKey = (text) => String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * One list from a page's own FAQs and the placed ones, in the order given,
 * without repeating a question that reads the same.
 */
export function mergeFaqs(...lists) {
    const seen = new Set();
    const out = [];
    lists.flat().forEach(item => {
        const key = textKey(item?.question);
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push(item);
    });
    return out;
}
