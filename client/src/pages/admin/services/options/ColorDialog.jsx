import { useState } from 'react';
import { Banner, Button, Field, FieldRow, Input, Modal, Switch } from '../../../../components/admin/ui';
import { wrinkleSwatchStyle } from '../../../../utils/wrinkleTexture';

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Add or edit one colour. Powder coating colours have gloss and a wrinkle
 * finish and no upcharge (priced in Admin > Costing); anodizing colours
 * have an upcharge. Keys the form does not show are kept.
 */
export default function ColorDialog({ color, powder, onSave, onClose }) {
    const [form, setForm] = useState(() => ({ name: '', color: '#000000', price: 0, gloss: 50, is_wrinkled: false, ...(color || {}) }));
    const [touched, setTouched] = useState(false);
    const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
    const nameError = touched && !String(form.name || '').trim() ? 'Give the colour a name.' : '';

    const submit = (e) => {
        e.preventDefault();
        setTouched(true);
        if (!String(form.name || '').trim()) return;
        onSave({ ...form, name: form.name.trim() });
    };

    return (
        <Modal
            title={color ? `Edit ${color.name || 'colour'}` : 'Add colour'}
            size="sm"
            onClose={onClose}
            footer={(
                <>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button variant="primary" type="submit" form="color-form">{color ? 'Save colour' : 'Add colour'}</Button>
                </>
            )}
        >
            <form id="color-form" onSubmit={submit} noValidate>
                <Field as="div" label="Colour">
                    <div className="cat-inline">
                        <label className="cat-swatch is-lg cat-color-input" style={wrinkleSwatchStyle(HEX.test(form.color) ? form.color : '#000000', powder && !!form.is_wrinkled, 10)}>
                            <span className="ak-sr">Pick a colour</span>
                            <input type="color" value={HEX.test(form.color) ? form.color : '#000000'} onChange={e => set('color', e.target.value)} />
                        </label>
                        <Input className="ak-mono" value={form.color || ''} onChange={e => set('color', e.target.value)} placeholder="#000000" aria-label="Hex colour" invalid={Boolean(form.color) && !HEX.test(form.color)} />
                    </div>
                </Field>
                <Field label="Name" error={nameError}>
                    <Input value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="e.g. Matte Black" invalid={Boolean(nameError)} autoFocus />
                </Field>
                {powder ? (
                    <>
                        <FieldRow>
                            <Field label="Gloss (%)">
                                <Input type="number" min="0" max="100" value={form.gloss ?? 50} onChange={e => set('gloss', Number.parseInt(e.target.value, 10) || 0)} />
                            </Field>
                            <Field as="div" label="Finish">
                                <Switch label="Wrinkle finish" checked={!!form.is_wrinkled} onChange={v => set('is_wrinkled', v)} />
                            </Field>
                        </FieldRow>
                        <Banner>Powder coating is priced in Admin › Costing (batches and oven size), so colours have no upcharge here.</Banner>
                    </>
                ) : (
                    <Field label="Upcharge ($)" hint="Added per order for this colour. 0 for none.">
                        <Input type="number" step="0.01" min="0" value={form.price ?? 0} onChange={e => set('price', Number.parseFloat(e.target.value) || 0)} />
                    </Field>
                )}
            </form>
        </Modal>
    );
}
