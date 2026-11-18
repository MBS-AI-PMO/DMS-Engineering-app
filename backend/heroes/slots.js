/*
 * Every public page that opens with a hero picture, and the exact size of
 * that picture's box.
 *
 * Sizes were measured on the site (Nov 2026): `size` is the box on a
 * full-HD screen (1920 px wide), `phone` the box on a 390 px phone. Heroes
 * are full width and crop the picture to fill the box ("cover"), keeping
 * `position` (CSS object-position) in view. Change these when a page's
 * hero CSS changes height.
 *
 * Where each picture is stored (site_settings):
 *   home          -> hero_image (the key the home page has always read)
 *   anything else -> page_heroes[key] = { src, updated_at }
 * Service pages keep their own picture in hero_sections (one per service);
 * a service page without one shows the Services page picture.
 */
const SITE_PAGES = [
    { key: 'home', label: 'Home', path: '/', size: [1920, 1026], phone: [390, 844], position: '50% 50%', note: 'Fills the screen, so its height follows the screen. Keep the subject in the middle.' },
    { key: 'services', label: 'Services', path: '/services', size: [1920, 540], phone: [390, 507], position: '70% 50%', note: 'Service pages without their own picture show this one too.' },
    { key: 'metals', label: 'Metals', path: '/metals', size: [1920, 544], phone: [390, 529], position: '50% 40%' },
    { key: 'metal', label: 'Every metal page', path: '/metals', size: [1920, 502], phone: [390, 552], position: '70% 50%', note: 'One picture for all the metal pages (/metal/…).' },
    { key: 'guidelines', label: 'Guidelines', path: '/guidelines', size: [1920, 450], phone: [390, 379], position: '50% 50%' },
    { key: 'faq', label: 'FAQ', path: '/faq', size: [1920, 438], phone: [390, 379], position: '50% 40%' },
    { key: 'contact', label: 'Contact', path: '/contact', size: [1920, 346], phone: [390, 250], position: '50% 45%' },
    { key: 'about', label: 'About us', path: '/about', size: [1920, 626], phone: [390, 663], position: '50% 55%' },
    { key: 'track', label: 'Track order', path: '/track-order', size: [1920, 346], phone: [390, 276], position: '50% 50%', note: 'Also above each customer\'s order (/track-order/…), where the box is a little shorter (1920 × 317, phone 390 × 225). Keep the subject in the middle.' },
];

/* Every /service/:slug page. */
const SERVICE_PAGE = { size: [1920, 501], phone: [390, 505], position: '70% 50%' };

const PAGE_KEYS = new Set(SITE_PAGES.map(p => p.key));

module.exports = { SITE_PAGES, SERVICE_PAGE, PAGE_KEYS };
