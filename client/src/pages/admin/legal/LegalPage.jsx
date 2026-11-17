import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock3, ExternalLink, FileText, Hash, Heading, Lock, Pencil, Plus, Scale, Trash2 } from 'lucide-react';
import {
    Page, PageHeader, StatGrid, StatCard, Toolbar, Segmented, Button, IconButton, DataTable, RowActions, EmptyState,
    Banner, useConfirm,
} from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { legalService } from '../../../services/admin/legal';
import LegalIcon from '../../../components/LegalIcon';
import { compactDate, plural, shortDate } from '../content/format';
import LegalSectionForm from './LegalSectionForm';
import { DOCUMENTS, sortSections } from './legalText';
import '../content/content.css';
import './legal.css';

/**
 * Admin > Terms & policy: the numbered sections of the Privacy policy and
 * Terms of service pages. Pick the document, then add, edit (with a preview
 * of the public look) or delete sections. ?doc=terms opens the terms.
 */

const snippet = (paragraphs, max = 110) => {
    const flat = (Array.isArray(paragraphs) ? paragraphs : []).join(' ').replace(/\s+/g, ' ').trim();
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

// "01".."06" -> "07"; keeps the zero padding of the last number.
const nextSerial = (sections) => {
    const last = sortSections(sections).map(s => String(s.serial_number || '')).filter(s => /^\d+$/.test(s)).pop();
    if (!last) return sections.length ? '' : '01';
    return String(Number(last) + 1).padStart(last.length, '0');
};

const lastUpdate = (rows) => {
    const times = rows.map(s => Date.parse(s.updated_at || s.created_at)).filter(Number.isFinite);
    return times.length ? new Date(Math.max(...times)) : null;
};

export default function LegalPage() {
    const toast = useToast();
    const [confirm, confirmDialog] = useConfirm();
    const [params, setParams] = useSearchParams();
    const type = params.get('doc') === 'terms' ? 'terms' : 'privacy';
    const doc = DOCUMENTS[type];

    const [docs, setDocs] = useState({ privacy: [], terms: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(null); // null | 'new' | section

    const fetchAll = useCallback(() => Promise.all([legalService.list('privacy'), legalService.list('terms')])
        .then(([privacy, terms]) => { setDocs({ privacy: privacy || [], terms: terms || [] }); setError(''); })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false)), []);

    useEffect(() => { fetchAll(); }, [fetchAll]);
    const load = () => { setLoading(true); setError(''); fetchAll(); };

    const setType = (next) => setParams(prev => {
        const p = new URLSearchParams(prev);
        if (next === 'terms') p.set('doc', 'terms'); else p.delete('doc');
        return p;
    }, { replace: true });

    const sections = useMemo(() => sortSections(docs[type]), [docs, type]);
    const updated = useMemo(() => lastUpdate(docs[type]), [docs, type]);

    const onSaved = (row) => {
        setDocs(prev => {
            const list = prev[type].some(s => s.id === row.id) ? prev[type].map(s => (s.id === row.id ? row : s)) : [...prev[type], row];
            return { ...prev, [type]: list };
        });
        setEditing(null);
    };

    const remove = async (section) => {
        const yes = await confirm({
            title: `Delete “${section.heading}”?`,
            message: `It is removed from the ${doc.label.toLowerCase()} straight away. This cannot be undone.`,
            confirmLabel: 'Delete section',
            danger: true,
        });
        if (!yes) return;
        try {
            await legalService.remove(section.id);
            setDocs(prev => ({ ...prev, [type]: prev[type].filter(s => s.id !== section.id) }));
            toast('Section deleted', 'success');
        } catch (err) { toast(err.message, 'error'); }
    };

    const columns = [
        { key: 'serial', header: 'No.', icon: Hash, width: 90, render: (s) => <span className="ac-lg-serial-cell">{s.serial_number}</span> },
        {
            key: 'heading', header: 'Section', icon: Heading, className: 'ac-td-lead',
            render: (s) => (
                <span className="ak-cell-with-thumb">
                    <span className="ac-lg-icon-tile" aria-hidden="true"><LegalIcon name={s.icon} size={18} /></span>
                    <span>
                        <span className="ak-cell-main">{s.heading}</span>
                        <span className="ak-cell-sub">{plural(Array.isArray(s.content) ? s.content.length : 0, 'paragraph')}</span>
                    </span>
                </span>
            ),
        },
        { key: 'text', header: 'Starts with', icon: FileText, hideBelow: 1100, render: (s) => <span className="ak-cell-sub ac-lg-snippet">{snippet(s.content) || '—'}</span> },
        { key: 'updated', header: 'Updated', icon: Clock3, hideBelow: 1280, width: 140, render: (s) => shortDate(s.updated_at || s.created_at) },
        {
            key: 'actions', header: 'Actions', actions: true,
            render: (s) => (
                <RowActions>
                    <IconButton icon={Pencil} label={`Edit ${s.heading}`} onClick={() => setEditing(s)} />
                    <IconButton icon={Trash2} label={`Delete ${s.heading}`} variant="danger" onClick={() => remove(s)} />
                </RowActions>
            ),
        },
    ];

    return (
        <Page>
            <PageHeader
                icon={Scale}
                title="Terms & policy"
                subtitle="The sections of the Privacy policy and Terms of service pages."
                actions={(
                    <>
                        <Button icon={ExternalLink} href={doc.path} target="_blank" rel="noreferrer">View page</Button>
                        <Button variant="primary" icon={Plus} onClick={() => setEditing('new')} disabled={loading}>Add section</Button>
                    </>
                )}
            />

            <StatGrid label="Documents">
                <StatCard icon={Lock} value={docs.privacy.length} label="Privacy policy" loading={loading} active={type === 'privacy'} onClick={() => setType('privacy')} />
                <StatCard icon={Scale} value={docs.terms.length} label="Terms" loading={loading} active={type === 'terms'} onClick={() => setType('terms')} />
                <StatCard icon={Clock3} value={updated ? compactDate(updated) : '—'} label="Last updated" loading={loading} title={`${doc.label}: shown as “Last updated” on the page${updated ? ` (${shortDate(updated)})` : ''}`} />
            </StatGrid>

            <Toolbar
                left={(
                    <Segmented
                        label="Document"
                        value={type}
                        onChange={setType}
                        items={[
                            { value: 'privacy', label: DOCUMENTS.privacy.label, icon: Lock, count: docs.privacy.length },
                            { value: 'terms', label: DOCUMENTS.terms.label, icon: Scale, count: docs.terms.length },
                        ]}
                    />
                )}
            />

            {error ? (
                <Banner tone="error" action={<Button size="sm" onClick={load}>Try again</Button>}>Could not load the sections. {error}</Banner>
            ) : (
                <DataTable
                    caption={`${doc.label} sections`}
                    columns={columns}
                    rows={sections}
                    loading={loading}
                    skeletonRows={4}
                    onRowClick={setEditing}
                    empty={(
                        <EmptyState icon={Scale} title={`The ${doc.label.toLowerCase()} has no sections`} action={<Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Add the first section</Button>}>
                            Until it has one, the page says it is being written.
                        </EmptyState>
                    )}
                />
            )}

            {editing && (
                <LegalSectionForm
                    key={`${type}-${editing === 'new' ? 'new' : editing.id}`}
                    type={type}
                    section={editing === 'new' ? null : editing}
                    defaults={{ serial_number: nextSerial(docs[type]) }}
                    onClose={() => setEditing(null)}
                    onSaved={onSaved}
                />
            )}
            {confirmDialog}
        </Page>
    );
}
