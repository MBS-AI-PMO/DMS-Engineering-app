import { useState } from 'react';
import { Button, Field, FieldRow, Input, Modal, Textarea } from '../../../../components/admin/ui';

/**
 * Add or edit one option (a tap, a countersink profile). fields: [{ key,
 * label, type?, step?, min?, max?, placeholder?, hint? }]; children(form,
 * set) adds anything custom. Keys the form does not show are kept.
 */
export default function OptionDialog({ title, option, empty, fields, nameLabel, namePlaceholder, notesPlaceholder, saveLabel, onSave, onClose, children }) {
    const [form, setForm] = useState(() => ({ ...empty, ...(option || {}) }));
    const [touched, setTouched] = useState(false);
    const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
    const nameError = touched && !String(form.name || '').trim() ? `${nameLabel} is required.` : '';

    const submit = (e) => {
        e.preventDefault();
        setTouched(true);
        if (!String(form.name || '').trim()) return;
        onSave({ ...form, name: String(form.name).trim() });
    };

    return (
        <Modal
            title={title}
            onClose={onClose}
            footer={(
                <>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button variant="primary" type="submit" form="option-form">{saveLabel}</Button>
                </>
            )}
        >
            <form id="option-form" onSubmit={submit} noValidate>
                <Field label={nameLabel} error={nameError}>
                    <Input value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder={namePlaceholder} invalid={Boolean(nameError)} autoFocus />
                </Field>
                <FieldRow>
                    {fields.map(f => (
                        <Field key={f.key} label={f.label} hint={f.hint}>
                            <Input type="number" inputMode="decimal" step={f.step || '0.0001'} min={f.min} max={f.max} value={form[f.key] ?? ''} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
                        </Field>
                    ))}
                </FieldRow>
                {children?.(form, set)}
                <Field label="Notes" optional>
                    <Textarea rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder={notesPlaceholder} />
                </Field>
            </form>
        </Modal>
    );
}
