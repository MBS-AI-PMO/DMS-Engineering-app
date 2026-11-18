import { useEffect } from 'react';

/*
 * FAQPage structured data (schema.org) for the questions a page shows, so
 * search engines can read them as questions and answers. One FAQPage per
 * page: the block that shows FAQs writes it into <head> while it is on
 * screen and removes it when it goes. Text is set with textContent (never
 * parsed as HTML) and "<" is escaped so no answer can end the script.
 */
const SCRIPT_ID = 'dms-faq-jsonld';
let owner = 0;

const plain = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

export function faqJsonLd(items) {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map(item => ({
            '@type': 'Question',
            name: plain(item.question),
            acceptedAnswer: { '@type': 'Answer', text: plain(item.answer) },
        })),
    };
}

/** items: [{ question, answer }]; nothing is written while it is empty. */
export function useFaqJsonLd(items) {
    const json = items.length ? JSON.stringify(faqJsonLd(items)).replace(/</g, '\\u003c') : '';

    useEffect(() => {
        if (!json || typeof document === 'undefined') return undefined;
        owner += 1;
        const mine = owner;
        let script = document.getElementById(SCRIPT_ID);
        if (!script) {
            script = document.createElement('script');
            script.id = SCRIPT_ID;
            script.type = 'application/ld+json';
            document.head.appendChild(script);
        }
        script.textContent = json;
        return () => {
            // Only the block that wrote it last takes it away.
            if (owner === mine) document.getElementById(SCRIPT_ID)?.remove();
        };
    }, [json]);
}
