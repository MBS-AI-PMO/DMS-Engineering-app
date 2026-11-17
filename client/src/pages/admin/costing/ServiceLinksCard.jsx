import { useEffect, useState } from 'react';
import { Save, Undo2 } from 'lucide-react';
import { Button, Card, Field, Pill } from '../../../components/admin/ui';
import ChoiceChips from './ChoiceChips';

const sorted = (list) => [...list].sort((a, b) => a - b).join(',');
const sameLinks = (a, b) => ['operations', 'markups', 'addOns'].every(k => sorted(a[k]) === sorted(b[k]));

/**
 * One service: which operations it runs and, for a production method,
 * which markups and add-ons the whole line gets. onSave(links) resolves
 * true when saved.
 */
export default function ServiceLinksCard({ service, saved, operations, markups, addOns, onSave, onDirtyChange }) {
    const [links, setLinks] = useState(saved);
    const [saving, setSaving] = useState(false);
    const dirty = !sameLinks(links, saved);

    useEffect(() => { onDirtyChange(service.id, dirty); }, [service.id, dirty, onDirtyChange]);

    const toggle = (group) => (id) => setLinks(l => ({ ...l, [group]: l[group].includes(id) ? l[group].filter(x => x !== id) : [...l[group], id] }));
    const save = async () => {
        setSaving(true);
        try { await onSave(links); } finally { setSaving(false); }
    };

    const group = (key, title, items) => (
        <Field as="div" label={title}>
            <ChoiceChips label={`${service.title}: ${title}`} items={items} selected={links[key]} onToggle={toggle(key)} disabled={saving} />
        </Field>
    );

    return (
        <Card
            title={(
                <>
                    {service.title}
                    {service.is_active === false && <Pill tone="gray">Inactive</Pill>}
                    {dirty && <Pill tone="amber" dot>Unsaved</Pill>}
                </>
            )}
            subtitle={service.is_production ? 'Production method' : 'Finishing / extra service'}
            actions={dirty ? (
                <>
                    <Button size="sm" icon={Undo2} onClick={() => setLinks(saved)} disabled={saving}>Discard</Button>
                    <Button size="sm" variant="primary" icon={Save} onClick={save} loading={saving}>Save</Button>
                </>
            ) : null}
        >
            {group('operations', 'Operations', operations.map(op => ({ value: op.id, label: op.name, muted: !op.is_active })))}
            {service.is_production && (
                <>
                    {group('markups', 'Markups', markups.map(m => ({ value: m.id, label: `${m.name} ${Number(m.percent)}%`, muted: !m.is_active })))}
                    {group('addOns', 'Add-ons', addOns.map(a => ({
                        value: a.id,
                        label: `${a.name} $${Number(a.amount).toFixed(2)}${a.apply_mode === 'always' ? '' : ' (optional)'}`,
                        muted: !a.is_active,
                    })))}
                </>
            )}
        </Card>
    );
}
