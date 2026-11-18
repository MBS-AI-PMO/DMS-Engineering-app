/*
 * Pages of the public site an FAQ can be placed on (GET /faqs/admin/pages,
 * built in backend/faqs/pages.js). A page key is the page's address
 * ('/about', '/metal/6061-t6-aluminum') or a whole type ('/metal/*').
 */

export const PAGE_GROUPS = [
    { id: 'main', label: 'Main pages' },
    { id: 'metal', label: 'Metal pages' },
    { id: 'service', label: 'Service pages' },
    { id: 'other', label: 'Pages that no longer exist' },
];

const matches = (page, needle) => !needle || page.label.toLowerCase().includes(needle) || page.key.includes(needle);

/** The pages in their groups (empty groups left out), filtered by a search. */
export function groupPages(pages, query = '') {
    const needle = query.trim().toLowerCase();
    return PAGE_GROUPS
        .map(group => ({ ...group, pages: pages.filter(p => p.group === group.id && matches(p, needle)) }))
        .filter(group => group.pages.length);
}

export const pageLabel = (key, byKey) => byKey.get(key)?.label || key;

/** The address to open, or null for "every page of a type". */
export const pageHref = (key) => (key.endsWith('/*') ? null : key);

/** Map page key -> number of FAQs on it, from the FAQs' `pages`. */
export function countByPage(faqs) {
    const counts = new Map();
    faqs.forEach(f => (f.pages || []).forEach(key => counts.set(key, (counts.get(key) || 0) + 1)));
    return counts;
}

/** Where on the site the FAQs of this page show, in one sentence. */
export function placementNote(page) {
    if (!page) return '';
    if (page.missing) return 'This page no longer exists (renamed or deleted), so these FAQs show nowhere. Remove them, or add them to the page under its new name.';
    if (page.key === '/metal/*') return 'Shown on every metal page, now and later: in its “Questions about…” section, after that metal’s own questions and the FAQs placed on it.';
    if (page.key === '/service/*') return 'Shown above the footer of every service page, now and later, after the FAQs placed on that page itself.';
    if (page.group === 'metal') return 'Shown in this metal’s “Questions about…” section, after its own questions (set in Admin › Metals) and before those placed on all metal pages.';
    if (page.group === 'service') return 'Shown above the footer of this page, before the FAQs placed on all service pages.';
    if (page.key === '/') return 'Shown in the home page’s FAQ section, in place of its built-in questions (those show only while nothing is placed here).';
    return 'Shown above the footer of this page, in this order.';
}

/** One line of an FAQ's text, cut to `max` characters. */
export const snippet = (text, max = 150) => {
    const flat = String(text || '').replace(/\s+/g, ' ').trim();
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};
