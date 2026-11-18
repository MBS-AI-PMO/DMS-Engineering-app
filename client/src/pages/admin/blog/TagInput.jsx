import { useId, useState } from 'react';
import { X } from 'lucide-react';

/**
 * Tags as removable chips with a text box: Enter or a comma adds what is
 * typed, Backspace in an empty box removes the last one. suggestions:
 * tags already used (offered as the box's list). value: [string];
 * onChange(tags). Generic enough for the kit.
 */
export default function TagInput({ value, onChange, suggestions = [], max = 12, placeholder = 'Add a tag', label = 'Tags' }) {
    const [text, setText] = useState('');
    const listId = useId();
    const has = (tag) => value.some(t => t.toLowerCase() === tag.toLowerCase());

    const add = (raw) => {
        const parts = String(raw).split(',').map(t => t.replace(/\s+/g, ' ').trim().slice(0, 40)).filter(Boolean);
        const next = [...value];
        parts.forEach(tag => { if (next.length < max && !next.some(t => t.toLowerCase() === tag.toLowerCase())) next.push(tag); });
        if (next.length !== value.length) onChange(next);
        setText('');
    };
    const remove = (tag) => onChange(value.filter(t => t !== tag));

    const onKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            if (text.trim()) add(text);
        } else if (e.key === 'Backspace' && !text && value.length) {
            remove(value[value.length - 1]);
        }
    };

    const offered = suggestions.filter(s => !has(s));
    const full = value.length >= max;

    return (
        <div className="be-tags">
            {value.length > 0 && (
                <ul className="be-tag-list" aria-label={label}>
                    {value.map(tag => (
                        <li key={tag} className="be-tag">
                            {tag}
                            <button type="button" onClick={() => remove(tag)} aria-label={`Remove tag ${tag}`}><X size={12} aria-hidden="true" /></button>
                        </li>
                    ))}
                </ul>
            )}
            <input
                className="ak-input"
                value={text}
                onChange={e => (e.target.value.includes(',') ? add(e.target.value) : setText(e.target.value))}
                onKeyDown={onKeyDown}
                onBlur={() => { if (text.trim()) add(text); }}
                placeholder={full ? `Up to ${max} tags` : placeholder}
                disabled={full}
                list={offered.length ? listId : undefined}
                aria-label={label}
                maxLength={40}
            />
            {offered.length > 0 && (
                <datalist id={listId}>
                    {offered.slice(0, 50).map(s => <option key={s} value={s} />)}
                </datalist>
            )}
        </div>
    );
}
