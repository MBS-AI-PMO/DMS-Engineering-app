import { Search, X } from 'lucide-react';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/**
 * Pill tabs (filters). items: [{ value, label, count?, icon?, dot? (tone) }].
 * onChange(value).
 */
export function Tabs({ items, value, onChange, label = 'Filter' }) {
    return (
        <div className="ak-tabs" role="group" aria-label={label}>
            {items.map(item => {
                const Icon = item.icon;
                const active = item.value === value;
                return (
                    <button key={item.value} type="button" className={cx('ak-tab', active && 'is-active', item.dot && `is-${item.dot}`)} aria-pressed={active} onClick={() => onChange(item.value)}>
                        {item.dot && <span className="ak-dot" aria-hidden="true" />}
                        {Icon && <Icon size={14} aria-hidden="true" />}
                        {item.label}
                        {item.count !== undefined && <span className="ak-tab-count">{item.count}</span>}
                    </button>
                );
            })}
        </div>
    );
}

/** A segmented switch between views; same items shape as Tabs. */
export function Segmented({ items, value, onChange, label = 'View' }) {
    return (
        <div className="ak-seg" role="tablist" aria-label={label}>
            {items.map(item => {
                const Icon = item.icon;
                const active = item.value === value;
                return (
                    <button key={item.value} type="button" role="tab" aria-selected={active} className={active ? 'is-active' : ''} onClick={() => onChange(item.value)}>
                        {Icon && <Icon size={14} aria-hidden="true" />}
                        {item.label}
                        {item.count !== undefined && <span className="ak-tab-count">{item.count}</span>}
                    </button>
                );
            })}
        </div>
    );
}

/** Search box; onChange(text). block: full width, on its own row. */
export function SearchInput({ value, onChange, placeholder = 'Search…', label = 'Search', className, block = false }) {
    return (
        <label className={cx('ak-search', block && 'is-block', className)}>
            <Search size={16} aria-hidden="true" />
            <input type="search" value={value} placeholder={placeholder} aria-label={label} onChange={e => onChange(e.target.value)} />
            {value && (
                <button type="button" className="ak-icon-btn is-xs" onClick={() => onChange('')} aria-label="Clear search"><X size={13} /></button>
            )}
        </label>
    );
}

/** The bar above a list: filters on the left, tools on the right. */
export function Toolbar({ left, right, children }) {
    return (
        <div className="ak-toolbar">
            {left !== undefined ? <div className="ak-toolbar-group">{left}</div> : null}
            {right !== undefined ? <div className="ak-toolbar-group">{right}</div> : null}
            {children}
        </div>
    );
}
