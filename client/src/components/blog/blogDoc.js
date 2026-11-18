/*
 * Blog post documents: the editor's JSON (TipTap / ProseMirror). The same
 * rules as backend/blog/content.js, which checks every document before it
 * is stored; they are applied again here when a post is shown, so only
 * these blocks, marks and addresses ever reach a page.
 *
 *   blocks  paragraph, heading (2-4), bulletList, orderedList, listItem,
 *           blockquote, callout, codeBlock, horizontalRule, image, youtube,
 *           table, tableRow, tableHeader, tableCell
 *   inline  text, hardBreak
 *   marks   bold, italic, underline, strike, code, highlight, link
 */

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001F\u007F]/g;

/** A link target that is safe in href (http(s), mailto:, tel:, a page on this site), or null. */
export function safeHref(value) {
    if (typeof value !== 'string') return null;
    const href = value.replace(CONTROL, '').trim();
    if (!href || href.length > 2000 || /\s/.test(href)) return null;
    if (/^https?:\/\/[^/\s?#]+/i.test(href)) return href;
    if (/^mailto:[^\s<>"']+@[^\s<>"']+$/i.test(href)) return href;
    if (/^tel:\+?[0-9().-]{3,30}$/i.test(href)) return href;
    if (/^\/(?!\/)[^\s\\]*$/.test(href) || /^#[\w\-:.]{1,120}$/.test(href)) return href;
    return null;
}

/** A picture source that is safe to show (an upload on this site or https), or null. */
export function safeImageSrc(value) {
    if (typeof value !== 'string') return null;
    const src = value.trim();
    if (!src || src.length > 2000 || /[\s"'<>\\`]/.test(src)) return null;
    if (/^\/(?:api\/)?uploads\/[A-Za-z0-9._\-/]+$/.test(src) && !src.split('/').includes('..')) return src;
    if (/^https:\/\/[^/\s?#]+\/\S*$/i.test(src)) return src;
    return null;
}

/** The 11-character id of a YouTube link (watch, youtu.be, embed, shorts), or null. */
export function youtubeId(value) {
    if (typeof value !== 'string') return null;
    const s = value.trim();
    const patterns = [
        /^https?:\/\/(?:www\.|m\.|music\.)?youtube\.com\/watch\?(?:[^#]*&)?v=([A-Za-z0-9_-]{11})(?:[&#]|$)/i,
        /^https?:\/\/youtu\.be\/([A-Za-z0-9_-]{11})(?:[?#&/]|$)/i,
        /^https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})(?:[?#&/]|$)/i,
    ];
    for (const re of patterns) {
        const m = s.match(re);
        if (m) return m[1];
    }
    return null;
}

/** "Laser cutting & bending" -> "laser-cutting-and-bending". */
export function slugify(value, max = 100) {
    const s = String(value || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/&/g, ' and ')
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    if (s.length <= max) return s;
    const cut = s.slice(0, max);
    const at = cut.lastIndexOf('-');
    return (at > max * 0.5 ? cut.slice(0, at) : cut).replace(/-+$/g, '');
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The text inside a node (no line breaks). */
export function nodeText(node) {
    if (!isObject(node)) return '';
    if (node.type === 'text') return typeof node.text === 'string' ? node.text : '';
    if (node.type === 'hardBreak') return ' ';
    return (Array.isArray(node.content) ? node.content : []).map(nodeText).join('');
}

/**
 * Every heading in reading order with a unique anchor id:
 * [{ id, text, level }]. The renderer gives headings the same ids, in the
 * same order, so a table of contents can link to them.
 */
export function collectHeadings(doc) {
    const out = [];
    const used = new Map();
    const walk = (node) => {
        if (!isObject(node)) return;
        if (node.type === 'heading') {
            const text = nodeText(node).replace(/\s+/g, ' ').trim();
            const base = slugify(text, 60) || 'section';
            const n = (used.get(base) || 0) + 1;
            used.set(base, n);
            out.push({ id: n === 1 ? base : `${base}-${n}`, text, level: Math.min(4, Math.max(2, Number(node.attrs?.level) || 2)) });
            return;
        }
        (Array.isArray(node.content) ? node.content : []).forEach(walk);
    };
    walk(doc);
    return out;
}

/** Plain text of a document, blocks on their own lines. */
export function docText(doc) {
    const out = [];
    const walk = (node) => {
        if (!isObject(node)) return;
        if (node.type === 'text') { out.push(node.text || ''); return; }
        if (node.type === 'hardBreak') { out.push(' '); return; }
        if (node.type === 'image') { if (node.attrs?.caption) out.push(`\n${node.attrs.caption}\n`); return; }
        (Array.isArray(node.content) ? node.content : []).forEach(walk);
        out.push('\n');
    };
    walk(doc);
    return out.join('').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
}

export const countWords = (text) => (String(text || '').match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) || []).length;

/** Minutes to read, at about 225 words a minute (at least 1). */
export const readingMinutes = (words) => Math.max(1, Math.round((Number(words) || 0) / 225));

/** "Nov 17, 2026" */
export function postDate(value) {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
