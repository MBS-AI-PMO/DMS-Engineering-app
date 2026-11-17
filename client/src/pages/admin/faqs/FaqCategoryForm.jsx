import { useState } from 'react';
import { Button, Field, FieldRow, Input, Modal, Textarea } from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { faqCategoriesService } from '../../../services/admin/faqs';

/* About what the server's slugify makes of a name ("Tolerances & standards" -> "tolerances-and-standards"). */
const toSlug = (text) => String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

/**
 * Add or edit an FAQ category. For a new one the URL name follows the name
 * until it is edited by hand; an existing one keeps its URL name unless it
 * is changed here.
 */
export default function FaqCategoryForm({ category, nextPosition, onClose, onSaved }) {
    const toast = useToast();
    const isNew = !category;
    const [form, setForm] = useState(() => ({
        name: category?.name || '',
        slug: category?.slug || '',
        description: category?.description || '',
        display_order: category ? String(category.display_order ?? '') : '',
    }));
    const [slugTouched, setSlugTouched] = useState(!isNew);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const setName = (e) => {
        const name = e.target.value;
        setForm(f => ({ ...f, name, slug: slugTouched ? f.slug : toSlug(name) }));
    };
    const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        const found = {};
        if (!form.name.trim()) found.name = 'Give the category a name.';
        if (form.slug.trim() && !toSlug(form.slug)) found.slug = 'Use letters, numbers and dashes.';
        if (form.display_order !== '' && !/^\d+$/.test(String(form.display_order).trim())) found.display_order = 'Use a whole number, or leave it empty.';
        setErrors(found);
        if (Object.keys(found).length) return;

        const body = {
            name: form.name.trim(),
            slug: toSlug(form.slug) || toSlug(form.name),
            description: form.description.trim(),
            display_order: form.display_order === '' ? (isNew ? nextPosition : undefined) : Number(form.display_order),
        };
        setSaving(true);
        try {
            const saved = isNew ? await faqCategoriesService.create(body) : await faqCategoriesService.update(category.id, body);
            toast(isNew ? `Category “${saved.name}” added` : 'Category saved', 'success');
            onSaved(saved);
        } catch (err) {
            if (err.status === 409) setErrors({ slug: err.message });
            toast(err.message, 'error');
            setSaving(false);
        }
    };

    return (
        <Modal
            title={isNew ? 'Add category' : 'Edit category'}
            subtitle="Categories group the questions on the FAQ page."
            onClose={onClose}
            footer={(
                <>
                    <Button onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button variant="primary" type="submit" form="faq-category-form" loading={saving}>{isNew ? 'Add category' : 'Save category'}</Button>
                </>
            )}
        >
            <form id="faq-category-form" onSubmit={submit} noValidate>
                <Field label="Name" error={errors.name}>
                    <Input value={form.name} onChange={setName} maxLength={120} invalid={!!errors.name} placeholder="Shipping" />
                </Field>
                <FieldRow>
                    <Field label="URL name" hint="Letters, numbers and dashes. Made from the name if empty." error={errors.slug}>
                        <Input
                            className="ak-mono"
                            value={form.slug}
                            onChange={e => { setSlugTouched(true); set('slug')(e); }}
                            maxLength={120}
                            invalid={!!errors.slug}
                            spellCheck={false}
                            placeholder={toSlug(form.name) || 'shipping'}
                        />
                    </Field>
                    <Field label="Position" optional hint="Lower numbers show first." error={errors.display_order}>
                        <Input type="number" min={0} step={1} inputMode="numeric" value={form.display_order} onChange={set('display_order')} invalid={!!errors.display_order} />
                    </Field>
                </FieldRow>
                <Field label="Description" optional hint="A note for admins. Not shown on the site.">
                    <Textarea value={form.description} onChange={set('description')} rows={3} maxLength={2000} />
                </Field>
            </form>
        </Modal>
    );
}
