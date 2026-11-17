import { FileText } from 'lucide-react';
import { Card, Field, FieldRow, Input, Select, Textarea } from '../../../components/admin/ui';

/** Name, category, the thickness summary line, sort order and description. */
export default function MetalDetailsCard({ metal, categories, onChange, nameError }) {
    return (
        <Card title="Details" icon={FileText}>
            <Field label="Name" error={nameError} hint={!nameError ? 'The web address follows the name, e.g. /metal/5052-h32-aluminum.' : undefined}>
                <Input value={metal.name} onChange={e => onChange('name', e.target.value)} placeholder="e.g. 5052 H32 Aluminum" invalid={Boolean(nameError)} autoFocus={!metal.id} />
            </Field>
            <FieldRow>
                <Field label="Category">
                    <Select
                        value={metal.category_id ?? ''}
                        onChange={e => onChange('category_id', e.target.value)}
                        placeholder="No category"
                        options={categories.map(c => ({ value: c.id, label: c.name }))}
                    />
                </Field>
                <Field label="Sort order" hint="Lower numbers are listed first.">
                    <Input type="number" step="1" value={metal.display_order} onChange={e => onChange('display_order', e.target.value)} />
                </Field>
            </FieldRow>
            <Field label="Thickness summary" optional hint={'Shown on metal cards, e.g. 7 thicknesses: 0.030" - 0.125". The thickness buttons themselves are under Quick look.'}>
                <Input value={metal.thickness} onChange={e => onChange('thickness', e.target.value)} placeholder={'e.g. 7 thicknesses: 0.030" - 0.125"'} />
            </Field>
            <Field label="Description" optional>
                <Textarea rows={3} value={metal.description} onChange={e => onChange('description', e.target.value)} placeholder="One or two sentences customers see first." />
            </Field>
        </Card>
    );
}
