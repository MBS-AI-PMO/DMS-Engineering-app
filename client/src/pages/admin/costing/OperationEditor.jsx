import { useEffect, useState } from 'react';
import { Save, Trash2, Undo2 } from 'lucide-react';
import { Button, Card, Field, FieldRow, FormActions, Input, Pill, Select, Switch } from '../../../components/admin/ui';
import { BUCKETS, UNIT_LABEL } from './costingFormat';

const fieldsOf = (op) => ({ ...op, variables: { ...(op.variables || {}) } });
// Inputs hold text, the server sends numbers: compare both as text.
const norm = (o) => JSON.stringify(o, (k, v) => (typeof v === 'number' ? String(v) : v));
const changed = (a, b) => norm(a) !== norm(b);

/**
 * One operation's settings and values (rates, times, buffers, $ per bend…).
 * The value fields come from the operation's type, so the form always
 * matches the maths in backend/costing/engine/ops.js.
 * onSave(draft) and onDelete() resolve true when done.
 */
export default function OperationEditor({ operation, type, usedBy, onSave, onDelete, onDirtyChange }) {
    const [draft, setDraft] = useState(() => fieldsOf(operation));
    const [saving, setSaving] = useState(false);
    const dirty = changed(draft, fieldsOf(operation));

    useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
    useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

    const set = (key, value) => setDraft(d => ({ ...d, [key]: value }));
    const setVar = (key, value) => setDraft(d => ({ ...d, variables: { ...d.variables, [key]: value } }));

    const save = async () => {
        setSaving(true);
        try { await onSave(draft); } finally { setSaving(false); }
    };

    const actions = (
        <>
            {dirty && <Button variant="primary" icon={Save} onClick={save} loading={saving}>Save</Button>}
            <Button variant="danger" icon={Trash2} onClick={onDelete} disabled={saving}>Delete</Button>
        </>
    );

    return (
        <Card
            className="ck-op-editor"
            title={(
                <>
                    {operation.name}
                    {!operation.is_active && <Pill tone="gray">Off</Pill>}
                </>
            )}
            subtitle={`${type?.label || operation.op_type}. Used by: ${usedBy.length ? usedBy.join(', ') : 'no service yet (link it on the Services tab)'}.`}
            actions={actions}
        >
            <FieldRow>
                <Field label="Name">
                    <Input value={draft.name} onChange={e => set('name', e.target.value)} />
                </Field>
                <Field label="Shown to customers as" optional>
                    <Input value={draft.customer_label || ''} placeholder={draft.name} onChange={e => set('customer_label', e.target.value)} />
                </Field>
            </FieldRow>
            <FieldRow>
                <Field label="Cost goes to" hint="Decides which markup applies to it.">
                    <Select value={draft.bucket} options={BUCKETS} onChange={e => set('bucket', e.target.value)} />
                </Field>
                <Field label="Order" hint="Lower runs first.">
                    <Input type="number" value={draft.sort_order ?? 0} onChange={e => set('sort_order', e.target.value)} />
                </Field>
            </FieldRow>
            <Switch
                checked={Boolean(draft.is_active)}
                onChange={v => set('is_active', v)}
                label="Active"
                description="An inactive operation is skipped when pricing."
            />

            <hr className="ak-divider" />
            <h3 className="ck-h3">Values</h3>
            {type?.fields.length ? (
                <div className="ck-value-grid">
                    {type.fields.map(field => (
                        <Field
                            key={field.key}
                            label={UNIT_LABEL[field.unit] ? `${field.label} (${UNIT_LABEL[field.unit]})` : field.label}
                            hint={field.help}
                        >
                            {field.unit === 'select' ? (
                                <Select
                                    value={draft.variables?.[field.key] ?? field.default}
                                    options={field.options.map(o => ({ value: o, label: o.replace('_', ' ') }))}
                                    onChange={e => setVar(field.key, e.target.value)}
                                />
                            ) : (
                                <Input
                                    type="number"
                                    step="any"
                                    min={field.min ?? 0}
                                    inputMode="decimal"
                                    value={draft.variables?.[field.key] ?? ''}
                                    placeholder={String(field.default)}
                                    onChange={e => setVar(field.key, e.target.value)}
                                />
                            )}
                        </Field>
                    ))}
                </div>
            ) : (
                <p className="ak-hint">This operation takes its prices from the catalog (Hardware list, hole sizes or the service&apos;s own options).</p>
            )}

            {dirty && (
                <FormActions sticky>
                    <span className="ck-unsaved">Unsaved changes to {operation.name}</span>
                    <Button icon={Undo2} onClick={() => setDraft(fieldsOf(operation))} disabled={saving}>Discard</Button>
                    <Button variant="primary" icon={Save} onClick={save} loading={saving}>Save</Button>
                </FormActions>
            )}
        </Card>
    );
}
