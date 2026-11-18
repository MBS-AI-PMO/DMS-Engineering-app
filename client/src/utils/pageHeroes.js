/*
 * Hero pictures of the public pages. The admin can replace each one in
 * Admin > Hero sections (sizes and page list: backend/heroes/slots.js);
 * a page without a replacement shows its built-in picture from here.
 *
 * Stored in settings: hero_image (home) and page_heroes[key] (the rest).
 */
import serviceHeroBg from '../assets/services/service-hero-bg.webp';
import metalsHeroImg from '../assets/metals-hero.webp';
import metalHeroBg from '../assets/metals/metal-hero-bg.webp';
import faqHeroImg from '../assets/faq-hero-parts.jpg';
import contactHeroImg from '../assets/contact-hero.webp';
import aboutHeroImg from '../assets/faq-hero.jpg';

export const PAGE_HERO_DEFAULTS = {
    home: '/assets/hero-home.webp',
    services: serviceHeroBg,
    metals: metalsHeroImg,
    metal: metalHeroBg,
    guidelines: '/assets/guidelines-hero.webp',
    faq: faqHeroImg,
    contact: contactHeroImg,
    about: aboutHeroImg,
    // Finished laser-cut parts, like About until the owner picks its own.
    track: aboutHeroImg,
};

/* A stored picture: '/uploads/…' or { avif, webp, jpg, src } -> one URL. */
export const pictureOf = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value.trim().replace(/^"(.*)"$/, '$1');
    return value.webp || value.jpg || value.src || value.avif || '';
};

/** The replacement picture saved for a page, or '' when it uses its built-in one. */
export const customPageHero = (settings, key) => pictureOf(key === 'home' ? settings?.hero_image : settings?.page_heroes?.[key]);

/*
 * The hero the server put in the first page's HTML (backend/seo/hero.js):
 * window.__DMS_HERO__ = { path, key, src } (src '' = built-in picture). Lets that
 * first page draw its hero at once instead of waiting for the settings. Only
 * valid for the address it was sent with.
 */
const cleanPath = (p) => {
    const s = String(p || '/').split(/[?#]/)[0].toLowerCase().replace(/\/{2,}/g, '/');
    return s.length > 1 ? s.replace(/\/+$/, '') : '/';
};
export function bootHero(pathname) {
    if (typeof window === 'undefined') return null;
    const note = window.__DMS_HERO__;
    if (!note || typeof note !== 'object' || cleanPath(note.path) !== cleanPath(pathname)) return null;
    return { key: String(note.key || ''), src: typeof note.src === 'string' ? note.src : '' };
}
