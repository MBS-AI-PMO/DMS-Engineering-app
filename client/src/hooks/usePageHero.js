import { useEffect, useState } from 'react';
import { fetchSettings, peekSettings } from '../utils/api';
import { imageSrcSet } from '../utils/imageUrl';
import { PAGE_HERO_DEFAULTS, bootHero, customPageHero } from '../utils/pageHeroes';

const pick = (settings, key) => customPageHero(settings, key) || PAGE_HERO_DEFAULTS[key] || '';

/**
 * The hero picture of a public page: the one saved in Admin > Hero sections,
 * else the page's built-in picture. `src` is '' until the settings arrive on
 * the first page of a visit (the hero shows its dark background meanwhile, so
 * the built-in picture never flashes before a replacement); later pages have
 * the settings already and draw at once.
 *
 *   const hero = usePageHero('metals');
 *   {hero.src && <img src={hero.src} srcSet={hero.srcSet} sizes="100vw" … />}
 */
export default function usePageHero(key) {
    const [src, setSrc] = useState(() => {
        const known = peekSettings();
        if (known) return pick(known, key);
        // First page of a visit: the server already said which picture this page has.
        const boot = typeof window !== 'undefined' ? bootHero(window.location.pathname) : null;
        if (boot && boot.key === key) return boot.src || PAGE_HERO_DEFAULTS[key] || '';
        return '';
    });

    useEffect(() => {
        let live = true;
        fetchSettings()
            .then(settings => { if (live) setSrc(pick(settings, key)); })
            .catch(() => { if (live) setSrc(current => current || PAGE_HERO_DEFAULTS[key] || ''); });
        return () => { live = false; };
    }, [key]);

    // Uploads come in sized copies (/uploads/…?w=960), so phones load a small one.
    return { src, srcSet: src ? imageSrcSet(src, 1920) : undefined };
}
