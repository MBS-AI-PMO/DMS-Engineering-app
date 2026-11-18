import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Checkbox, Field, FieldRow, IconButton, Input, Modal, Segmented, Select, Switch, Textarea } from '../../../components/admin/ui';
import { EXTRA_ATTRS, PAGE_CHOICES, SCRIPT_MODES, TAG_TYPES, fromDraft, newDraft, tagHtml, toDraft, validateDraft } from './headTagsForm';

const RELS = ['icon', 'apple-touch-icon', 'alternate', 'preconnect', 'dns-prefetch', 'preload', 'manifest', 'me', 'author', 'license'];

/**
 * Add or edit one head tag. tag: the tag to edit, or null to add one.
 * onSave(tag) gets the finished tag (the page keeps it until Save).
 */
export default function HeadTagModal({ tag, onSave, onClose }) {
    const [draft, setDraft] = useState(() => (tag ? toDraft(tag) : newDraft('meta')));
    const [tried, setTried] = useState(false);
    const errors = useMemo(() => (tried ? validateDraft(draft) : {}), [tried, draft]);
    const set = (patch) => setDraft(d => ({ ...d, ...patch }));
    const on = (key) => (e) => set({ [key]: e.target.value });
    const html = useMemo(() => tagHtml(fromDraft(draft)), [draft]);
    const typeInfo = TAG_TYPES.find(t => t.value === draft.tag);
    const extraNames = EXTRA_ATTRS[draft.tag];
    const allowsExtra = extraNames.length > 0 || draft.tag === 'script';
    const listId = `ac-seo-attrs-${draft.tag}`;

    const save = () => {
        setTried(true);
        if (Object.keys(validateDraft(draft)).length) return;
        onSave(fromDraft(draft));
    };

    const setExtra = (i, patch) => set({ extra: draft.extra.map((row, n) => (n === i ? { ...row, ...patch } : row)) });
    const chosen = Array.isArray(draft.pages) ? draft.pages : [];
    const togglePage = (key, checked) => set({ pages: checked ? [...chosen, key] : chosen.filter(p => p !== key) });

    return (
        <Modal
            title={tag ? 'Edit head tag' : 'Add a head tag'}
            subtitle="Goes into the <head> of the pages you choose, after the built-in tags."
            size="lg"
            onClose={onClose}
            closeOnBackdrop={false}
            footer={(
                <>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button variant="primary" onClick={save}>{tag ? 'Done' : 'Add tag'}</Button>
                </>
            )}
        >
            <div className="ac-seo-modal">
                <Field as="div" label="Kind of tag" hint={typeInfo?.hint}>
                    <Segmented label="Kind of tag" items={TAG_TYPES} value={draft.tag} onChange={value => set({ tag: value, extra: [] })} />
                </Field>

                {draft.tag === 'meta' && (
                    <>
                        <FieldRow>
                            <Field label="Identified by" hint="Most use name; Open Graph and Facebook tags use property.">
                                <Select value={draft.metaKey} onChange={on('metaKey')} options={[{ value: 'name', label: 'name' }, { value: 'property', label: 'property' }]} />
                            </Field>
                            <Field label={draft.metaKey === 'property' ? 'Property' : 'Name'} error={errors.metaName}>
                                <Input value={draft.metaName} onChange={on('metaName')} maxLength={100} placeholder={draft.metaKey === 'property' ? 'fb:app_id' : 'msvalidate.01'} invalid={!!errors.metaName} spellCheck={false} className="ak-mono" />
                            </Field>
                        </FieldRow>
                        <Field label="Content" error={errors.metaContent} hint="A tag with the same name as a built-in one (description, robots…) replaces it on these pages.">
                            <Input value={draft.metaContent} onChange={on('metaContent')} maxLength={2000} placeholder="The value you were given" invalid={!!errors.metaContent} spellCheck={false} />
                        </Field>
                    </>
                )}

                {draft.tag === 'link' && (
                    <FieldRow>
                        <Field label="Rel" error={errors.rel} hint="icon, alternate, preconnect…">
                            <Input value={draft.rel} onChange={on('rel')} maxLength={80} placeholder="alternate" list="ac-seo-rels" invalid={!!errors.rel} spellCheck={false} className="ak-mono" />
                            <datalist id="ac-seo-rels">{RELS.map(r => <option key={r} value={r} />)}</datalist>
                        </Field>
                        <Field label="Address (href)" error={errors.href} hint="https://… or a path on this site such as /favicon-32.png">
                            <Input value={draft.href} onChange={on('href')} maxLength={2000} placeholder="https://…" invalid={!!errors.href} spellCheck={false} />
                        </Field>
                    </FieldRow>
                )}

                {draft.tag === 'script' && (
                    <>
                        <Field as="div" label="Script">
                            <Segmented label="Script" items={SCRIPT_MODES} value={draft.scriptMode} onChange={value => set({ scriptMode: value })} />
                        </Field>
                        {draft.scriptMode === 'src' && (
                            <>
                                <Field label="Script address (src)" error={errors.src}>
                                    <Input value={draft.src} onChange={on('src')} maxLength={2000} placeholder="https://example.com/script.js" invalid={!!errors.src} spellCheck={false} />
                                </Field>
                                <div className="ac-seo-checks">
                                    <Checkbox label="async (load without holding up the page)" checked={draft.async} onChange={checked => set({ async: checked })} />
                                    <Checkbox label="defer (run after the page has loaded)" checked={draft.defer} onChange={checked => set({ defer: checked })} />
                                </div>
                            </>
                        )}
                        {draft.scriptMode === 'inline' && (
                            <Field label="Code" error={errors.code} hint="Only what goes between <script> and </script>. It runs on every page you choose.">
                                <Textarea rows={8} value={draft.code} onChange={on('code')} className="ak-mono ac-seo-codearea" invalid={!!errors.code} spellCheck={false} placeholder="window.dataLayer = window.dataLayer || [];" />
                            </Field>
                        )}
                        {draft.scriptMode === 'json' && (
                            <Field label="Structured data (JSON-LD)" error={errors.json} hint="Schema.org JSON, e.g. LocalBusiness or Organization. Saved tidily formatted.">
                                <Textarea rows={10} value={draft.json} onChange={on('json')} className="ak-mono ac-seo-codearea" invalid={!!errors.json} spellCheck={false} placeholder={'{\n  "@context": "https://schema.org",\n  "@type": "LocalBusiness",\n  "name": "Dynamic Manufacturing Solutions"\n}'} />
                            </Field>
                        )}
                    </>
                )}

                {draft.tag === 'noscript' && (
                    <Field label="HTML" error={errors.html} hint="Shown only when JavaScript is off. <img>, <iframe>, <link> or <meta> only. Always placed last in <head>.">
                        <Textarea rows={4} value={draft.html} onChange={on('html')} className="ak-mono ac-seo-codearea" invalid={!!errors.html} spellCheck={false} placeholder={'<img height="1" width="1" style="display:none" src="https://…">'} />
                    </Field>
                )}

                {allowsExtra && (
                    <Field as="div" label="More attributes" optional hint={`Allowed: ${[...extraNames, ...(draft.tag === 'script' ? ['data-…'] : [])].join(', ')}.`}>
                        <div className="ac-seo-attrs">
                            {draft.extra.map((row, i) => (
                                <div key={i} className="ac-seo-attr">
                                    <Input size="sm" value={row.name} onChange={e => setExtra(i, { name: e.target.value })} placeholder="name" list={listId} aria-label={`Attribute ${i + 1} name`} invalid={!!errors[`extra:${i}`]} spellCheck={false} className="ak-mono" />
                                    <Input size="sm" value={row.value} onChange={e => setExtra(i, { value: e.target.value })} placeholder="value" aria-label={`Attribute ${i + 1} value`} spellCheck={false} />
                                    <IconButton icon={Trash2} size="xs" label={`Remove attribute ${row.name || i + 1}`} onClick={() => set({ extra: draft.extra.filter((_, n) => n !== i) })} />
                                    {errors[`extra:${i}`] && <p className="ak-error-text ac-seo-attr-error" role="alert">{errors[`extra:${i}`]}</p>}
                                </div>
                            ))}
                            <datalist id={listId}>{extraNames.map(n => <option key={n} value={n} />)}</datalist>
                            <span><Button size="sm" variant="ghost" icon={Plus} onClick={() => set({ extra: [...draft.extra, { name: '', value: '' }] })}>Add attribute</Button></span>
                        </div>
                    </Field>
                )}

                <Field as="div" label="Pages" error={errors.pages} hint="Never added to admin pages.">
                    <Segmented
                        label="Pages"
                        items={[{ value: 'all', label: 'All pages' }, { value: 'some', label: 'Chosen pages' }]}
                        value={draft.pages === 'all' ? 'all' : 'some'}
                        onChange={value => set({ pages: value === 'all' ? 'all' : chosen })}
                    />
                    {draft.pages !== 'all' && (
                        <div className="ac-seo-pages-grid">
                            {PAGE_CHOICES.map(p => (
                                <Checkbox
                                    key={p.path}
                                    label={<>{p.label} <span className="ak-mono ac-seo-path">{p.path}</span></>}
                                    checked={chosen.includes(p.path)}
                                    onChange={checked => togglePage(p.path, checked)}
                                />
                            ))}
                        </div>
                    )}
                </Field>

                <FieldRow>
                    <Field label="Name" optional hint="Only you see it, e.g. Bing verification." error={errors.label}>
                        <Input value={draft.label} onChange={on('label')} maxLength={80} placeholder="Bing verification" />
                    </Field>
                    <Field as="div" label="Status">
                        <Switch label={draft.enabled ? 'On' : 'Off'} checked={draft.enabled} onChange={enabled => set({ enabled })} description="Off keeps the tag here without adding it to pages." />
                    </Field>
                </FieldRow>

                <p className="ac-seo-preview-label">Tag</p>
                <pre className="ac-seo-code">{html}</pre>
            </div>
        </Modal>
    );
}
