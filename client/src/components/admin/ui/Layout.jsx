import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/** The page wrapper every admin screen starts with. */
export function Page({ children, className, busy }) {
    return <div className={cx('ak-page', className)} aria-busy={busy || undefined}>{children}</div>;
}

/**
 * The page title panel: an icon tile (pass the lucide icon of the page's
 * menu item), title, one-line description and actions on the right.
 * back: { to, label } shows a link above it. title may include a <Pill>.
 */
export function PageHeader({ title, subtitle, eyebrow, icon, actions, back, children }) {
    const Icon = icon;
    return (
        <>
            {back && (
                <Link to={back.to} className="ak-back"><ArrowLeft size={15} aria-hidden="true" /> {back.label}</Link>
            )}
            <header className="ak-head">
                <div className="ak-head-main">
                    {Icon && <span className="ak-head-icon" aria-hidden="true"><Icon size={22} /></span>}
                    <div className="ak-head-text">
                        {eyebrow && <p className="ak-eyebrow">{eyebrow}</p>}
                        <h1 className="ak-title">{title}</h1>
                        {subtitle && <p className="ak-sub">{subtitle}</p>}
                        {children}
                    </div>
                </div>
                {actions && <div className="ak-head-actions">{actions}</div>}
            </header>
        </>
    );
}

/**
 * A white panel. title + icon + count + actions make its header.
 * flush: no padding (for a table that fills the card).
 */
export function Card({ title, subtitle, icon: Icon, count, actions, flush = false, className, children, as = 'section', id, ...props }) {
    const Tag = as;
    const titleId = id ? `${id}-title` : undefined;
    const hasHead = title || actions;
    return (
        <Tag className={cx('ak-card', flush && 'is-flush', className)} aria-labelledby={title && titleId ? titleId : undefined} id={id} {...props}>
            {hasHead && (
                <div className="ak-card-head">
                    <div>
                        {title && (
                            <h2 className="ak-card-title" id={titleId}>
                                {Icon && <Icon size={16} aria-hidden="true" />}
                                {title}
                                {count !== undefined && count !== null && <span className="ak-count">{count}</span>}
                            </h2>
                        )}
                        {subtitle && <p className="ak-card-sub">{subtitle}</p>}
                    </div>
                    {actions && <div className="ak-row-actions">{actions}</div>}
                </div>
            )}
            {children}
        </Tag>
    );
}

/** Main column + 360px side column (stacks under 1100px). */
export function SideLayout({ main, side }) {
    return (
        <div className="ak-grid-side">
            <div className="ak-stack">{main}</div>
            <aside className="ak-stack">{side}</aside>
        </div>
    );
}

/** Equal columns (2 or 3) that stack on small screens. */
export function Grid({ columns = 2, children, className }) {
    return <div className={cx(columns === 3 ? 'ak-grid-3' : 'ak-grid-2', className)}>{children}</div>;
}

/** Vertical stack with the standard gap. */
export function Stack({ children, className }) {
    return <div className={cx('ak-stack', className)}>{children}</div>;
}

/** Label/value rows: items = [[label, value], …]; empty values are skipped. */
export function KeyValue({ items }) {
    return (
        <dl className="ak-kv">
            {items.filter(([, v]) => v !== undefined && v !== null && v !== '').map(([label, value]) => (
                <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
        </dl>
    );
}
