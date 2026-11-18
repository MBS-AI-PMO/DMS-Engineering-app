import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * "On this page": the post's H2 and H3 headings. Beside the article it
 * stays in view and marks the heading being read with one red marker that
 * slides to it (and the list scrolls itself to keep that heading in view);
 * on narrow screens it is a closed list above the article.
 * headings: [{ id, text, level }].
 */

// A heading counts as "being read" once it is above this share of the window.
const READ_LINE = 0.3;
export default function BlogToc({ headings, compact = false }) {
    const items = useMemo(() => headings.filter(h => h.text && h.level <= 3), [headings]);
    const [active, setActive] = useState('');
    const listRef = useRef(null);
    const markerRef = useRef(null);

    useEffect(() => {
        if (compact || items.length < 2) return undefined;
        let frame = 0;
        const update = () => {
            frame = 0;
            const line = window.innerHeight * READ_LINE;
            let current = items[0].id;
            for (const item of items) {
                const el = document.getElementById(item.id);
                if (el && el.getBoundingClientRect().top <= line) current = item.id;
            }
            // At the very bottom the last sections can never reach the line: mark the last one.
            const doc = document.documentElement;
            if (window.innerHeight + window.scrollY >= doc.scrollHeight - 4) current = items[items.length - 1].id;
            setActive(current);
        };
        const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            if (frame) cancelAnimationFrame(frame);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
        };
    }, [items, compact]);

    // Slide the marker to the active link and keep that link in view inside the list.
    useLayoutEffect(() => {
        const list = listRef.current;
        const marker = markerRef.current;
        const link = list?.querySelector('.bl-toc-link.is-active');
        if (!list || !marker) return;
        if (!link) { marker.style.opacity = '0'; return; }
        // Inset 8px top and bottom, like the link's text.
        const top = link.offsetTop;
        const height = link.offsetHeight;
        marker.style.transform = `translateY(${top + 8}px)`;
        marker.style.height = `${Math.max(0, height - 16)}px`;
        marker.style.opacity = '1';
        if (list.scrollHeight > list.clientHeight + 2) {
            const above = top < list.scrollTop + 8;
            const below = top + height > list.scrollTop + list.clientHeight - 8;
            if (above || below) list.scrollTo({ top: Math.max(0, top - list.clientHeight / 2 + height / 2), behavior: 'smooth' });
        }
    }, [active, items]);

    if (items.length < 2) return null;

    const go = (e, id) => {
        const el = document.getElementById(id);
        if (!el) return;
        e.preventDefault();
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        window.history.replaceState(window.history.state, '', `#${id}`);
        setActive(id);
    };

    const list = (
        <ol className="bl-toc-list" ref={compact ? undefined : listRef}>
            {!compact && <span className="bl-toc-marker" aria-hidden="true" ref={markerRef} />}
            {items.map(item => (
                <li key={item.id} className={item.level === 3 ? 'is-sub' : undefined}>
                    <a
                        href={`#${item.id}`}
                        className={`bl-toc-link${active === item.id ? ' is-active' : ''}`}
                        aria-current={active === item.id ? 'location' : undefined}
                        onClick={(e) => go(e, item.id)}
                    >
                        {item.text}
                    </a>
                </li>
            ))}
        </ol>
    );

    if (compact) {
        return (
            <details className="bl-toc is-compact">
                <summary>
                    On this page <span className="bl-toc-count">{items.length}</span>
                    <ChevronDown size={16} aria-hidden="true" />
                </summary>
                {list}
            </details>
        );
    }
    return (
        <nav className="bl-toc" aria-label="On this page">
            <span className="bl-toc-label">On this page</span>
            {list}
        </nav>
    );
}
