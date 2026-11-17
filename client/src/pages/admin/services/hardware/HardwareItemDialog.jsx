import { useState } from 'react';
import { Ruler } from 'lucide-react';
import { Button, Field, FieldRow, Input, Modal, Segmented, Switch, Textarea } from '../../../../components/admin/ui';
import { MEASURE_KEYS, inToMm, mmToIn, showIn, specFields } from './hardwareSpecs';

const UNITS = [{ value: 'in', label: 'in' }, { value: 'mm', label: 'mm' }];

/* Item -> form: measurements as text in the chosen unit. */
function toForm(item, unit) {
    const form = {
        ...item,
        name: item?.name || '',
        size_spec: item?.size_spec || '',
        price: item?.price ?? '',
        notes: item?.notes || '',
        shank: item?.shank ? String(Number.parseFloat(item.shank)) : '',
        is_active: item ? item.is_active !== false : true,
    };
    MEASURE_KEYS.forEach(k => { form[k] = showIn(item?.[k], unit); });
    return form;
}

/**
 * Add or edit one hardware item of a type. Measurements are typed in the
 * chosen unit and stored in inches. Saved straight away (not with the service).
 */
export default function HardwareItemDialog({ type, item, unit: startUnit, saving, onSave, onClose }) {
    const [unit, setUnit] = useState(startUnit);
    const [form, setForm] = useState(() => toForm(item, startUnit));
    const [touched, setTouched] = useState(false);
    const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
    const fields = specFields(type);
    const nameError = touched && !form.name.trim() ? 'Give the item a name.' : '';

    const switchUnit = (next) => {
        if (next === unit) return;
        setForm(f => {
            const converted = { ...f };
            MEASURE_KEYS.forEach(k => { converted[k] = next === 'mm' ? inToMm(f[k]) : mmToIn(f[k]); });
            return converted;
        });
        setUnit(next);
    };

    const submit = (e) => {
        e.preventDefault();
        setTouched(true);
        if (!form.name.trim()) return;
        const inches = (k) => Number.parseFloat(unit === 'mm' ? mmToIn(form[k]) : form[k]) || null;
        onSave({
            hardware_type_id: type.id,
            name: form.name.trim(),
            size_spec: form.size_spec.trim() || null,
            price: Number.parseFloat(form.price) || 0,
            notes: form.notes.trim() || null,
            is_active: form.is_active,
            length: inches('length'),
            min_edge_distance: inches('min_edge_distance'),
            tooling_diameter: inches('tooling_diameter'),
            base_width: inches('base_width'),
            shank: Number.parseFloat(form.shank) || null,
            max_hole_diameter: inches('max_hole_diameter'),
            is_wrinkled: form.is_wrinkled ?? false,
        });
    };

    return (
        <Modal
            title={item ? `Edit ${item.name}` : `Add ${type.name.toLowerCase()}`}
            subtitle={`${type.name} · measurements are stored in inches`}
            size="lg"
            onClose={onClose}
            closeOnBackdrop={false}
            footer={(
                <>
                    <Button onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button variant="primary" type="submit" form="hw-item-form" loading={saving}>{item ? 'Save item' : 'Add item'}</Button>
                </>
            )}
        >
            <form id="hw-item-form" onSubmit={submit} noValidate>
                <Field label="Name" error={nameError}>
                    <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. M4 x 10mm Flush Stud" invalid={Boolean(nameError)} autoFocus />
                </Field>
                <FieldRow>
                    <Field label="Size / thread" optional>
                        <Input value={form.size_spec} onChange={e => set('size_spec', e.target.value)} placeholder="e.g. M4, 1/4-20" />
                    </Field>
                    <Field label="Unit price ($)">
                        <Input type="number" step="0.0001" min="0" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.0000" />
                    </Field>
                </FieldRow>

                <div className="cat-inline">
                    <h3 className="cat-section-title"><Ruler size={15} aria-hidden="true" /> Measurements</h3>
                    <Segmented label="Unit" items={UNITS} value={unit} onChange={switchUnit} />
                </div>
                <FieldRow>
                    {fields.map(f => (
                        <Field key={f.key} label={f.inches ? `${f.label} (${unit})` : f.label} hint={f.hint} optional={f.key === 'max_hole_diameter'}>
                            <Input
                                type="number"
                                inputMode="decimal"
                                step={f.step || (unit === 'mm' ? '0.01' : '0.001')}
                                min="0"
                                value={form[f.key]}
                                onChange={e => set(f.key, e.target.value)}
                                placeholder={f.placeholder || (unit === 'mm' ? '0.00' : '.000')}
                            />
                        </Field>
                    ))}
                </FieldRow>

                <Field label="Notes" optional>
                    <Textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Engineering or usage notes…" />
                </Field>
                <Switch label="Active" description="Customers can choose it in the quote flow." checked={form.is_active} onChange={v => set('is_active', v)} />
            </form>
        </Modal>
    );
}
