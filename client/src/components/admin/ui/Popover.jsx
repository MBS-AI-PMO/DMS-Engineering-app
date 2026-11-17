import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const cx = (...parts) => parts.filter(Boolean).join(' ');

function PopoverPanel({ anchorRef, onClose, children, align, width, className, role, id, label }) {
    const panelRef = useRef(null);

    // Positions the panel straight on the DOM (no re-render): below the
    // anchor, or above it when there is no room, kept inside the window.
    const place = useCallback(() => {
        const anchor = anchorRef.current;
        const panel = panelRef.current;
        if (!anchor || !panel) return;
        const r = anchor.getBoundingClientRect();
        const h = panel.offsetHeight;
        const w = panel.offsetWidth;
        const below = window.innerHeight - r.bottom;
        const up = below < h + 12 && r.top > below;
        const left = Math.max(8, Math.min(align === 'end' ? r.right - w : r.left, window.innerWidth - w - 8));
        panel.style.left = `${left}px`;
        panel.style.top = up ? 'auto' : `${r.bottom + 6}px`;
        panel.style.bottom = up ? `${window.innerHeight - r.top + 6}px` : 'auto';
        panel.style.visibility = 'visible';
    }, [anchorRef, align]);

    useLayoutEffect(() => { place(); }, [place, children]);

    useEffect(() => {
        const onDown = (e) => {
            if (anchorRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
            onClose();
        };
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            onClose();
            anchorRef.current?.focus?.();
        };
        const onScroll = (e) => { if (!panelRef.current?.contains(e.target)) place(); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey, true);
        window.addEventListener('resize', place);
        window.addEventListener('scroll', onScroll, true);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey, true);
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', onScroll, true);
        };
    }, [onClose, place, anchorRef]);

    return createPortal(
        <div
            ref={panelRef}
            id={id}
            role={role}
            aria-label={label}
            className={cx('ak-popover', className)}
            // Hidden until placed so it never flashes in the wrong spot.
            style={{ width, left: -9999, top: 0, visibility: 'hidden' }}
            onClick={e => e.stopPropagation()}
        >
            {children}
        </div>,
        document.body,
    );
}

/**
 * A floating panel (menu, small form) anchored to a button. It is rendered
 * at the end of <body>, so tables and cards with overflow never clip it,
 * and it flips above the button when there is no room below.
 *
 *   const ref = useRef(null);
 *   <button ref={ref} onClick={() => setOpen(v => !v)} aria-expanded={open}>…</button>
 *   <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} role="menu">…</Popover>
 *
 * align: 'start' (left edges) | 'end' (right edges). width: CSS width.
 * Closes on Escape and on a click outside; follows the anchor on scroll.
 */
export function Popover({ open, align = 'start', ...props }) {
    return open ? <PopoverPanel align={align} {...props} /> : null;
}
