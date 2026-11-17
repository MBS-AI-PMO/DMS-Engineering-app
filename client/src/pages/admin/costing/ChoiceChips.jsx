import { Check } from 'lucide-react';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/**
 * A wrap of toggle chips (checkboxes underneath), for picking several items:
 * items [{ value, label, muted? }], selected (array of values), onToggle(value).
 * label names the group for screen readers. Candidate for the admin kit.
 */
export default function ChoiceChips({ items, selected, onToggle, label, disabled = false, empty = 'Nothing to choose from yet.' }) {
    if (!items.length) return <p className="ak-hint">{empty}</p>;
    return (
        <div className="ck-chips" role="group" aria-label={label}>
            {items.map(item => {
                const on = selected.includes(item.value);
                return (
                    <label key={item.value} className={cx('ck-chip', on && 'is-on', item.muted && 'is-muted')} title={item.title}>
                        <input type="checkbox" checked={on} disabled={disabled} onChange={() => onToggle(item.value)} />
                        {on && <Check size={13} aria-hidden="true" />}
                        {item.label}
                    </label>
                );
            })}
        </div>
    );
}
