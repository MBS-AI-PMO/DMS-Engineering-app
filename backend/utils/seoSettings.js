/**
 * Validation for the admin-managed SEO + tracking settings stored in
 * site_settings (see routes/settings.js PUT /:key):
 *
 *   seo_meta        { defaults: {...}, pages: { '/path': { title, description, ogImage } } }
 *   tracking_pixels { ga4: { enabled, id }, facebook: { enabled, id }, tiktok: { enabled, id } }
 *
 * Both are public by nature (they end up in page source). Pixel IDs are
 * interpolated into script URLs on the client, so they are validated strictly
 * here and again on the client before use.
 *
 * Each validator returns { value } (normalized) or { error } (400 message).
 */

// Public routes that can carry per-page overrides. Keep in sync with
// SEO_PAGES in client/src/utils/seo.js.
const SEO_PAGE_PATHS = [
    '/', '/get-instant-pricing', '/metals', '/services', '/guidelines',
    '/faq', '/contact', '/about', '/quote', '/privacy-policy', '/terms-of-service',
];

const PIXEL_RULES = {
    ga4: { re: /^G-[A-Z0-9]{4,20}$/, upper: true, label: 'Google Analytics Measurement ID', hint: 'must look like G-XXXXXXXXXX' },
    facebook: { re: /^[0-9]{6,20}$/, upper: false, label: 'Facebook Pixel ID', hint: 'must be 6-20 digits' },
    tiktok: { re: /^[A-Z0-9]{10,30}$/, upper: true, label: 'TikTok Pixel ID', hint: 'must be 10-30 letters/numbers' },
};

const DEFAULT_FIELDS = {
    siteName: { label: 'Site name', max: 100 },
    title: { label: 'Default title', max: 150 },
    titleTemplate: { label: 'Title template', max: 150 },
    description: { label: 'Meta description', max: 500 },
    keywords: { label: 'Keywords', max: 500 },
    ogTitle: { label: 'Social title', max: 150 },
    ogDescription: { label: 'Social description', max: 500 },
};
const PAGE_FIELDS = {
    title: { label: 'title', max: 150 },
    description: { label: 'description', max: 500 },
};

class SeoValidationError extends Error {}
const fail = (msg) => { throw new SeoValidationError(msg); };

const asObject = (value, what) => {
    let v = value;
    if (typeof v === 'string') {
        try { v = JSON.parse(v); } catch { fail(`${what} must be a JSON object.`); }
    }
    if (v === null || v === undefined) return {};
    if (typeof v !== 'object' || Array.isArray(v)) fail(`${what} must be an object.`);
    return v;
};

// Single-line text: control characters and runs of whitespace collapse to one space.
const cleanText = (value, label, max) => {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string' && typeof value !== 'number') fail(`${label} must be text.`);
    const text = String(value).replace(/[\u0000-\u001F\u007F\s]+/g, ' ').trim();
    if (text.length > max) fail(`${label} is too long (max ${max} characters).`);
    return text;
};

