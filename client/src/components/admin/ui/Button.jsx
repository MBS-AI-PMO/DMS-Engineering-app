import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/**
 * variant: 'secondary' (default) | 'primary' | 'dark' | 'danger' | 'ghost'
 * size: 'md' | 'sm'. icon: a lucide icon component. loading shows a spinner
 * and disables it. to (router link) or href (plain link) render an <a>.
 */
export const Button = forwardRef(function Button(
    { variant = 'secondary', size = 'md', block = false, icon: Icon, iconRight: IconRight, loading = false, to, href, className, children, disabled, type = 'button', ...props },
    ref,
) {
    const classes = cx('ak-btn', variant !== 'secondary' && `is-${variant}`, size === 'sm' && 'is-sm', block && 'is-block', className);
    const iconSize = size === 'sm' ? 14 : 15;
    const content = (
        <>
            {loading ? <Loader2 size={iconSize} className="ak-spin" aria-hidden="true" /> : Icon && <Icon size={iconSize} aria-hidden="true" />}
            {children}
            {IconRight && <IconRight size={iconSize} aria-hidden="true" />}
        </>
    );
    if (to) return <Link ref={ref} to={to} className={classes} {...props}>{content}</Link>;
    if (href) return <a ref={ref} href={href} className={classes} {...props}>{content}</a>;
    return <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>{content}</button>;
});

/** A square icon button. label is required (screen readers + tooltip). */
export const IconButton = forwardRef(function IconButton(
    { icon, label, variant, size = 'md', to, href, className, loading = false, disabled, type = 'button', ...props },
    ref,
) {
    const Icon = icon;
    const classes = cx('ak-icon-btn', variant === 'danger' && 'is-danger', size === 'xs' && 'is-xs', className);
    const iconSize = size === 'xs' ? 13 : 16;
    const content = loading ? <Loader2 size={iconSize} className="ak-spin" aria-hidden="true" /> : <Icon size={iconSize} aria-hidden="true" />;
    if (to) return <Link ref={ref} to={to} className={classes} aria-label={label} title={label} {...props}>{content}</Link>;
    if (href) return <a ref={ref} href={href} className={classes} aria-label={label} title={label} {...props}>{content}</a>;
    return <button ref={ref} type={type} className={classes} aria-label={label} title={label} disabled={disabled || loading} {...props}>{content}</button>;
});

/** A row of buttons / icon buttons. */
export function Actions({ children, className }) {
    return <div className={cx('ak-row-actions', className)}>{children}</div>;
}
