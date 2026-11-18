/*
 * The admin's own <head> tags (Admin › SEO & tracking › Head tags), stored
 * in site_settings as `head_tags` and added to the pages by seo/head.js.
 * validateHeadTags checks a value before it is saved (routes/settings.js
 * PUT /head_tags) or previewed:
 *
 *   { tags: [{
 *       id:      'a1b2c3d4e5f6'   kept across saves (made here when missing)
 *       label:   'Bing verification'   the admin's own note, never sent to visitors
 *       enabled: true
 *       tag:     'meta' | 'link' | 'script' | 'noscript'
 *       attrs:   { name: 'msvalidate.01', content: '…' }   allowed names per tag in ATTRS;
 *                on/off attributes (async, defer, nomodule) are true when set
 *       content: script body (JavaScript, or JSON for type application/ld+json),
 *                noscript HTML (img/iframe/link/meta only); '' for meta and link
 *       pages:   'all' | ['/metals', '/metal/*', …]   PAGE_KEYS
 *   }] }
 *
 * Addresses (href, src) must be http(s) or a path starting with /. Tags are
 * public by nature (they end up in page source); they are never added to
 * /admin pages.
 */
const crypto = require('crypto');
const { SEO_PAGE_PATHS } = require('../utils/seoSettings');

const MAX_TAGS = 50;
const MAX_TOTAL = 200 * 1024;      // the whole setting as JSON
const MAX_SCRIPT = 20000;          // one inline script / JSON-LD
const MAX_NOSCRIPT = 5000;

const TAG_TYPES = ['meta', 'link', 'script', 'noscript'];
// Every page of one kind (a metal, a service, a blog post).
const WILDCARD_PAGES = { '/metal/*': /^\/metal\/[^/]+$/, '/service/*': /^\/service\/[^/]+$/, '/blog/*': /^\/blog\/[^/]+$/ };
const PAGE_KEYS = [...SEO_PAGE_PATHS, ...Object.keys(WILDCARD_PAGES)];

class HeadTagError extends Error {}
const fail = (msg) => { throw new HeadTagError(msg); };

// One line of text: control characters and runs of whitespace become one space.
const line = (value, label, max) => {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string' && typeof value !== 'number') fail(`${label} must be text.`);
    const s = String(value).replace(/[\u0000-\u001F\u007F\s]+/g, ' ').trim();
    if (s.length > max) fail(`${label} is too long (max ${max} characters).`);
    return s;
};

