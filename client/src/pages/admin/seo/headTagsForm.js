import { SEO_PAGES } from '../../../utils/seo';

/*
 * Admin › SEO & tracking › Head tags: the `head_tags` setting as form state.
 *
 *   head_tags  { tags: [{ id, label, enabled, tag: 'meta' | 'link' | 'script' | 'noscript',
 *                         attrs: { name: value, async: true… }, content, pages: 'all' | [page keys] }] }
 *
 * The tag dialog edits a flatter "draft" (toDraft / fromDraft). validateDraft
 * repeats the server's main rules (backend/seo/headTags.js) so a mistake shows
 * beside its field; the server checks everything again when it is saved.
 * parseSnippet reads pasted HTML (what Google, Bing, Meta… hand out) into tags.
 */

export const TAG_TYPES = [
    { value: 'meta', label: 'Meta', hint: 'Verification codes and extra information for search engines or apps.' },
    { value: 'link', label: 'Link', hint: 'Icons, other-language versions (hreflang), preconnect, feeds.' },
    { value: 'script', label: 'Script', hint: 'A script file, a snippet of code, or structured data (JSON-LD).' },
    { value: 'noscript', label: 'Noscript', hint: 'HTML for visitors with JavaScript off, e.g. a pixel image.' },
];

export const SCRIPT_MODES = [
    { value: 'src', label: 'Script file' },
    { value: 'inline', label: 'Code' },
    { value: 'json', label: 'Structured data' },
];

export const WILDCARD_PAGES = [
    { path: '/metal/*', label: 'Every metal page' },
    { path: '/service/*', label: 'Every service page' },
    { path: '/blog/*', label: 'Every blog post' },
];
export const PAGE_CHOICES = [...SEO_PAGES, ...WILDCARD_PAGES];
export const pageLabel = (key) => PAGE_CHOICES.find(p => p.path === key)?.label || key;

// Attributes besides the main ones each kind of tag may have (the server's list).
export const EXTRA_ATTRS = {
    meta: ['media'],
    link: ['sizes', 'type', 'hreflang', 'media', 'crossorigin', 'as', 'title', 'color', 'referrerpolicy', 'integrity', 'fetchpriority'],
    script: ['type', 'crossorigin', 'integrity', 'referrerpolicy', 'id', 'nomodule'],
    noscript: [],
};
const BOOLEAN_ATTRS = ['async', 'defer', 'nomodule'];
const DATA_ATTR_RE = /^data-[a-z0-9]+(-[a-z0-9]+)*$/;
export const MAX_TAGS = 50;

export const newId = () => {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
};

/* Whatever is stored (or missing) -> the list the page edits. */
export function toHeadTags(raw) {
    const list = Array.isArray(raw?.tags) ? raw.tags : [];
    return list.filter(t => t && typeof t === 'object' && TAG_TYPES.some(x => x.value === t.tag)).map(t => ({
        id: typeof t.id === 'string' && t.id ? t.id : newId(),
        label: typeof t.label === 'string' ? t.label : '',
        enabled: t.enabled !== false,
        tag: t.tag,
        attrs: t.attrs && typeof t.attrs === 'object' && !Array.isArray(t.attrs) ? { ...t.attrs } : {},
        content: typeof t.content === 'string' ? t.content : '',
        pages: Array.isArray(t.pages) ? [...t.pages] : 'all',
    }));
}

export const buildHeadTagsPayload = (tags) => ({ tags });

// ── Draft (the dialog's fields) ─────────────────────────────────────────────

export const newDraft = (tag = 'meta') => ({
    id: '', label: '', enabled: true, tag, pages: 'all',
    metaKey: 'name', metaName: '', metaContent: '',
    rel: '', href: '',
    scriptMode: 'src', src: '', async: true, defer: false, code: '', json: '',
    html: '',
    extra: [], // [{ name, value }]
});

const MAIN_ATTRS = {
    meta: ['name', 'property', 'content'],
    link: ['rel', 'href'],
    script: ['src', 'async', 'defer'],
    noscript: [],
};

