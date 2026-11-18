import { useState } from 'react';
import { ClipboardPaste, Code2, FileCode2, Globe2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Banner, Button, Card, CellText, DataTable, EmptyState, IconButton, Pill, RowActions, Switch } from '../../../components/admin/ui';
import MoveButtons from '../content/MoveButtons';
import HeadTagModal from './HeadTagModal';
import PasteTagsModal from './PasteTagsModal';
import { MAX_TAGS, describeTag, pageLabel, tagHtml } from './headTagsForm';

/**
 * Admin › SEO & tracking › Head tags: the admin's own <head> tags, in
 * order, each on/off and for all or chosen pages. Edits stay on the page
 * until the save bar saves them. tags / onChange(tags): the list;
 * errors: { 'head:<id>': message }; confirm: from the page's useConfirm.
 */
export default function HeadTagsCard({ tags, onChange, errors, confirm }) {
    const [editing, setEditing] = useState(null); // { index: number | null }
    const [pasting, setPasting] = useState(false);
    const full = tags.length >= MAX_TAGS;

    const replace = (index, tag) => onChange(tags.map((t, i) => (i === index ? tag : t)));
    const move = (from, to) => {
        if (to < 0 || to >= tags.length) return;
        const next = [...tags];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        onChange(next);
    };
    const remove = async (index) => {
        const tag = tags[index];
        const ok = await confirm({
            title: 'Remove this tag?',
            message: `${tag.label || describeTag(tag)} comes off every page once you save.`,
            confirmLabel: 'Remove tag',
            danger: true,
        });
        if (ok) onChange(tags.filter((_, i) => i !== index));
    };

    const columns = [
        {
            key: 'on',
            header: 'On',
            width: '72px',
            render: (t, i) => (
                <span onClick={e => e.stopPropagation()}>
                    <Switch label={<span className="ak-sr">{t.label || describeTag(t)} on</span>} checked={t.enabled} onChange={enabled => replace(i, { ...t, enabled })} />
                </span>
            ),
        },
        {
            key: 'tag',
            header: 'Tag',
            icon: Code2,
            render: (t) => {
                const error = errors[`head:${t.id}`];
                return (
                    <span className="ac-seo-tagcell">
                        <CellText main={<>{t.label || describeTag(t)}{error && <> <Pill tone="red">Fix</Pill></>}</>} />
                        <code className="ac-seo-oneline">{tagHtml(t)}</code>
                        {error && <span className="ak-error-text">{error}</span>}
                    </span>
                );
            },
        },
        {
            key: 'pages',
            header: 'Pages',
            icon: Globe2,
            width: '210px',
            render: (t) => (t.pages === 'all'
                ? <Pill tone="gray">All pages</Pill>
                : (
                    <span className="ac-seo-pills">
                        {t.pages.slice(0, 2).map(p => <Pill key={p} tone="blue">{pageLabel(p)}</Pill>)}
                        {t.pages.length > 2 && <Pill tone="gray">+{t.pages.length - 2}</Pill>}
                    </span>
                )),
        },
        {
            key: 'order',
            header: 'Order',
            width: '84px',
            render: (t, i) => (
                <RowActions><MoveButtons index={i} count={tags.length} onMove={move} label={t.label || describeTag(t)} /></RowActions>
            ),
        },
        {
            key: 'actions',
            actions: true,
            width: '96px',
            render: (t, i) => (
                <RowActions>
                    <IconButton icon={Pencil} label={`Edit ${t.label || describeTag(t)}`} onClick={() => setEditing({ index: i })} />
                    <IconButton icon={Trash2} variant="danger" label={`Remove ${t.label || describeTag(t)}`} onClick={() => remove(i)} />
                </RowActions>
            ),
        },
    ];

    const addButtons = (
        <>
            <Button size="sm" icon={ClipboardPaste} onClick={() => setPasting(true)} disabled={full}>Paste HTML</Button>
            <Button size="sm" variant="primary" icon={Plus} onClick={() => setEditing({ index: null })} disabled={full}>Add tag</Button>
        </>
    );

    return (
        <Card
            title="Head tags"
            icon={FileCode2}
            count={tags.length ? `${tags.filter(t => t.enabled).length} of ${tags.length} on` : undefined}
            subtitle="Your own tags for the <head> of the pages: verification codes, icons, other-language links, scripts and structured data. They go after the built-in tags; one with the same name as a built-in tag (meta description, link canonical…) replaces it on its pages."
            actions={tags.length ? addButtons : undefined}
        >
            {tags.length === 0 ? (
                <EmptyState icon={Code2} title="No head tags yet" action={<div className="ac-seo-empty-actions">{addButtons}</div>}>
                    Add a tag, or paste the snippet a service gave you (Google, Bing, Pinterest, Meta…).
                </EmptyState>
            ) : (
                <DataTable
                    columns={columns}
                    rows={tags}
                    rowKey="id"
                    caption="Head tags"
                    onRowClick={row => setEditing({ index: tags.indexOf(row) })}
                    className="ac-seo-tags"
                />
            )}
            {errors['head:count'] && <Banner tone="error">{errors['head:count']}</Banner>}
            <p className="ak-hint ac-seo-note">
                Never added to admin pages. &lt;noscript&gt; tags always go last. Saved changes show in the page source within a minute.
            </p>

            {editing && (
                <HeadTagModal
                    tag={editing.index === null ? null : tags[editing.index]}
                    onClose={() => setEditing(null)}
                    onSave={(tag) => {
                        if (editing.index === null) onChange([...tags, tag]);
                        else replace(editing.index, tag);
                        setEditing(null);
                    }}
                />
            )}
            {pasting && (
                <PasteTagsModal
                    room={MAX_TAGS - tags.length}
                    onClose={() => setPasting(false)}
                    onAdd={(added) => {
                        onChange([...tags, ...added]);
                        setPasting(false);
                    }}
                />
            )}
        </Card>
    );
}
