import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Field, Input, Modal, Select } from '../../../components/admin/ui';
import { bucketLabel } from './costingFormat';

/**
 * Asks for a new operation's name and type. onCreate({ name, op_type })
 * resolves true when it was added (the dialog then closes).
 */
export default function NewOperationDialog({ operationTypes, onCreate, onClose }) {
    const [name, setName] = useState('');
    const [opType, setOpType] = useState('time');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const type = operationTypes[opType];

    const submit = async (e) => {
        e.preventDefault();
        if (!name.trim()) { setError('Give the operation a name.'); return; }
        setBusy(true);
        const done = await onCreate({ name: name.trim(), op_type: opType });
        setBusy(false);
        if (done) onClose();
    };

    return (
        <Modal
            title="New operation"
            subtitle="Set its values next, then link it to a service on the Services tab."
            size="sm"
            onClose={onClose}
            footer={(
                <>
                    <Button onClick={onClose} disabled={busy}>Cancel</Button>
                    <Button variant="primary" icon={Plus} type="submit" form="ck-new-op" loading={busy}>Add operation</Button>
                </>
            )}
        >
            <form id="ck-new-op" onSubmit={submit}>
                <Field label="Name" error={error}>
                    <Input value={name} invalid={Boolean(error)} onChange={e => { setName(e.target.value); setError(''); }} placeholder="e.g. Deburr" />
                </Field>
                <Field label="Type" hint={type ? `Its cost goes to ${bucketLabel(type.defaultBucket).toLowerCase()} unless you change it. ${type.fields.length ? `Values: ${type.fields.map(f => f.label.toLowerCase()).join(', ')}.` : 'Prices come from the catalog.'}` : undefined}>
                    <Select value={opType} onChange={e => setOpType(e.target.value)} options={Object.entries(operationTypes).map(([key, t]) => ({ value: key, label: t.label }))} />
                </Field>
            </form>
        </Modal>
    );
}
