import { useMemo, useState } from 'react';
import { ALL_LEGAL_ICONS } from '../../../constants/legalIcons';
import LegalIcon from '../../../components/LegalIcon';
import { SearchInput } from '../../../components/admin/ui';

const NAMES = Object.keys(ALL_LEGAL_ICONS);
const words = (name) => name.replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase();

/** A searchable grid of the icons the legal pages can show. value / onChange(name). */
export default function IconPicker({ value, onChange }) {
    const [query, setQuery] = useState('');
    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? NAMES.filter(n => words(n).includes(q) || n.toLowerCase().includes(q)) : NAMES;
    }, [query]);
    const known = NAMES.includes(value);

    return (
        <div className="ac-lg-icons">
            <div className="ac-lg-icons-top">
                <span className="ac-lg-icon-current" title={value}>
                    <LegalIcon name={value} size={18} />
                    <span>{known ? words(value) : `${value || 'none'} (not in the list, shows a page icon)`}</span>
                </span>
                <SearchInput value={query} onChange={setQuery} placeholder="Find an icon…" label="Find an icon" className="ac-lg-icon-search" />
            </div>
            <div className="ac-lg-icon-grid" role="group" aria-label="Icons">
                {shown.map(name => (
                    <button
                        key={name}
                        type="button"
                        className={`ac-lg-icon${name === value ? ' is-active' : ''}`}
                        aria-pressed={name === value}
                        aria-label={words(name)}
                        title={words(name)}
                        onClick={() => onChange(name)}
                    >
                        <LegalIcon name={name} size={18} />
                    </button>
                ))}
                {shown.length === 0 && <p className="ak-hint">No icon matches “{query}”.</p>}
            </div>
        </div>
    );
}
