/*
 * The blog post document: the editor's JSON (TipTap / ProseMirror), checked
 * against a fixed list of blocks, marks and attributes before it is stored.
 * The site renders posts from this JSON with the same list
 * (client/src/components/blog/blogDoc.js), so nothing outside it can ever
 * reach a page: no HTML, no scripts, no event attributes, no unknown blocks.
 *
 *   const { doc, text, words, images } = cleanDoc(body.content);
 *
 * Unknown block or mark types, a block in the wrong place, a document that
 * is too big or too deep: 400 with a message. Unsafe values are dropped
 * quietly: a link to "javascript:" loses its link (the text stays), an
 * image or video from a source that is not allowed is removed, unknown
 * attributes are left out.
 *
 * Allowed:
 *   blocks  paragraph, heading (2-4), bulletList, orderedList, listItem,
 *           blockquote, callout (info | tip | warning), codeBlock,
 *           horizontalRule, image (src, alt, caption, width, height),
 *           youtube (video id), table, tableRow, tableHeader, tableCell
 *   inline  text, hardBreak
 *   marks   bold, italic, underline, strike, code, highlight, link (href)
 *   links   http(s), mailto:, tel:, or a path on this site ("/…", "#…")
 *   images  /uploads/… on this site, or https://…
 */
const { badRequest } = require('../helpers/http');

const LIMITS = {
    bytes: 1_500_000, // the JSON text
    nodes: 40_000,
    depth: 40,
    textChars: 400_000,
};

const ALIGNS = ['left', 'center', 'right', 'justify'];
const CALLOUT_TONES = ['info', 'tip', 'warning'];
const BLOCK = 'block';
const INLINE = 'inline';

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const str = (value, max) => {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const s = String(value).replace(CONTROL, '').replace(/\s+/g, ' ').trim();
    return s ? s.slice(0, max) : null;
};
const int = (value, min, max) => {
    const n = typeof value === 'number' ? value : Number.parseInt(value, 10);
    if (!Number.isFinite(n)) return null;
    const i = Math.round(n);
    return i < min || i > max ? null : i;
};

