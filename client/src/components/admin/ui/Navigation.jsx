import { useEffect, useRef } from 'react';
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

/**
 * Section tabs across the top of a page with several sections (Costing):
 * icon + label, a red line under the open one, optional count and a warning
 * badge. Scrolls sideways on narrow screens, keeping the open tab in view.
 * items: [{ value, label, icon?, count?, alert? (short text, shown amber) }]. onChange(value).
 */
export function PageTabs({ items, value, onChange, label = 'Sections' }) {
    const listRef = useRef(null);
    useEffect(() => {
        const list = listRef.current;
        const tab = list?.querySelector('[aria-selected="true"]');
        if (!list || !tab) return;
        const left = tab.offsetLeft - list.offsetLeft;
        if (left < list.scrollLeft || left + tab.offsetWidth > list.scrollLeft + list.clientWidth) {
            list.scrollTo({ left: Math.max(0, left - 24), behavior: 'smooth' });
        }
    }, [value]);
    return (
        <nav className="ak-pagetabs" aria-label={label}>
            <div className="ak-pagetabs-list" role="tablist" aria-label={label} ref={listRef}>
                {items.map(item => {
                    const Icon = item.icon;
                    const active = item.value === value;
                    return (
                        <button
                            key={item.value}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            className={cx('ak-pagetab', active && 'is-active')}
                            onClick={() => onChange(item.value)}
                            title={item.alert || undefined}
                        >
                            {Icon && <span className="ak-pagetab-icon"><Icon size={15} aria-hidden="true" /></span>}
                            <span className="ak-pagetab-label">{item.label}</span>
                            {item.alert
                                ? <span className="ak-pagetab-alert">{item.alert}</span>
                                : item.count !== undefined && item.count !== null && <span className="ak-pagetab-count">{item.count}</span>}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
