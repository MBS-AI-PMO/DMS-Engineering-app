import { Maximize2 } from 'lucide-react';
import { Card, Field, FieldRow, Input, Segmented } from '../../../components/admin/ui';
import { LIMIT_FIELDS } from './serviceForm';

const UNITS = [{ value: 'in', label: 'Inches' }, { value: 'mm', label: 'mm' }];

/** The smallest and largest part a production service handles. Switching unit converts the values. */
export default function ServiceLimitsCard({ service, onChange, onUnitChange }) {
    const unit = service.dimensions_unit || 'in';
    return (
        <Card
            title="Part size limits"
            icon={Maximize2}
            subtitle="Parts outside these sizes cannot be quoted for this service."
            actions={<Segmented label="Unit" items={UNITS} value={unit} onChange={onUnitChange} />}
        >
            {LIMIT_FIELDS.map(dim => (
                <FieldRow key={dim.label}>
                    <Field label={`${dim.label} min (${unit})`}>
                        <Input type="number" step="0.0001" min="0" value={service[dim.min] ?? ''} onChange={e => onChange(dim.min, e.target.value)} />
                    </Field>
                    <Field label={`${dim.label} max (${unit})`}>
                        <Input type="number" step="0.0001" min="0" value={service[dim.max] ?? ''} onChange={e => onChange(dim.max, e.target.value)} />
                    </Field>
                </FieldRow>
            ))}
        </Card>
    );
}
