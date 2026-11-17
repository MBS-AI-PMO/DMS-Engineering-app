import { Box, X } from 'lucide-react';
import { Card, IconButton, Select, Skeleton } from '../../../components/admin/ui';
import MoveButtons from '../content/MoveButtons';
import { move } from '../content/list';

/**
 * The "Top metals" column of the site footer: pick metals from the
 * catalogue, order them, remove them. value: [{ name, slug }].
 */
export default function FooterMetalsCard({ value, onChange, metals, loading }) {
    const available = metals.filter(m => m.slug && !value.some(t => t.slug === m.slug));
    const add = (slug) => {
        const metal = metals.find(m => m.slug === slug);
        if (metal) onChange([...value, { name: metal.name, slug: metal.slug }]);
    };
    const known = new Set(metals.map(m => m.slug));

    return (
        <Card title="Footer metals" icon={Box} count={value.length || undefined} subtitle="The “Top metals” column of the site footer, in this order. When empty, the footer shows a default list.">
            {loading ? <><Skeleton size="lg" /><Skeleton size="lg" /></> : (
                <div className="ak-stack is-tight">
                    {value.length > 0 && (
                        <ol className="ac-ct-metals">
                            {value.map((m, i) => (
                                <li key={m.slug} className="ac-ct-metal">
                                    <span className="ac-ct-metal-text">
                                        <span className="ac-ct-metal-num" aria-hidden="true">{i + 1}</span>
                                        <span className="ac-ct-metal-name">{m.name}</span>
                                        {metals.length > 0 && !known.has(m.slug) && <span className="ak-error-text">No longer in the catalogue</span>}
                                    </span>
                                    <span className="ak-row-actions">
                                        <MoveButtons index={i} count={value.length} onMove={(from, to) => onChange(move(value, from, to))} label={m.name} />
                                        <IconButton icon={X} size="xs" variant="danger" label={`Remove ${m.name}`} onClick={() => onChange(value.filter(t => t.slug !== m.slug))} />
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}
                    <Select
                        value=""
                        aria-label="Add a metal to the footer"
                        onChange={e => add(e.target.value)}
                        disabled={available.length === 0}
                        placeholder={metals.length === 0 ? 'No metals to add' : available.length ? '+ Add a metal…' : 'Every metal is already listed'}
                        options={available.map(m => ({ value: m.slug, label: m.name }))}
                    />
                </div>
            )}
        </Card>
    );
}