export function toDraft(tag) {
    const a = tag.attrs || {};
    const draft = { ...newDraft(tag.tag), id: tag.id, label: tag.label || '', enabled: tag.enabled !== false, pages: tag.pages };
    const json = tag.tag === 'script' && a.type === 'application/ld+json';
    const main = new Set([...MAIN_ATTRS[tag.tag], ...(json ? ['type'] : [])]);
    if (tag.tag === 'meta') {
        draft.metaKey = a.property ? 'property' : 'name';
        draft.metaName = a.property || a.name || '';
        draft.metaContent = a.content || '';
    } else if (tag.tag === 'link') {
        draft.rel = a.rel || '';
        draft.href = a.href || '';
    } else if (tag.tag === 'script') {
        draft.scriptMode = json ? 'json' : a.src ? 'src' : 'inline';
        draft.src = a.src || '';
        draft.async = Boolean(a.async === true || a.async === '');
        draft.defer = Boolean(a.defer === true || a.defer === '');
        if (json) draft.json = tag.content || '';
        else draft.code = tag.content || '';
    } else {
        draft.html = tag.content || '';
    }
    draft.extra = Object.entries(a)
        .filter(([name]) => !main.has(name))
        .map(([name, value]) => ({ name, value: value === true ? '' : String(value) }));
    return draft;
}

export function fromDraft(d) {
    const attrs = {};
    let content = '';
    if (d.tag === 'meta') {
        attrs[d.metaKey === 'property' ? 'property' : 'name'] = d.metaName.trim();
        attrs.content = d.metaContent.trim();
    } else if (d.tag === 'link') {
        attrs.rel = d.rel.trim().toLowerCase();
        attrs.href = d.href.trim();
    } else if (d.tag === 'script') {
        if (d.scriptMode === 'json') {
            attrs.type = 'application/ld+json';
            content = d.json.trim();
        } else if (d.scriptMode === 'src') {
            attrs.src = d.src.trim();
            if (d.async) attrs.async = true;
            if (d.defer) attrs.defer = true;
        } else {
            content = d.code.trim();
        }
    } else {
        content = d.html.trim();
    }
    d.extra.forEach(({ name, value }) => {
        const key = name.trim().toLowerCase();
        if (!key || (d.tag === 'script' && d.scriptMode === 'json' && key === 'type')) return;
        attrs[key] = BOOLEAN_ATTRS.includes(key) ? true : value.trim();
    });
    return { id: d.id || newId(), label: d.label.trim(), enabled: d.enabled, tag: d.tag, attrs, content, pages: d.pages };
}

// ── Checks (the server's main rules) ────────────────────────────────────────

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,99}$/;
const HASH_RE = /^(sha256|sha384|sha512)-[A-Za-z0-9+/=]+( (sha256|sha384|sha512)-[A-Za-z0-9+/=]+)*$/;
const EXTRA_RULES = {
    sizes: [/^(any|\d{1,4}x\d{1,4}( \d{1,4}x\d{1,4})*)$/i, 'Use sizes like 32x32 or any.'],
    type: [/^[a-z]+\/[a-z0-9.+-]+$/i, 'Use a file type such as image/png.'],
    hreflang: [/^([a-z]{2,3}(-[A-Za-z0-9]{2,8})*|x-default)$/i, 'Use a language code such as en-US or x-default.'],
    crossorigin: [/^(anonymous|use-credentials)$/, 'Use anonymous or use-credentials.'],
    integrity: [HASH_RE, 'Use a sha256-, sha384- or sha512- hash.'],
    fetchpriority: [/^(high|low|auto)$/, 'Use high, low or auto.'],
    id: [/^[A-Za-z][\w:.-]{0,63}$/, 'Start with a letter; letters, numbers and : . _ - only.'],
};

