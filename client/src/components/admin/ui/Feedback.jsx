import { Loader2 } from 'lucide-react';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/**
 * A small coloured label. tone: green | amber | blue | cyan | red | violet | gray.
 * dot adds the round marker.
 */
export function Pill({ tone = 'gray', dot = false, children, className, title }) {
    return (
        <span className={cx('ak-pill', `is-${tone}`, className)} title={title}>
            {dot && <span className="ak-dot" aria-hidden="true" />}
            {children}
        </span>
    );
}

/** A person or item initial in a red tile (customers, admins…). */
export function Avatar({ name, size, title }) {
    const initial = String(name || '?').trim().charAt(0).toUpperCase() || '?';
    return <span className={cx('ak-avatar', size === 'lg' && 'is-lg')} aria-hidden="true" title={title}>{initial}</span>;
}

/** Nothing to show (or a problem): icon, title, text and an action. */
export function EmptyState({ icon: Icon, title, children, action }) {
    return (
        <div className="ak-empty">
            {Icon && <span className="ak-empty-icon" aria-hidden="true"><Icon size={22} /></span>}
            {title && <p className="ak-empty-title">{title}</p>}
            {children && <p>{children}</p>}
            {action}
        </div>
    );
}

/** A full-width note. tone: info | warn | error | success. */
export function Banner({ tone = 'info', children, action, role }) {
    return (
        <div className={cx('ak-banner', tone !== 'info' && `is-${tone}`)} role={role || (tone === 'error' ? 'alert' : 'status')}>
            <span>{children}</span>
            {action}
        </div>
    );
}

/** A shimmering placeholder line. size: sm | md | lg | pill | block. */
export function Skeleton({ width = '100%', size = 'md', className }) {
    return <span className={cx('shimmer ak-sk', size !== 'md' && `is-${size}`, className)} style={{ width }} aria-hidden="true" />;
}

/** Placeholder rows for a table while it loads. columns: a count, or the
 * class name of each cell (so cells hidden on small screens stay hidden). */
export function SkeletonRows({ rows = 5, columns = 4 }) {
    const cells = Array.isArray(columns) ? columns : Array.from({ length: columns }, () => undefined);
    return Array.from({ length: rows }, (_, r) => (
        <tr key={r} aria-hidden="true">
            {cells.map((className, c) => (
                <td key={c} className={className || undefined}><Skeleton width={c === 0 ? '70%' : `${40 + ((r + c) % 3) * 15}%`} /></td>
            ))}
        </tr>
    ));
}

export function Spinner({ size = 16, label = 'Loading' }) {
    return <Loader2 size={size} className="ak-spin" aria-label={label} role="status" />;
}
