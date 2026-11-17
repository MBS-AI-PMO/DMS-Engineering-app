import { useState } from 'react';
import { Button, Field, Input, Modal, Textarea } from '../../../components/admin/ui';

const slugPreview = (name) => name.toLowerCase().trim().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Add or edit a metal category. category: the row being edited, or null for a new one. */
export default function CategoryDialog({ category, saving, onSave, onClose }) {
    const [form, setForm] = useState(() => ({
        name: category?.name || '',
        description: category?.description || '',
        display_order: category?.display_order ?? 0,
    }));
    const [touched, setTouched] = useState(false);
    const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
    const nameError = touched && !form.name.trim() ? 'Give the category a name.' : '';

    const submit = (e) => {
        e.preventDefault();
        setTouched(true);
        if (!form.name.trim()) return;
        onSave({ ...form, name: form.name.trim(), display_order: Number.parseInt(form.display_order, 10) || 0 });
    };

    const slug = slugPreview(form.name);
    return (
        <Modal
            title={category ? `Edit ${category.name}` : 'New category'}
            subtitle="Groups metals on the metals page and in the quote flow."
            onClose={onClose}
            footer={(
                <>
                    <Button onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button variant="primary" type="submit" form="category-form" loading={saving}>{category ? 'Save changes' : 'Add category'}</Button>
                </>
            )}
        >
            <form id="category-form" onSubmit={submit} noValidate>
                <Field label="Name" error={nameError} hint={slug ? `Slug: ${slug}` : 'The slug is made from the name.'}>
                    <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Stainless Steel" invalid={Boolean(nameError)} autoFocus />
                </Field>
                <Field label="Description" optional>
                    <Textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)} />
                </Field>
                <Field label="Sort order" hint="Lower numbers are listed first.">
                    <Input type="number" step="1" value={form.display_order} onChange={e => set('display_order', e.target.value)} />
                </Field>
            </form>
        </Modal>
    );
}
