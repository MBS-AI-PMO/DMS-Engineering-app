/*
 * The hero picture of a page, for the HTML the server sends (seo/head.js).
 *
 * A page's hero used to start loading only after the app had started and
 * fetched the settings. The server already knows the picture, so it adds
 *   <link rel="preload" as="image" …>  the browser fetches it with the page
 *   <script>window.__DMS_HERO__ = { path, key, src }</script>
 * and the app (client/src/utils/pageHeroes.js bootHero) draws it at once.
 * src '' means the page shows its built-in picture (bundled with the app).
 *
 * Slots match backend/heroes/slots.js and client/src/utils/pageHeroes.js;
 * the srcset matches client/src/utils/imageUrl.js imageSrcSet(src, 1920), so
 * the browser reuses the preloaded file instead of fetching another size.
 */

const PAGE_KEYS = {
    '/': 'home',
    '/services': 'services',
    '/metals': 'metals',
    '/guidelines': 'guidelines',
    '/faq': 'faq',
    '/contact': 'contact',
    '/about': 'about',
    '/track-order': 'track',
};

// Must match IMAGE_WIDTHS in client/src/utils/imageUrl.js and backend/utils/imageVariants.js.
const WIDTHS = [160, 320, 480, 640, 960, 1280, 1600, 1920];
const VARIANTABLE = /^\/(?:api\/)?uploads\/[^?#]+\.(?:png|jpe?g|webp|avif|tiff?)$/i;

const pictureOf = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value.trim().replace(/^"(.*)"$/, '$1');
    return value.webp || value.jpg || value.src || value.avif || '';
};

const srcSetOf = (src) => (VARIANTABLE.test(src) ? WIDTHS.map(w => `${src}?w=${w} ${w}w`).join(', ') : '');

/** { key, src } for a page with a hero, else null. stored: the site_settings already read. */
async function heroFor(path, stored, client) {
    let key = PAGE_KEYS[path];
    if (!key && /^\/metal\/[^/]+$/.test(path)) key = 'metal';
    if (!key && /^\/track-order\/[^/]+$/.test(path)) key = 'track';
    if (key) {
        const value = key === 'home' ? stored.hero_image : stored.page_heroes?.[key];
        return { key, src: pictureOf(value) };
    }
    const service = path.match(/^\/service\/([^/]+)$/);
    if (service) {
        const row = (await client.query(
            'SELECT hs.hero_image FROM services s LEFT JOIN hero_sections hs ON hs.service_id = s.id WHERE s.slug = $1 LIMIT 1',
            [decodeURIComponent(service[1])],
        )).rows[0];
        const own = row?.hero_image;
        // The service page draws its own picture as <img src> (jpg/src first), or the Services picture.
        const ownSrc = own ? (typeof own === 'string' ? own : (own.jpg || own.jpeg || own.png || own.src || own.url || own.webp || own.avif || '')) : '';
        if (ownSrc) return { key: 'service', src: ownSrc, webpSource: typeof own === 'object' && own.webp ? own.webp : '' };
        return { key: 'services', src: pictureOf(stored.page_heroes?.services) };
    }
    return null;
}

const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The HTML to add to <head>: a preload for a saved picture, and the hero note for the app. */
function heroHtml(path, hero) {
    if (!hero) return '';
    const out = [];
    // A <picture> with a WebP <source> loads that file, not the srcset of its <img>.
    const file = hero.webpSource || hero.src;
    if (file) {
        const set = hero.webpSource ? '' : srcSetOf(file);
        out.push(`<link rel="preload" as="image" href="${attr(file)}"${set ? ` imagesrcset="${attr(set)}" imagesizes="100vw"` : ''} fetchpriority="high">`);
    }
    const note = JSON.stringify({ path, key: hero.key, src: hero.src || '' }).replace(/</g, '\\u003c');
    out.push(`<script>window.__DMS_HERO__=${note}</script>`);
    return out.join('\n  ');
}

module.exports = { heroFor, heroHtml };
