import { useState } from 'react';
import { Button, Field, FieldRow, Input, Modal, Select, Switch, Textarea } from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { faqsService } from '../../../services/admin/faqs';
import CharCount from '../content/CharCount';
import PagePicker from './PagePicker';

const samePages = (a, b) => a.length === b.length && a.every(key => b.includes(key));

/**
 * Add or edit one FAQ in a dialog. faq: the row, or null for a new one.
 * nextPosition(categoryId): the position that puts it last in that category
 * (used when Position is left empty). onSaved(row) gets the saved row (with
 * `pages` when they were sent). pages: the page list for "Show on pages"
 * ({ list, loading, error, reload }). "Show on the FAQ page" off makes it a
 * page-only FAQ: shown only on the pages picked, never on the FAQ page.
 * New FAQs started from a page (defaultPages) start page-only.
 */
export default function FaqForm({ faq, categories, defaultCategoryId = '', defaultPages = [], nextPosition, pages, onClose, onSaved }) {
    const toast = useToast();
    const isNew = !faq;
    const initialPages = faq ? faq.pages || [] : defaultPages;
    const [form, setForm] = useState(() => ({
        category_id: faq ? String(faq.category_id ?? '') : defaultCategoryId,
        question: faq?.question || '',
        answer: faq?.answer || '',
        display_order: faq ? String(faq.display_order ?? '') : '',
        pages: initialPages,
        on_faq_page: faq ? faq.show_on_faq_page !== false : defaultPages.length === 0,
    }));
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        const found = {};
        if (!form.question.trim()) found.question = 'Write the question.';
        if (!form.answer.trim()) found.answer = 'Write the answer.';
        if (form.display_order !== '' && !/^\d+$/.test(String(form.display_order).trim())) found.display_order = 'Use a whole number, or leave it empty.';
        if (!form.on_faq_page && !form.pages.length) found.pages = 'Pick at least one page, or show it on the FAQ page. Otherwise it shows nowhere.';
        setErrors(found);
        if (Object.keys(found).length) return;

        const categoryId = form.category_id === '' ? null : Number(form.category_id);
        const movedCategory = !isNew && String(faq.category_id ?? '') !== form.category_id;
        let position = form.display_order === '' ? null : Number(form.display_order);
        if (position === null && (isNew || movedCategory)) position = nextPosition(categoryId);
        const body = { category_id: categoryId, question: form.question.trim(), answer: form.answer.trim(), show_on_faq_page: form.on_faq_page };
        if (position !== null) body.display_order = position;
        // Pages only go along when they changed (or a new FAQ has some).
        if (isNew ? form.pages.length > 0 : !samePages(form.pages, initialPages)) body.pages = form.pages;

        setSaving(true);
        try {
            const saved = isNew ? await faqsService.create(body) : await faqsService.update(faq.id, body);
            toast(isNew ? 'FAQ added' : 'FAQ saved', 'success');
            onSaved({ ...saved, pages: saved.pages || (isNew ? [] : initialPages) });
        } catch (err) {
            toast(err.message, 'error');
            setSaving(false);
        }
    };

    return (
        <Modal
            title={isNew ? 'Add FAQ' : 'Edit FAQ'}
            subtitle="Show it on the FAQ page, on other pages of the site, or both."
            size="lg"
            onClose={onClose}
            footer={(
                <>
                    <Button onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button variant="primary" type="submit" form="faq-form" loading={saving}>{isNew ? 'Add FAQ' : 'Save FAQ'}</Button>
                </>
            )}
        >
            <form id="faq-form" onSubmit={submit} noValidate>
                <Field label={<span className="ac-label-row">Question <CharCount value={form.question} max={120} /></span>} error={errors.question}>
                    <Input value={form.question} onChange={set('question')} maxLength={1000} invalid={!!errors.question} placeholder="How long does an order take?" />
                </Field>
                <Field label="Answer" hint="Plain text. Line breaks are kept." error={errors.answer}>
                    <Textarea value={form.answer} onChange={set('answer')} rows={8} maxLength={20000} invalid={!!errors.answer} />
                </Field>
                <Switch
                    className="ac-faq-switch"
                    label="Show on the FAQ page"
                    description={form.on_faq_page
                        ? 'Listed on the FAQ page under its category.'
                        : 'Page-only: shown only on the pages picked below, never on the FAQ page.'}
                    checked={form.on_faq_page}
                    onChange={on => setForm(f => ({ ...f, on_faq_page: on }))}
                />
                {form.on_faq_page && (
                    <FieldRow>
                        <Field label="Category">
                            <Select value={form.category_id} onChange={set('category_id')} placeholder="No category" options={categories.map(c => ({ value: String(c.id), label: c.name }))} />
                        </Field>
                        <Field label="Position" optional hint="Lower numbers show first. Empty puts it last." error={errors.display_order}>
                            <Input type="number" min={0} step={1} inputMode="numeric" value={form.display_order} onChange={set('display_order')} invalid={!!errors.display_order} />
                        </Field>
                    </FieldRow>
                )}
                <Field
                    as="fieldset"
                    label="Show on pages"
                    optional={form.on_faq_page}
                    hint="On a page it is new to, it goes last. Set the order in “On pages”."
                    error={errors.pages}
                >
                    <PagePicker
                        pages={pages.list}
                        loading={pages.loading}
                        error={pages.error}
                        onRetry={pages.reload}
                        value={form.pages}
                        onChange={keys => setForm(f => ({ ...f, pages: keys }))}
                    />
                </Field>
            </form>
        </Modal>
    );
}