/* A link target that is safe to put in href, or null. */
function safeHref(value) {
    if (typeof value !== 'string') return null;
    const href = value.replace(CONTROL, '').trim();
    if (!href || href.length > 2000 || /\s/.test(href)) return null;
    if (/^(https?:\/\/)[^/\s?#]+/i.test(href)) return href;
    if (/^mailto:[^\s<>"']+@[^\s<>"']+$/i.test(href)) return href;
    if (/^tel:\+?[0-9().\- ]{3,30}$/i.test(href)) return href;
    // A page on this site, never "//host" (another site).
    if (/^\/(?!\/)[^\s\\]*$/.test(href) || /^#[\w\-:.]{1,120}$/.test(href)) return href;
    return null;
}

/* A picture source that is safe to show, or null: an upload on this site or https. */
function safeImageSrc(value) {
    if (typeof value !== 'string') return null;
    const src = value.trim();
    if (!src || src.length > 2000 || /[\s"'<>\\`]/.test(src)) return null;
    if (/^\/(?:api\/)?uploads\/[A-Za-z0-9._\-/]+$/.test(src) && !src.split('/').includes('..')) return src;
    if (/^https:\/\/[^/\s?#]+\/\S*$/i.test(src)) return src;
    return null;
}

/* The 11-character id of a YouTube link (watch, youtu.be, embed, shorts), or null. */
function youtubeId(value) {
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

/* Node rules. children: a group name or a list of node types. */
const NODES = {
    doc: { children: BLOCK },
    paragraph: { group: BLOCK, children: INLINE, attrs: { textAlign: (v) => (ALIGNS.includes(v) ? v : null) } },
    heading: {
        group: BLOCK,
        children: INLINE,
        attrs: {
            // H1 is the post title; other levels fold into 2-4.
            level: (v) => Math.min(4, Math.max(2, int(v, 1, 6) ?? 2)),
            textAlign: (v) => (ALIGNS.includes(v) ? v : null),
        },
    },
    bulletList: { group: BLOCK, children: ['listItem'] },
    orderedList: { group: BLOCK, children: ['listItem'], attrs: { start: (v) => int(v, 1, 100000) ?? 1 } },
    listItem: { children: BLOCK },
    blockquote: { group: BLOCK, children: BLOCK },
    callout: { group: BLOCK, children: BLOCK, attrs: { tone: (v) => (CALLOUT_TONES.includes(v) ? v : 'info') } },
    codeBlock: { group: BLOCK, children: ['text'], plainText: true, attrs: { language: (v) => (typeof v === 'string' && /^[a-z0-9+#.-]{1,24}$/i.test(v) ? v.toLowerCase() : null) } },
    horizontalRule: { group: BLOCK, leaf: true },
    image: {
        group: BLOCK,
        leaf: true,
        required: 'src',
        attrs: {
            src: safeImageSrc,
            alt: (v) => str(v, 250),
            caption: (v) => str(v, 300),
            width: (v) => int(v, 1, 10000),
            height: (v) => int(v, 1, 10000),
        },
    },
    youtube: {
        group: BLOCK,
        leaf: true,
        required: 'src',
        attrs: {
            src: (v) => {
                const id = youtubeId(v);
                return id ? `https://www.youtube.com/watch?v=${id}` : null;
            },
            start: (v) => int(v, 0, 86400) || 0,
        },
    },
    table: { group: BLOCK, children: ['tableRow'] },
    tableRow: { children: ['tableHeader', 'tableCell'] },
    tableHeader: { children: BLOCK, attrs: cellAttrs() },
    tableCell: { children: BLOCK, attrs: cellAttrs() },
    text: { group: INLINE },
    hardBreak: { group: INLINE, leaf: true },
};

function cellAttrs() {
    return {
        colspan: (v) => int(v, 1, 20) ?? 1,
        rowspan: (v) => int(v, 1, 50) ?? 1,
        colwidth: (v) => (Array.isArray(v) && v.length <= 20 && v.every(w => int(w, 10, 2000) !== null) ? v.map(w => int(w, 10, 2000)) : null),
    };
}

const MARKS = {
    bold: {},
    italic: {},
    underline: {},
    strike: {},
    code: {},
    highlight: {},
    link: { required: 'href', attrs: { href: safeHref } },
};

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const LABELS = {
    bulletList: 'bulleted list', orderedList: 'numbered list', listItem: 'list item', codeBlock: 'code block',
    horizontalRule: 'divider', tableRow: 'table row', tableHeader: 'table header cell', tableCell: 'table cell',
    hardBreak: 'line break', youtube: 'YouTube video',
};
const label = (type) => LABELS[type] || type;

function cleanAttrs(rules, attrs) {
    const out = {};
    if (!rules) return out;
    const src = isObject(attrs) ? attrs : {};
    for (const [key, fn] of Object.entries(rules)) {
        const value = fn(src[key]);
        if (value !== null && value !== undefined) out[key] = value;
    }
    return out;
}

function cleanMarks(marks, state) {
    if (marks === undefined || marks === null) return [];
    if (!Array.isArray(marks) || marks.length > 12) throw badRequest('The post has text formatting that is not valid.');
    const out = [];
    const seen = new Set();
    for (const mark of marks) {
        if (!isObject(mark) || typeof mark.type !== 'string') throw badRequest('The post has text formatting that is not valid.');
        const rule = MARKS[mark.type];
        if (!rule) throw badRequest(`The post uses a kind of formatting that is not allowed (${String(mark.type).slice(0, 40)}).`);
        if (seen.has(mark.type)) continue;
        const attrs = cleanAttrs(rule.attrs, mark.attrs);
        if (rule.required && !attrs[rule.required]) { state.dropped += 1; continue; }
        seen.add(mark.type);
        out.push(Object.keys(attrs).length ? { type: mark.type, attrs } : { type: mark.type });
    }
    return out;
}

function allowedChild(parentRule, type) {
    const childRule = NODES[type];
    if (!childRule || type === 'doc') throw badRequest(`The post has a block that is not allowed (${String(type).slice(0, 40)}).`);
    if (Array.isArray(parentRule.children)) return parentRule.children.includes(type);
    return childRule.group === parentRule.children;
}

function cleanNode(node, depth, state, parentType) {
    if (!isObject(node) || typeof node.type !== 'string') throw badRequest('The post content is not valid.');
    const rule = NODES[node.type];
    if (!rule || node.type === 'doc') throw badRequest(`The post has a block that is not allowed (${String(node.type).slice(0, 40)}).`);
    if (depth > LIMITS.depth) throw badRequest('The post is nested too deeply. Flatten some lists or quotes.');
    state.nodes += 1;
    if (state.nodes > LIMITS.nodes) throw badRequest('The post is too long. Split it into more than one post.');

    if (node.type === 'text') {
        const text = typeof node.text === 'string' ? node.text.replace(CONTROL, '') : '';
        if (!text) return null;
        state.chars += text.length;
        if (state.chars > LIMITS.textChars) throw badRequest('The post is too long. Split it into more than one post.');
        const marks = parentType === 'codeBlock' ? [] : cleanMarks(node.marks, state);
        return marks.length ? { type: 'text', text, marks } : { type: 'text', text };
    }

    const attrs = cleanAttrs(rule.attrs, node.attrs);
    if (rule.required && !attrs[rule.required]) { state.dropped += 1; return null; }
    const out = { type: node.type };
    if (Object.keys(attrs).length) out.attrs = attrs;
    if (rule.leaf) return out;

    const content = node.content === undefined || node.content === null ? [] : node.content;
    if (!Array.isArray(content)) throw badRequest('The post content is not valid.');
    const children = [];
    for (const child of content) {
        if (!isObject(child) || typeof child.type !== 'string') throw badRequest('The post content is not valid.');
        if (!allowedChild(rule, child.type)) {
            throw badRequest(`A ${label(child.type)} can't go inside a ${label(node.type)}.`);
        }
        const clean = cleanNode(child, depth + 1, state, node.type);
        if (clean) children.push(clean);
    }
    if (children.length) out.content = children;
    return out;
}

/* The plain text of a node, blocks on their own lines (search, word count, excerpt). */
function textOf(node, out = []) {
    if (!node) return out;
    if (node.type === 'text') { out.push(node.text); return out; }
    if (node.type === 'hardBreak') { out.push(' '); return out; }
    if (node.type === 'image') { if (node.attrs?.caption) out.push(`\n${node.attrs.caption}\n`); return out; }
    (node.content || []).forEach(child => textOf(child, out));
    if (NODES[node.type]?.group === BLOCK || ['listItem', 'tableCell', 'tableHeader'].includes(node.type)) out.push('\n');
    return out;
}

const countWords = (text) => (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) || []).length;

/* Every picture the document shows (to clean up files with the post). */
function imagesOf(node, out = []) {
    if (!node) return out;
    if (node.type === 'image' && node.attrs?.src) out.push(node.attrs.src);
    (node.content || []).forEach(child => imagesOf(child, out));
    return out;
}

function hasMedia(node) {
    if (!node) return false;
    if (['image', 'youtube', 'table'].includes(node.type)) return true;
    return (node.content || []).some(hasMedia);
}

/* The text of the opening paragraphs (not headings, lists or captions), for a summary. */
function leadOf(doc, max = 600) {
    const parts = [];
    let length = 0;
    for (const block of doc.content || []) {
        if (length >= max) break;
        if (block.type !== 'paragraph') continue;
        const text = textOf(block).join('').replace(/\s+/g, ' ').trim();
        if (!text) continue;
        parts.push(text);
        length += text.length + 1;
    }
    return parts.join(' ').slice(0, max + 200);
}

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

/**
 * Checks and cleans an editor document. Returns { doc, text, lead, words,
 * readingMinutes, images, isEmpty, dropped } (dropped: links or pictures
 * removed because their address was not allowed).
 */
function cleanDoc(value) {
    let raw = value;
    if (raw === undefined || raw === null || raw === '') raw = EMPTY_DOC;
    if (typeof raw === 'string') {
        if (raw.length > LIMITS.bytes) throw badRequest('The post is too long. Split it into more than one post.');
        try { raw = JSON.parse(raw); } catch { throw badRequest('The post content is not valid.'); }
    }
    if (!isObject(raw) || raw.type !== 'doc') throw badRequest('The post content is not valid.');
    if (JSON.stringify(raw).length > LIMITS.bytes) throw badRequest('The post is too long (including pictures pasted as data). Split it into more than one post.');

    const state = { nodes: 0, chars: 0, dropped: 0 };
    const content = Array.isArray(raw.content) ? raw.content : [];
    const blocks = [];
    for (const child of content) {
        if (!isObject(child) || typeof child.type !== 'string') throw badRequest('The post content is not valid.');
        if (!allowedChild(NODES.doc, child.type)) throw badRequest(`A ${label(child.type)} can't go at the top level of a post.`);
        const clean = cleanNode(child, 1, state, 'doc');
        if (clean) blocks.push(clean);
    }
    const doc = { type: 'doc', content: blocks.length ? blocks : [{ type: 'paragraph' }] };
    const text = textOf(doc).join('').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
    const words = countWords(text);
    return {
        doc,
        text,
        lead: leadOf(doc),
        words,
        readingMinutes: Math.max(1, Math.round(words / 225)),
        images: imagesOf(doc),
        isEmpty: words === 0 && !hasMedia(doc),
        dropped: state.dropped,
    };
}

/* A summary from the text when the post has no excerpt: ~180 characters, whole words. */
function autoExcerpt(text, max = 180) {
    const flat = String(text || '').replace(/\s+/g, ' ').trim();
    if (flat.length <= max) return flat;
    const cut = flat.slice(0, max + 1);
    const at = cut.lastIndexOf(' ');
    return `${cut.slice(0, at > max * 0.6 ? at : max).replace(/[\s,;:.–—-]+$/, '')}…`;
}

module.exports = { cleanDoc, autoExcerpt, safeHref, safeImageSrc, youtubeId, EMPTY_DOC, LIMITS };
