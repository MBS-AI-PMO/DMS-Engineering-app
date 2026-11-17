import { useState } from 'react';
import { Button, Field, FieldRow, Input, Modal } from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { legalService } from '../../../services/admin/legal';
import ListEditor from '../content/ListEditor';
import { newKey } from '../content/list';
import IconPicker from './IconPicker';
import LegalSectionPreview from './LegalSectionPreview';
import { DOCUMENTS } from './legalText';

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const LIST_HINT = 'Start a line with "-" for a bullet or "1." for a numbered list. A blank line starts a new paragraph.';

/**
 * Add or edit one section of the privacy policy or terms, with a preview
 * of how the public page shows it. section: the row, or null for a new one
 * (then defaults.serial_number is suggested).
 */
export default function LegalSectionForm({ type, section, defaults, onClose, onSaved }) {
    const toast = useToast();
    const isNew = !section;
    const [form, setForm] = useState(() => ({
        serial_number: section?.serial_number || defaults.serial_number || '',
        heading: section?.heading || '',
        icon: section?.icon || 'FileText',
        color: section?.color || '#6366f1',
        paragraphs: (Array.isArray(section?.content) && section.content.length ? section.content : ['']).map(text => ({ key: newKey('p'), text: String(text ?? '') })),
    }));
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const set = (patch) => setForm(f => ({ ...f, ...patch }));

    const submit = async (e) => {
        e.preventDefault();
        const found = {};
        if (!form.serial_number.trim()) found.serial_number = 'Add a number, e.g. 01.';
        if (!form.heading.trim()) found.heading = 'Add a heading.';
        if (!HEX_RE.test(form.color.trim())) found.color = 'Use a hex colour such as #6366f1.';
        setErrors(found);
        if (Object.keys(found).length) return;

        setSaving(true);
        try {
            const saved = await legalService.save({
                id: section?.id,
                type,
                serial_number: form.serial_number.trim(),
                heading: form.heading.trim(),
                icon: form.icon,
                color: form.color.trim(),
                content: form.paragraphs.map(p => p.text.trim()).filter(Boolean),
                display_order: section?.display_order ?? 0,
            });
            toast(isNew ? 'Section added' : 'Section saved', 'success');
            onSaved(saved);
        } catch (err) {
            toast(err.message, 'error');
            setSaving(false);
        }
    };

    return (
        <Modal
            title={isNew ? 'Add section' : 'Edit section'}
            subtitle={`${DOCUMENTS[type].label} · shown at ${DOCUMENTS[type].path}`}
            size="xl"
            onClose={onClose}
            closeOnBackdrop={false}
            footer={(
                <>
                    <Button onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button variant="primary" type="submit" form="legal-section-form" loading={saving}>{isNew ? 'Add section' : 'Save section'}</Button>
                </>
            )}
        >
            <div className="ac-lg-editor">
                <form id="legal-section-form" className="ac-lg-form" onSubmit={submit} noValidate>
                    <FieldRow>
                        <Field label="Number" error={errors.serial_number} className="ac-lg-serial">
                            <Input value={form.serial_number} onChange={e => set({ serial_number: e.target.value })} maxLength={20} invalid={!!errors.serial_number} placeholder="01" />
                        </Field>
                        <Field label="Heading" hint="Sections are listed in number order." error={errors.heading}>
                            <Input value={form.heading} onChange={e => set({ heading: e.target.value })} maxLength={255} invalid={!!errors.heading} placeholder="Information we collect" />
                        </Field>
                    </FieldRow>

                    <Field as="div" label="Paragraphs" hint={LIST_HINT}>
                        <ListEditor
                            items={form.paragraphs}
                            onChange={paragraphs => set({ paragraphs })}
                            multiline
                            rows={4}
                            itemLabel="paragraph"
                            placeholder="Write the text of this paragraph…"
                            emptyText="No text yet."
                        />
                    </Field>

                    <Field as="div" label="Icon">
                        <IconPicker value={form.icon} onChange={icon => set({ icon })} />
                    </Field>

                    <Field as="div" label="Theme colour" optional hint="Not shown on the public pages since their redesign (they use the site's red). Kept for older layouts." error={errors.color}>
                        <span className="ac-lg-color">
                            <input type="color" value={HEX_RE.test(form.color) && form.color.length === 7 ? form.color : '#6366f1'} onChange={e => set({ color: e.target.value })} aria-label="Pick a theme colour" />
                            <Input value={form.color} onChange={e => set({ color: e.target.value })} maxLength={9} invalid={!!errors.color} className="ak-mono" aria-label="Theme colour hex value" />
                        </span>
                    </Field>
                </form>

                <aside className="ac-lg-preview-col">
                    <p className="ac-lg-preview-label">Preview</p>
                    <LegalSectionPreview serial={form.serial_number.trim()} heading={form.heading.trim()} icon={form.icon} paragraphs={form.paragraphs.map(p => p.text)} />
                </aside>
            </div>
        </Modal>
    );
}
