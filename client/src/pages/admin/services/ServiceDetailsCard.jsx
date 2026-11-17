import { FileText } from 'lucide-react';
import { Card, Field, Input, Textarea } from '../../../components/admin/ui';

/** Title and description. */
export default function ServiceDetailsCard({ service, onChange, titleError }) {
    return (
        <Card title="Details" icon={FileText}>
            <Field label="Title" error={titleError} hint={!titleError ? 'The web address follows the title, e.g. /service/laser-cutting. Colour, tap, countersink and hardware lists appear for services named that way.' : undefined}>
                <Input value={service.title} onChange={e => onChange('title', e.target.value)} placeholder="e.g. CNC Machining" invalid={Boolean(titleError)} autoFocus={!service.id} />
            </Field>
            <Field label="Description" optional>
                <Textarea rows={4} value={service.description} onChange={e => onChange('description', e.target.value)} placeholder="What this service is and when to use it." />
            </Field>
        </Card>
    );
}
