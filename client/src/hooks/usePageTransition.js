import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// The address shown last, across every shell (public site and admin), so the
// first page of a visit draws without animation and every later page fades in.
let shownPath = null;

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * Fades the page content in, rising a few pixels, whenever the address
 * (pathname) changes. Attach the returned ref to the element that holds the
 * page; `following: true` also fades the elements after it (the page FAQs and
 * the footer after <main>). Navbars and sidebars stay still.
 *
 * Runs with the Web Animations API, so nothing is re-mounted and no wrapper is
 * added. React Router 7 switches pages in a transition (the old page stays
 * until the new one's code has loaded), so the fade starts on the new page,
 * not on a blank loading screen. Off for people who ask for reduced motion.
 */
export default function usePageTransition({ following = false, distance = 10, duration = 360 } = {}) {
    const ref = useRef(null);
    const { pathname } = useLocation();

    useLayoutEffect(() => {
        const firstOfVisit = shownPath === null;
        shownPath = pathname;
        const el = ref.current;
        if (firstOfVisit || !el || typeof el.animate !== 'function') return undefined;
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

        const targets = [el];
        if (following) {
            for (let next = el.nextElementSibling; next; next = next.nextElementSibling) targets.push(next);
        }
        const frames = [
            { opacity: 0, transform: `translateY(${distance}px)` },
            { opacity: 1, transform: 'none' },
        ];
        const animations = targets.map((target, i) => target.animate(frames, {
            duration,
            delay: i ? 40 : 0,
            easing: EASE,
            fill: 'backwards',
        }));
        return () => animations.forEach(a => a.cancel());
    }, [pathname, following, distance, duration]);

    return ref;
}