/* https://…, http://… or a path on this site; '' when fine, else the message. */
export function addressError(value) {
    const s = String(value || '').trim();
    if (!s) return 'Add the address.';
    if (/[\s"'<>\\`]/.test(s)) return 'The address has a space or a character it cannot have.';
    if (s.startsWith('/') && !s.startsWith('//')) return '';
    if (/^https?:\/\/[^/]/i.test(s)) {
        try { new URL(s); return ''; } catch { /* below */ }
    }
    return 'Start with https://, http:// or / (a file on this site).';
}

export function noscriptError(html) {
    if (!html.trim()) return 'Add the HTML to show when JavaScript is off.';
    for (const m of html.matchAll(/</g)) {
        if (!/^\/?(img|iframe|link|meta)\b/i.test(html.slice(m.index + 1, m.index + 12))) return 'Only <img>, <iframe>, <link> or <meta> can go inside <noscript>.';
    }
    return '';
}

/* { field: message } for the dialog. Fields: metaName, metaContent, rel, href, src, code, json, html, pages, extra:<i>. */
export function validateDraft(d) {
    const errors = {};
    if (d.tag === 'meta') {
        const name = d.metaName.trim();
        if (!name) errors.metaName = `Add the ${d.metaKey}.`;
        else if (!NAME_RE.test(name)) errors.metaName = 'Letters, numbers and : . _ - only.';
        else if (name.toLowerCase() === 'viewport') errors.metaName = 'The viewport tag is built into the site.';
        if (!d.metaContent.trim()) errors.metaContent = 'Add the content value.';
    } else if (d.tag === 'link') {
        if (!d.rel.trim()) errors.rel = 'Add the rel, e.g. icon or alternate.';
        else if (!/^[a-z][a-z-]*( [a-z][a-z-]*)*$/i.test(d.rel.trim())) errors.rel = 'Words such as icon, alternate or preconnect.';
        const href = addressError(d.href);
        if (href) errors.href = href;
    } else if (d.tag === 'script') {
        if (d.scriptMode === 'src') {
            const src = addressError(d.src);
            if (src) errors.src = src;
        } else if (d.scriptMode === 'json') {
            if (!d.json.trim()) errors.json = 'Add the structured data.';
            else {
                try {
                    const parsed = JSON.parse(d.json);
                    if (!parsed || typeof parsed !== 'object') errors.json = 'It must be a JSON object or list.';
                } catch (err) {
                    errors.json = `Not valid JSON: ${String(err.message).slice(0, 90)}`;
                }
            }
        } else if (!d.code.trim()) errors.code = 'Add the code.';
        else if (/<\/script|<!--|<script/i.test(d.code)) errors.code = 'Paste only the code inside <script>…</script>, without the <script> tags or <!-- comments -->.';
        else if (d.code.length > 20000) errors.code = 'Keep it under 20,000 characters.';
    } else {
        const html = noscriptError(d.html);
        if (html) errors.html = html;
    }
    const allowed = EXTRA_ATTRS[d.tag];
    const seen = new Set();
    d.extra.forEach(({ name, value }, i) => {
        const key = name.trim().toLowerCase();
        if (!key && !value.trim()) return;
        if (!key) errors[`extra:${i}`] = 'Add the attribute name.';
        else if (seen.has(key)) errors[`extra:${i}`] = 'This attribute is already set.';
        else if (!allowed.includes(key) && !(d.tag === 'script' && DATA_ATTR_RE.test(key) && key !== 'data-head')) {
            errors[`extra:${i}`] = allowed.length || d.tag === 'script'
                ? `Not allowed here. Use ${[...allowed, ...(d.tag === 'script' ? ['data-…'] : [])].join(', ')}.`
                : 'This tag has no attributes.';
        } else if (key === 'type' && d.tag === 'script' && !['text/javascript', 'module'].includes(value.trim())) errors[`extra:${i}`] = 'Use text/javascript or module.';
        else if (EXTRA_RULES[key] && value.trim() && !EXTRA_RULES[key][0].test(value.trim())) errors[`extra:${i}`] = EXTRA_RULES[key][1];
        seen.add(key);
    });
    if (d.tag === 'script' && d.scriptMode !== 'src' && d.extra.some(x => x.name.trim().toLowerCase() === 'integrity')) {
        errors.code = errors.code || 'integrity only applies to a script file.';
    }
    if (d.label.length > 80) errors.label = 'Keep the name under 80 characters.';
    if (Array.isArray(d.pages) && !d.pages.length) errors.pages = 'Choose at least one page, or all pages.';
    return errors;
}

/* { 'head:<id>': message } for the page's save check. */
export function validateHeadTags(tags) {
    const errors = {};
    tags.forEach((tag) => {
        const found = validateDraft(toDraft(tag));
        const first = Object.values(found)[0];
        if (first) errors[`head:${tag.id}`] = first;
    });
    if (tags.length > MAX_TAGS) errors['head:count'] = `Use at most ${MAX_TAGS} head tags.`;
    return errors;
}

// ── Showing tags ────────────────────────────────────────────────────────────

const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* A tag as HTML, written the way the server writes it (mark: add data-head="dms"). */
export function tagHtml(t, { mark = false } = {}) {
    if (t.tag === 'title') return `<title>${escapeText(t.content || '')}</title>`;
    const attrs = Object.entries(t.attrs || {})
        .map(([name, value]) => (value === true || value === '' ? ` ${name}` : ` ${name}="${escapeAttr(value)}"`))
        .join('') + (mark ? ' data-head="dms"' : '');
    if (t.tag === 'meta' || t.tag === 'link') return `<${t.tag}${attrs}>`;
    return `<${t.tag}${attrs}>${t.content || ''}</${t.tag}>`;
}

/* A short name for a tag without a label of its own. */
export function describeTag(t) {
    const a = t.attrs || {};
    if (t.tag === 'meta') return a.name || a.property || 'Meta tag';
    if (t.tag === 'link') return `${a.rel || 'link'}${a.hreflang ? ` (${a.hreflang})` : ''}${a.sizes ? ` ${a.sizes}` : ''}`;
    if (t.tag === 'script') {
        if (a.type === 'application/ld+json') {
            try {
                const data = JSON.parse(t.content);
                const type = Array.isArray(data) ? data[0]?.['@type'] : data['@type'];
                return `Structured data${type ? `: ${type}` : ''}`;
            } catch { return 'Structured data'; }
        }
        if (a.src) {
            try { return `Script from ${new URL(a.src, window.location.origin).host}`; } catch { return 'Script file'; }
        }
        return 'Inline script';
    }
    return 'Noscript fallback';
}

// ── Pasted HTML ─────────────────────────────────────────────────────────────

/*
 * '<meta name="x" content="y"><script async src="…"></script>…' ->
 * { tags: [tag], skipped: ['<style>', …] }. New tags are on, for all pages.
 * <noscript> blocks are read as written (the browser's parser would move an
 * <img> inside one out of <head>).
 */
export function parseSnippet(html) {
    const tags = [];
    const noscripts = [];
    const skipped = [];
    const rest = String(html || '').replace(/<noscript\b[^>]*>([\s\S]*?)<\/noscript\s*>/gi, (_, inner) => {
        noscripts.push({ tag: 'noscript', attrs: {}, content: inner.trim() });
        return '';
    });
    const doc = new DOMParser().parseFromString(`<!doctype html><html><head>${rest}</head><body></body></html>`, 'text/html');
    [...doc.head.children, ...doc.body.children].forEach((el) => {
        const tag = el.tagName.toLowerCase();
        const attrs = {};
        for (const a of el.attributes) attrs[a.name] = a.value;
        if (!['meta', 'link', 'script'].includes(tag) || (tag === 'meta' && (attrs.charset !== undefined || attrs['http-equiv'] !== undefined))) {
            skipped.push(tag === 'meta' ? '<meta charset/http-equiv>' : `<${tag}>`);
            return;
        }
        BOOLEAN_ATTRS.forEach((name) => { if (name in attrs) attrs[name] = true; });
        if (attrs.crossorigin === '') attrs.crossorigin = 'anonymous';
        if (tag === 'script' && /^(text|application)\/(java|ecma)script$/i.test(attrs.type || '')) delete attrs.type;
        let content = tag === 'script' ? el.textContent.trim() : '';
        if (tag === 'script' && attrs.type === 'application/ld+json') {
            try { content = JSON.stringify(JSON.parse(content), null, 2); } catch { /* shown as an error */ }
        }
        tags.push({ tag, attrs, content });
    });
    const all = [...tags, ...noscripts].map(t => ({ id: newId(), label: '', enabled: true, pages: 'all', ...t }));
    return { tags: all, skipped: [...new Set(skipped)] };
}
