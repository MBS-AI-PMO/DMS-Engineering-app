/*
 * Admin > Contact: the site settings it edits, as one form.
 *
 *   footer_contact          { phone, email, address }            footer + contact page
 *   contact_form_recipients "a@x.com, b@y.com" (admin only)     where contact-form messages go
 *   social_links            [{ platform, url, enabled }]         footer icons
 *   top_metals              [{ name, slug }]                     footer "Top metals" column
 *   show_service_breakdown  boolean                              per-service prices on quotes
 *
 * Images (navbar_logo, footer_logo, site_logo, hero_image) are uploaded and
 * saved one by one, outside this form.
 */

export const FORM_KEYS = ['footer_contact', 'contact_form_recipients', 'social_links', 'top_metals', 'show_service_breakdown'];
export const IMAGE_KEYS = ['navbar_logo', 'footer_logo', 'site_logo', 'hero_image'];

// The platforms the footer can show, in footer order.
export const PLATFORMS = [
    { platform: 'linkedin', label: 'LinkedIn', placeholder: 'https://www.linkedin.com/company/…' },
    { platform: 'facebook', label: 'Facebook', placeholder: 'https://www.facebook.com/…' },
    { platform: 'instagram', label: 'Instagram', placeholder: 'https://www.instagram.com/…' },
];

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;
export const MAX_RECIPIENTS = 5;

const text = (v) => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));

export function toBoolean(value, fallback = true) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        if (v === 'true') return true;
        if (v === 'false') return false;
    }
    return fallback;
}

/* A stored image setting (a path, or { avif, webp, jpg } for the hero) -> a URL to show. */
export function imageSrc(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return value.avif || value.webp || value.jpg || value.jpeg || value.png || value.src || '';
    return '';
}

/* Every known platform is listed (missing ones off and empty); others stored are kept after them. */
function socialLinks(stored) {
    const list = Array.isArray(stored) ? stored.filter(s => s && typeof s === 'object') : [];
    const known = PLATFORMS.map(({ platform }) => {
        const found = list.find(s => s.platform === platform);
        return { platform, url: text(found?.url), enabled: Boolean(found?.enabled) };
    });
    const others = list.filter(s => !PLATFORMS.some(p => p.platform === s.platform))
        .map(s => ({ ...s, url: text(s.url), enabled: Boolean(s.enabled) }));
    return [...known, ...others];
}

export function toForm(settings = {}, privateSettings = {}) {
    const contact = settings.footer_contact && typeof settings.footer_contact === 'object' ? settings.footer_contact : {};
    return {
        footer_contact: { phone: text(contact.phone), email: text(contact.email), address: text(contact.address) },
        contact_form_recipients: text(privateSettings.contact_form_recipients),
        social_links: socialLinks(settings.social_links),
        top_metals: (Array.isArray(settings.top_metals) ? settings.top_metals : [])
            .filter(m => m && m.slug)
            .map(m => ({ name: text(m.name), slug: text(m.slug) })),
        show_service_breakdown: toBoolean(settings.show_service_breakdown, true),
    };
}

/* What is stored for each key (trimmed). */
export function toValues(form) {
    return {
        footer_contact: {
            phone: form.footer_contact.phone.trim(),
            email: form.footer_contact.email.trim(),
            address: form.footer_contact.address.trim(),
        },
        contact_form_recipients: form.contact_form_recipients.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean).join(', '),
        social_links: form.social_links.map(s => ({ ...s, url: s.url.trim() })),
        top_metals: form.top_metals,
        show_service_breakdown: form.show_service_breakdown,
    };
}

/* { field: message } for what must be fixed before saving. */
export function validate(form) {
    const errors = {};
    const email = form.footer_contact.email.trim();
    if (email && !EMAIL_RE.test(email)) errors.email = 'This is not a valid email address.';
    const inbox = form.contact_form_recipients.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
    if (inbox.length > MAX_RECIPIENTS) errors.inbox = `Use at most ${MAX_RECIPIENTS} addresses.`;
    else if (inbox.some(e => !EMAIL_RE.test(e))) errors.inbox = `“${inbox.find(e => !EMAIL_RE.test(e))}” is not a valid email address.`;
    form.social_links.forEach((s) => {
        const url = s.url.trim();
        if (url && !/^https?:\/\/\S+$/i.test(url)) errors[`social:${s.platform}`] = 'Start the link with https://';
        else if (s.enabled && !url) errors[`social:${s.platform}`] = 'Add the link or turn it off.';
    });
    return errors;
}