// Root-relative path (/uploads/...) or absolute http(s) URL.
const cleanImageUrl = (value, label) => {
    const url = cleanText(value, label, 1000);
    if (!url) return '';
    if (/[\s"'<>\\`]/.test(url)) fail(`${label} contains invalid characters.`);
    if (url.startsWith('/') && !url.startsWith('//')) return url;
    try {
        const parsed = new URL(url);
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href;
    } catch { /* fall through */ }
    return fail(`${label} must be an http(s) URL or a path starting with /.`);
};

const validateSeoMeta = (input) => {
    try {
        const raw = asObject(input, 'SEO settings');
        const d = asObject(raw.defaults, 'SEO defaults');
        const defaults = {};
        for (const [key, rule] of Object.entries(DEFAULT_FIELDS)) {
            defaults[key] = cleanText(d[key], rule.label, rule.max);
        }
        if (defaults.titleTemplate && !defaults.titleTemplate.includes('%s')) {
            fail('Title template must contain %s where the page title goes, e.g. "%s | DMS".');
        }
        defaults.ogImage = cleanImageUrl(d.ogImage, 'Social image');

        const siteUrl = cleanText(d.siteUrl, 'Site URL', 200);
        defaults.siteUrl = '';
        if (siteUrl) {
            let parsed = null;
            try { parsed = new URL(siteUrl); } catch { /* handled below */ }
            if (!parsed || !/^https?:$/.test(parsed.protocol) || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username) {
                fail('Site URL must be just the site address, e.g. https://dmscuts.com');
            }
            defaults.siteUrl = parsed.origin;
        }

        const robots = cleanText(d.robots, 'Search engine indexing', 20) || 'index';
        if (!['index', 'noindex'].includes(robots)) fail('Search engine indexing must be "index" or "noindex".');
        defaults.robots = robots;

        const twitterCard = cleanText(d.twitterCard, 'Twitter card type', 40) || 'summary_large_image';
        if (!['summary', 'summary_large_image'].includes(twitterCard)) {
            fail('Twitter card type must be "summary" or "summary_large_image".');
        }
        defaults.twitterCard = twitterCard;

        const twitterSite = cleanText(d.twitterSite, 'Twitter/X handle', 20).replace(/^@/, '');
        if (twitterSite && !/^[A-Za-z0-9_]{1,15}$/.test(twitterSite)) {
            fail('Twitter/X handle must be 1-15 letters, numbers or underscores, e.g. @dmscuts.');
        }
        defaults.twitterSite = twitterSite ? `@${twitterSite}` : '';

        const verification = cleanText(d.googleVerification, 'Google verification code', 100);
        if (verification && !/^[A-Za-z0-9_-]{10,100}$/.test(verification)) {
            fail('Google Search Console code must be the content value only (letters, numbers, - and _).');
        }
        defaults.googleVerification = verification;

        const p = asObject(raw.pages, 'Page overrides');
        const pages = {};
        for (const [path, override] of Object.entries(p)) {
            if (!SEO_PAGE_PATHS.includes(path)) fail(`Unknown page for SEO override: ${String(path).slice(0, 60)}`);
            const o = asObject(override, `Override for ${path}`);
            const page = {};
            for (const [key, rule] of Object.entries(PAGE_FIELDS)) {
                page[key] = cleanText(o[key], `${path} ${rule.label}`, rule.max);
            }
            page.ogImage = cleanImageUrl(o.ogImage, `${path} social image`);
            if (page.title || page.description || page.ogImage) pages[path] = page;
        }

        return { value: { defaults, pages } };
    } catch (err) {
        if (err instanceof SeoValidationError) return { error: err.message };
        throw err;
    }
};

const validateTrackingPixels = (input) => {
    try {
        const raw = asObject(input, 'Tracking settings');
        const unknown = Object.keys(raw).filter(k => !PIXEL_RULES[k]);
        if (unknown.length) fail(`Unknown tracking provider: ${unknown[0].slice(0, 40)}`);

        const value = {};
        for (const [vendor, rule] of Object.entries(PIXEL_RULES)) {
            const entry = asObject(raw[vendor], rule.label);
            if (entry.enabled !== undefined && typeof entry.enabled !== 'boolean') fail(`${rule.label}: "enabled" must be true or false.`);
            if (entry.id !== undefined && entry.id !== null && typeof entry.id !== 'string') fail(`${rule.label} must be text.`);
            let id = String(entry.id || '').trim();
            if (rule.upper) id = id.toUpperCase();
            const enabled = entry.enabled === true;
            if (id && !rule.re.test(id)) fail(`${rule.label} ${rule.hint}.`);
            if (enabled && !id) fail(`Enter a ${rule.label} or turn it off.`);
            value[vendor] = { enabled, id };
        }
        return { value };
    } catch (err) {
        if (err instanceof SeoValidationError) return { error: err.message };
        throw err;
    }
};

module.exports = { validateSeoMeta, validateTrackingPixels, SEO_PAGE_PATHS };
