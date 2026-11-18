import { useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { pagePath } from '../../services/pageFaqs';
import { showsOwnFaqs, usePlacedFaqs } from './usePlacedFaqs';

import PageFaqs from './PageFaqs';

/**
 * Where placed FAQs show on every public page: rendered once in the public
 * layout, between the page and the footer. Every page's FAQs load in one
 * request when the first page opens (usePlacedFaqs), so they show at once on
 * later pages. Nothing shows on pages without placed FAQs, or on pages that
 * show them in their own FAQ section.
 */
// One customer's order (/track-order/1042) shows the FAQs of the Track order page.
const faqPageOf = (path) => (/^\/track-order\/[^/]+$/.test(path) ? '/track-order' : path);

export default function PageFaqsSlot() {
    const { pathname } = useLocation();
    const path = faqPageOf(pagePath(pathname));
    const inPage = showsOwnFaqs(path);
    const nearRef = useRef(null);
    const items = usePlacedFaqs(inPage ? null : path, nearRef);

    if (inPage) return null;
    if (!items.length) return <div ref={nearRef} aria-hidden="true" />;
    return <PageFaqs items={items} />;
}
