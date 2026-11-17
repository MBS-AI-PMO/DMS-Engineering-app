import { Link } from 'react-router-dom';
import { Skeleton } from './Feedback';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/** A row of StatCards. */
export function StatGrid({ children, label }) {
    return <section className="ak-stats" aria-label={label}>{children}</section>;
}

/**
 * A number with a label and icon. The icon is the brand red unless tone
 * (green | amber | blue | cyan | red | violet | gray) says otherwise, e.g.
 * order statuses. to (link) or onClick (filter) make it clickable; active
 * marks the selected filter.
 */
export function StatCard({ icon: Icon, tone, value, label, to, onClick, loading = false, active = false, title }) {
    const body = (
        <>
            {Icon && <span className="ak-stat-icon" aria-hidden="true"><Icon size={22} strokeWidth={1.8} /></span>}
            <span className="ak-stat-body">
                <span className="ak-stat-num">{loading ? <Skeleton width={48} size="lg" /> : value}</span>
                <span className="ak-stat-label">{label}</span>
            </span>
        </>
    );
    const classes = cx('ak-stat', tone && `is-${tone}`, active && 'is-active');
    if (to) return <Link to={to} className={classes} title={title}>{body}</Link>;
    if (onClick) return <button type="button" className={classes} onClick={onClick} aria-pressed={active} title={title}>{body}</button>;
    return <div className={classes} title={title}>{body}</div>;
}
