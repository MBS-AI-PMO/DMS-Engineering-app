import { Check } from 'lucide-react';

/**
 * Pick several: a grid of checkbox chips. (Candidate for the admin kit.)
 * options: [{ value, label, sub? }]; selected: values that are on;
 * onToggle(value, on). compact: wrap in a row instead of a grid.
 */
export default function ChoiceChips({ options, selected = [], onToggle, label, empty = 'Nothing to choose from.', compact = false, disabled = false }) {
    if (!options.length) return <p className="cat-rows-empty">{empty}</p>;
    const isOn = (value) => selected.some(v => String(v) === String(value));
    return (
        <div className={`cat-chips${compact ? ' is-compact' : ''}`} role="group" aria-label={label}>
            {options.map(o => {
                const on = isOn(o.value);
                return (
                    <label key={o.value} className={`cat-chip${on ? ' is-on' : ''}${disabled ? ' is-disabled' : ''}`}>
                        <input type="checkbox" checked={on} disabled={disabled} onChange={e => onToggle(o.value, e.target.checked)} />
                        <span className="cat-chip-box" aria-hidden="true">{on && <Check size={13} strokeWidth={3} />}</span>
                        <span>{o.label}</span>
                        {o.sub && <span className="cat-chip-sub">{o.sub}</span>}
                    </label>
                );
            })}
        </div>
    );
}
