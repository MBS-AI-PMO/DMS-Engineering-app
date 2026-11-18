import { SEO_PAGES, isSafeImageUrl, normalizeSeoMeta } from '../../../utils/seo';
import { PIXEL_ID_RULES } from '../../../utils/tracking';

/*
 * Admin > SEO & tracking: two of the settings it edits, as form state
 * (the third, head_tags, is in headTagsForm.js).
 *
 *   seo_meta         { defaults: {...}, pages: { '/path': { title, description, ogImage } } }
 *   tracking_pixels  { ga4: { enabled, id }, facebook: {...}, tiktok: {...} }
 *
 * The server checks both again (backend/utils/seoSettings.js).
 */

export const PIXELS = [
    {
        key: 'ga4', name: 'Google Analytics 4', idLabel: 'Measurement ID', placeholder: 'G-XXXXXXXXXX', upper: true,
        format: 'Starts with G- followed by letters and numbers.',
        where: 'Google Analytics › Admin › Data streams › your web stream.',
    },
    {
        key: 'facebook', name: 'Meta (Facebook) Pixel', idLabel: 'Pixel ID', placeholder: '123456789012345', upper: false,
        format: '6–20 digits.',
        where: 'Meta Events Manager › Data sources › your pixel.',
    },
    {
        key: 'tiktok', name: 'TikTok Pixel', idLabel: 'Pixel ID', placeholder: 'C4XXXXXXXXXXXXXXXXXX', upper: true,
        format: '10–30 letters and numbers.',
        where: 'TikTok Ads Manager › Tools › Events › Web events.',
    },
];

// What pages show when a field is empty (backend/seo/head.js FALLBACK).
export const STATIC_FALLBACK = {
    title: 'Dynamic Manufacturing Solutions',
    description: 'Custom laser-cut, bent and CNC-machined metal parts from Dallas, Texas. Upload a STEP or DXF file and get an instant price.',
    siteName: 'Dynamic Manufacturing Solutions',
};
export const TITLE_RECOMMENDED = 60;
export const DESCRIPTION_RECOMMENDED = 160;

export const emptyPage = () => ({ title: '', description: '', ogImage: '' });

export function toForm(raw) {
    const { defaults, pages } = normalizeSeoMeta(raw);
    const allPages = {};
    SEO_PAGES.forEach(({ path }) => { allPages[path] = { ...emptyPage(), ...(pages[path] || {}) }; });
    return { defaults, pages: allPages };
}

export function toPixels(raw) {
    const out = {};
    PIXELS.forEach(({ key }) => {
        const entry = raw && typeof raw === 'object' ? raw[key] : null;
        out[key] = { enabled: entry?.enabled === true, id: typeof entry?.id === 'string' ? entry.id : '' };
    });
    return out;
}

export const isCustomPage = (page) => Boolean(page && (page.title.trim() || page.description.trim() || page.ogImage.trim()));

// The bare code, or the whole <meta name="google-site-verification" content="..."> tag.
const extractVerification = (value) => {
    const match = String(value || '').match(/content\s*=\s*["']([^"']+)["']/i);
    return (match ? match[1] : String(value || '')).trim();
};

export function buildSeoPayload(form) {
    const defaults = {};
    Object.entries(form.defaults).forEach(([key, value]) => { defaults[key] = typeof value === 'string' ? value.trim() : value; });
    defaults.googleVerification = extractVerification(form.defaults.googleVerification);
    const pages = {};
    Object.entries(form.pages).forEach(([path, page]) => {
        const clean = { title: page.title.trim(), description: page.description.trim(), ogImage: page.ogImage.trim() };
        if (clean.title || clean.description || clean.ogImage) pages[path] = clean;
    });
    return { defaults, pages };
}

export function buildPixelPayload(pixels) {
    const out = {};
    PIXELS.forEach(({ key, upper }) => {
        const id = pixels[key].id.trim();
        out[key] = { enabled: pixels[key].enabled, id: upper ? id.toUpperCase() : id };
    });
    return out;
}

/* The tab (SeoPage TABS) an error key belongs to. */
const SOCIAL_FIELDS = ['ogTitle', 'ogDescription', 'ogImage', 'twitterCard', 'twitterSite'];
export const tabOfError = (key) => (key.startsWith('page:') ? 'pages'
    : key.startsWith('pixel:') ? 'pixels'
        : key.startsWith('head:') ? 'head'
            : SOCIAL_FIELDS.includes(key) ? 'social' : 'search');

/* { field: message }. Keys: defaults field names, `page:<path>`, `pixel:<key>`. */
export function validate(seo, pixels) {
    const errors = {};
    const d = seo.defaults;
    if (d.titleTemplate && !d.titleTemplate.includes('%s')) errors.titleTemplate = 'Include %s where the page title goes, e.g. "%s | DMS".';
    if (d.siteUrl && !/^https?:\/\/[^/\s]+\/?$/i.test(d.siteUrl)) errors.siteUrl = 'Use just the site address, e.g. https://dmscuts.com';
    if (d.ogImage && !isSafeImageUrl(d.ogImage)) errors.ogImage = 'Use an https:// URL or a /uploads/… path.';
    if (d.twitterSite && !/^@?[A-Za-z0-9_]{1,15}$/.test(d.twitterSite)) errors.twitterSite = 'Up to 15 letters, numbers or underscores.';
    if (d.googleVerification && !/^[A-Za-z0-9_-]{10,100}$/.test(d.googleVerification)) errors.googleVerification = 'Paste the content value (or the whole meta tag).';
    if (d.favicon && !isSafeImageUrl(d.favicon)) errors.favicon = 'Use an https:// URL or a path starting with /.';
    if (d.appleTouchIcon && !isSafeImageUrl(d.appleTouchIcon)) errors.appleTouchIcon = 'Use an https:// URL or a path starting with /.';
    if (d.themeColor && !/^#[0-9a-f]{6}$/i.test(d.themeColor)) errors.themeColor = 'Use a hex colour such as #e31b23.';
    Object.entries(seo.pages).forEach(([path, page]) => {
        if (page.ogImage && !isSafeImageUrl(page.ogImage)) errors[`page:${path}`] = 'Use an https:// URL or a /uploads/… path.';
    });
    PIXELS.forEach(({ key, name, idLabel, format }) => {
        const { enabled, id } = pixels[key];
        if (id && !PIXEL_ID_RULES[key].test(id)) errors[`pixel:${key}`] = `Invalid ${idLabel}. ${format}`;
        else if (enabled && !id) errors[`pixel:${key}`] = `Enter the ${idLabel} or turn ${name} off.`;
    });
    return errors;
}