const matching = (re, hint, max = 200) => (value, label) => {
    const s = line(value, label, max);
    if (s && !re.test(s)) fail(`${label} ${hint}`);
    return s;
};
const choice = (list) => (value, label) => {
    const s = line(value, label, 40).toLowerCase();
    if (s && !list.includes(s)) fail(`${label} must be one of: ${list.join(', ')}.`);
    return s;
};
// Free text (escaped when written into the page).
const text = (max) => (value, label) => line(value, label, max);
// An address: https://…, http://… or a path on this site (/…).
const address = (value, label) => {
    const s = line(value, label, 2000);
    if (!s) return '';
    if (/[\s"'<>\\`]/.test(s)) fail(`${label} contains characters an address cannot have.`);
    if (s.startsWith('/') && !s.startsWith('//')) return s;
    if (/^https?:\/\/[^/]/i.test(s)) {
        try { new URL(s); return s; } catch { /* below */ }
    }
    return fail(`${label} must start with https://, http:// or / (a page or file on this site).`);
};
// On/off attributes: true when set ('' is how HTML writes them).
const flag = (value, label) => {
    if (value === true || value === '' || value === 'true' || value === 1) return true;
    if (value === false || value === undefined || value === null || value === 'false' || value === 0) return false;
    return fail(`${label} must be on or off.`);
};
flag.isFlag = true;

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,99}$/;
const REFERRER = ['no-referrer', 'no-referrer-when-downgrade', 'origin', 'origin-when-cross-origin', 'same-origin', 'strict-origin', 'strict-origin-when-cross-origin', 'unsafe-url'];

const ATTRS = {
    meta: {
        name: matching(NAME_RE, 'can use letters, numbers and : . _ - only.'),
        property: matching(NAME_RE, 'can use letters, numbers and : . _ - only.'),
        content: text(2000),
        media: text(200),
    },
    link: {
        rel: matching(/^[a-z][a-z-]*( [a-z][a-z-]*)*$/i, 'must be words such as "icon" or "alternate".', 80),
        href: address,
        sizes: matching(/^(any|\d{1,4}x\d{1,4}( \d{1,4}x\d{1,4})*)$/i, 'must look like "32x32" or "any".', 100),
        type: matching(/^[a-z]+\/[a-z0-9.+-]+$/i, 'must be a file type such as image/png.', 100),
        hreflang: matching(/^([a-z]{2,3}(-[A-Za-z0-9]{2,8})*|x-default)$/i, 'must be a language code such as en-US or x-default.', 40),
        media: text(200),
        crossorigin: choice(['anonymous', 'use-credentials']),
        as: choice(['script', 'style', 'font', 'image', 'fetch', 'document', 'audio', 'video', 'track', 'worker']),
        title: text(200),
        color: matching(/^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i, 'must be a colour such as #e31b23.', 20),
        referrerpolicy: choice(REFERRER),
        integrity: matching(/^(sha256|sha384|sha512)-[A-Za-z0-9+/=]+( (sha256|sha384|sha512)-[A-Za-z0-9+/=]+)*$/, 'must be a sha256-/sha384-/sha512- hash.', 400),
        fetchpriority: choice(['high', 'low', 'auto']),
    },
    script: {
        src: address,
        type: choice(['text/javascript', 'module', 'application/ld+json']),
        async: flag,
        defer: flag,
        nomodule: flag,
        crossorigin: choice(['anonymous', 'use-credentials']),
        integrity: matching(/^(sha256|sha384|sha512)-[A-Za-z0-9+/=]+( (sha256|sha384|sha512)-[A-Za-z0-9+/=]+)*$/, 'must be a sha256-/sha384-/sha512- hash.', 400),
        referrerpolicy: choice(REFERRER),
        id: matching(/^[A-Za-z][\w:.-]{0,63}$/, 'must start with a letter and use letters, numbers and : . _ - only.', 64),
    },
    noscript: {},
};
// data-* attributes (many tracking snippets use them), scripts only.
const DATA_ATTR_RE = /^data-[a-z0-9]+(-[a-z0-9]+)*$/;

const describe = (index, label) => `Tag ${index + 1}${label ? ` (${label})` : ''}`;

// Line endings as the HTML parser leaves them, no NUL or other control characters but tab/newline.
const block = (value, label, max) => {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') fail(`${label} must be text.`);
    const s = value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim();
    if (s.length > max) fail(`${label} is too long (max ${max} characters).`);
    return s;
};

const NOSCRIPT_TAGS = /^\/?(img|iframe|link|meta)\b/i;

function cleanContent(tag, attrs, raw, where) {
    if (tag === 'meta' || tag === 'link') {
        if (raw !== undefined && raw !== null && raw !== '') fail(`${where}: <${tag}> has no content, only attributes.`);
        return '';
    }
    if (tag === 'noscript') {
        const html = block(raw, `${where} content`, MAX_NOSCRIPT);
        if (!html) fail(`${where}: add the HTML to show when JavaScript is off.`);
        for (const m of html.matchAll(/</g)) {
            if (!NOSCRIPT_TAGS.test(html.slice(m.index + 1, m.index + 12))) {
                fail(`${where}: a <noscript> tag may only contain <img>, <iframe>, <link> or <meta>.`);
            }
        }
        return html;
    }
    // script
    const body = block(raw, `${where} code`, MAX_SCRIPT * 2);
    if (attrs.type === 'application/ld+json') {
        if (!body) fail(`${where}: add the structured data (JSON).`);
        let parsed;
        try { parsed = JSON.parse(body); } catch (err) { fail(`${where}: the structured data is not valid JSON (${String(err.message).slice(0, 80)}).`); }
        if (!parsed || typeof parsed !== 'object') fail(`${where}: the structured data must be a JSON object or list.`);
        const json = JSON.stringify(parsed, null, 2);
        if (json.length > MAX_SCRIPT) fail(`${where}: the structured data is too long (max ${MAX_SCRIPT} characters).`);
        return json;
    }
    if (body.length > MAX_SCRIPT) fail(`${where} code is too long (max ${MAX_SCRIPT} characters).`);
    if (/<\/script|<!--|<script/i.test(body)) {
        fail(`${where}: paste only the code inside <script>…</script> (it cannot contain "<script", "</script" or "<!--").`);
    }
    return body;
}

function cleanAttrs(tag, raw, where) {
    if (raw !== undefined && raw !== null && (typeof raw !== 'object' || Array.isArray(raw))) fail(`${where}: attributes must be an object.`);
    const src = raw || {};
    const rules = ATTRS[tag];
    const attrs = {};
    for (const [rawName, value] of Object.entries(src)) {
        const name = String(rawName).trim().toLowerCase();
        if (!name) continue;
        const label = `${where} "${name}"`;
        if (rules[name]) {
            const cleaned = rules[name](value, label);
            if (rules[name].isFlag) { if (cleaned) attrs[name] = true; } else if (cleaned) attrs[name] = cleaned;
        } else if (tag === 'script' && DATA_ATTR_RE.test(name) && name.length <= 50 && name !== 'data-head') {
            const cleaned = text(500)(value, label);
            attrs[name] = cleaned;
        } else {
            fail(`${where}: <${tag}> cannot have a "${name.slice(0, 40)}" attribute here.`);
        }
    }
    return attrs;
}

function checkShape(tag, attrs, content, where) {
    if (tag === 'meta') {
        if (Boolean(attrs.name) === Boolean(attrs.property)) fail(`${where}: give the meta tag a name or a property (one of them).`);
        if (!attrs.content) fail(`${where}: the meta tag needs a content value.`);
        if (String(attrs.name || '').toLowerCase() === 'viewport') fail(`${where}: the viewport tag is built into the site.`);
    } else if (tag === 'link') {
        if (!attrs.rel) fail(`${where}: the link needs a rel, e.g. "icon" or "alternate".`);
        if (!attrs.href) fail(`${where}: the link needs an address (href).`);
        if (attrs.as && !/(^| )(preload|modulepreload)( |$)/i.test(attrs.rel)) fail(`${where}: "as" is only for rel="preload".`);
    } else if (tag === 'script') {
        const json = attrs.type === 'application/ld+json';
        if (json && (attrs.src || attrs.async || attrs.defer)) fail(`${where}: structured data (JSON-LD) is written inline, without src, async or defer.`);
        if (!json && Boolean(attrs.src) === Boolean(content)) fail(`${where}: give the script either an address (src) or code, not both.`);
        if (!attrs.src && (attrs.async || attrs.defer || attrs.integrity)) fail(`${where}: async, defer and integrity only apply to a script with an address (src).`);
        if (attrs.id && /^ld-/i.test(attrs.id)) fail(`${where}: ids starting with "ld-" are used by the site itself.`);
    }
}

function cleanPages(raw, where) {
    if (raw === undefined || raw === null || raw === 'all') return 'all';
    if (!Array.isArray(raw)) fail(`${where}: pages must be "all" or a list of pages.`);
    const out = [];
    for (const key of raw) {
        if (typeof key !== 'string' || !PAGE_KEYS.includes(key)) fail(`${where}: unknown page "${String(key).slice(0, 40)}".`);
        if (!out.includes(key)) out.push(key);
    }
    if (!out.length) fail(`${where}: choose at least one page, or all pages.`);
    return out;
}

const newId = () => crypto.randomBytes(6).toString('hex');

/* -> { value } (normalized) or { error } (a message for the admin). */
function validateHeadTags(input) {
    try {
        let raw = input;
        if (typeof raw === 'string') {
            try { raw = JSON.parse(raw); } catch { fail('Head tags must be a JSON object.'); }
        }
        if (raw === null || raw === undefined) raw = {};
        if (typeof raw !== 'object' || Array.isArray(raw)) fail('Head tags must be an object: { tags: [...] }.');
        const list = raw.tags === undefined || raw.tags === null ? [] : raw.tags;
        if (!Array.isArray(list)) fail('Head tags: "tags" must be a list.');
        if (list.length > MAX_TAGS) fail(`Use at most ${MAX_TAGS} head tags.`);

        const seen = new Set();
        const tags = list.map((item, index) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) fail(`${describe(index)} is not valid.`);
            const label = line(item.label, `${describe(index)} label`, 80);
            const where = describe(index, label);
            const tag = String(item.tag || '').toLowerCase();
            if (!TAG_TYPES.includes(tag)) fail(`${where}: the tag must be one of ${TAG_TYPES.map(t => `<${t}>`).join(', ')}.`);
            if (item.enabled !== undefined && typeof item.enabled !== 'boolean') fail(`${where}: "enabled" must be true or false.`);
            const attrs = cleanAttrs(tag, item.attrs, where);
            const content = cleanContent(tag, attrs, item.content, where);
            checkShape(tag, attrs, content, where);
            let id = typeof item.id === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(item.id) ? item.id : newId();
            while (seen.has(id)) id = newId();
            seen.add(id);
            return { id, label, enabled: item.enabled !== false, tag, attrs, content, pages: cleanPages(item.pages, where) };
        });

        const value = { tags };
        if (JSON.stringify(value).length > MAX_TOTAL) fail(`Head tags are too large in total (max ${Math.round(MAX_TOTAL / 1024)} KB).`);
        return { value };
    } catch (err) {
        if (err instanceof HeadTagError) return { error: err.message };
        throw err;
    }
}

/* Whether a tag's pages include this (normalized) path. */
function appliesTo(pages, path) {
    if (pages === 'all') return true;
    return Array.isArray(pages) && pages.some(key => (WILDCARD_PAGES[key] ? WILDCARD_PAGES[key].test(path) : key === path));
}

module.exports = { validateHeadTags, appliesTo, PAGE_KEYS, WILDCARD_PAGES, TAG_TYPES, ATTRS };
