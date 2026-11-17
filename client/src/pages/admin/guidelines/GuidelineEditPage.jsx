import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ExternalLink, FileText, ListChecks, Type } from 'lucide-react';
import {
    Page, PageHeader, Card, Grid, Field, Input, Textarea, Pill, Banner, Button, Skeleton, useConfirm,
} from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { guidelinesService } from '../../../services/admin/guidelines';
import ListEditor from '../content/ListEditor';
import SaveBar from '../content/SaveBar';
import { useUnsavedChanges } from '../content/useUnsavedChanges';
import { shortDate } from '../content/format';
import { fromEditor, problems, toEditor } from './guidelineModel';
import SizeTablesCard from './SizeTablesCard';
import '../content/content.css';
import './guidelines.css';

/**
 * Admin > Guidelines > one service (/admin/guidelines/:serviceId): the
 * title and introduction, the requirements list and the size tables shown
 * for that service on the Design guidelines page. Works for services that
 * have no guidelines yet (saving creates them). Unsaved changes are kept
 * until Save or Discard, and the browser asks before leaving with them.
 */
export default function GuidelineEditPage() {
    const { serviceId } = useParams();
    const toast = useToast();
    const [confirm, confirmDialog] = useConfirm();

    const [record, setRecord] = useState(null); // stored guidelines, null when none yet
    const [service, setService] = useState(null);
    const [editor, setEditor] = useState(null);
    const [saved, setSaved] = useState(''); // JSON of what is stored, to spot changes
    const [selectedTable, setSelectedTable] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [issues, setIssues] = useState([]);

    // tableIndex: which material to keep open (tables come back in the same order).
    const reset = useCallback((row, fallbackTitle, tableIndex = 0) => {
        const next = toEditor(row, fallbackTitle);
        setRecord(row);
        setEditor(next);
        setSaved(JSON.stringify(fromEditor(serviceId, next)));
        setSelectedTable((next.tables[tableIndex] || next.tables[0])?.key || null);
        setIssues([]);
    }, [serviceId]);

    const fetchAll = useCallback(() => Promise.all([
        guidelinesService.get(serviceId),
        guidelinesService.services().catch(() => []),
    ]).then(([row, services]) => {
        const svc = (services || []).find(s => String(s.id) === String(serviceId)) || null;
        if (!row && !svc) throw new Error('There is no service with this number.');
        setService(svc);
        reset(row, svc?.title || '');
        setError('');
    }).catch(err => setError(err.message)).finally(() => setLoading(false)), [serviceId, reset]);

    useEffect(() => { fetchAll(); }, [fetchAll]);
    const load = () => { setLoading(true); setError(''); fetchAll(); };

    const payload = useMemo(() => (editor ? fromEditor(serviceId, editor) : null), [editor, serviceId]);
    const dirty = Boolean(payload) && JSON.stringify(payload) !== saved;
    useUnsavedChanges(dirty);

    const set = (patch) => setEditor(prev => ({ ...prev, ...patch }));

    const save = async () => {
        const found = problems(editor);
        setIssues(found);
        if (found.length) {
            const withTable = found.find(p => p.tableKey);
            if (withTable) setSelectedTable(withTable.tableKey);
            toast('Fix the highlighted problems first.', 'error');
            return;
        }
        setSaving(true);
        try {
            const row = await guidelinesService.save(payload);
            const wasNew = !record;
            reset(row, row.title, Math.max(0, editor.tables.findIndex(t => t.key === selectedTable)));
            toast(wasNew ? 'Guidelines published' : 'Guidelines saved', 'success');
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const discard = async () => {
        if (!(await confirm({ title: 'Discard your changes?', message: 'The guidelines go back to how they were last saved.', confirmLabel: 'Discard changes', danger: true }))) return;
        reset(record, service?.title || '');
    };

    const back = { to: '/admin/guidelines', label: 'Guidelines' };
    if (loading) {
        return (
            <Page busy>
                <PageHeader back={back} icon={FileText} title={<Skeleton width={220} size="lg" />} subtitle="Loading the guidelines…" />
                <Grid>
                    <Card><Skeleton width="40%" /><Skeleton /><Skeleton size="block" /></Card>
                    <Card><Skeleton width="40%" /><Skeleton /><Skeleton /><Skeleton /></Card>
                </Grid>
                <Card className="ac-gd-gap"><Skeleton width="30%" /><Skeleton size="block" /></Card>
            </Page>
        );
    }
    if (error) {
        return (
            <Page>
                <PageHeader back={back} icon={FileText} title="Guidelines" />
                <Banner tone="error" action={<Button size="sm" onClick={load}>Try again</Button>}>Could not open these guidelines. {error}</Banner>
            </Page>
        );
    }

    const titleIssue = issues.find(p => p.field === 'title');
    return (
        <Page>
            <PageHeader
                back={back}
                icon={FileText}
                title={(
                    <>
                        {editor.title.trim() || service?.title || 'Guidelines'}
                        {record ? <Pill tone="green" dot>Published</Pill> : <Pill tone="amber" dot>Not published</Pill>}
                    </>
                )}
                subtitle={record
                    ? `${service?.title && service.title !== editor.title.trim() ? `For ${service.title} · ` : ''}Last saved ${shortDate(record.updated_at || record.created_at)}`
                    : `${service?.title || 'This service'} has no guidelines yet. Save to publish them on the guidelines page.`}
                actions={<Button icon={ExternalLink} href="/guidelines" target="_blank" rel="noreferrer">View page</Button>}
            />

            {issues.length > 0 && (
                <Banner tone="error">
                    <span className="ac-gd-issues">
                        {issues.map(p => <span key={p.message}>{p.message}</span>)}
                    </span>
                </Banner>
            )}

            <Grid>
                <Card title="Title and introduction" icon={Type} subtitle="The heading and the text above the requirements.">
                    <Field label="Title" error={titleIssue ? 'Add a title.' : undefined}>
                        <Input value={editor.title} onChange={e => set({ title: e.target.value })} maxLength={200} invalid={!!titleIssue} placeholder="e.g. Anodizing" />
                    </Field>
                    <Field label="Introduction" optional hint="A short description of the process. Line breaks are kept.">
                        <Textarea value={editor.content} onChange={e => set({ content: e.target.value })} rows={6} maxLength={20000} />
                    </Field>
                </Card>
                <Card title="Requirements" icon={ListChecks} count={editor.requirements.length || undefined} subtitle="Shown as a checklist. Empty lines are left out.">
                    <ListEditor
                        items={editor.requirements}
                        onChange={requirements => set({ requirements })}
                        itemLabel="requirement"
                        placeholder="e.g. Parts must be at least 1 x 1 in."
                        emptyText="No requirements yet."
                        maxLength={2000}
                    />
                </Card>
            </Grid>

            <div className="ac-gd-gap">
                <SizeTablesCard
                    tables={editor.tables}
                    onChange={tables => set({ tables })}
                    selected={selectedTable}
                    onSelect={setSelectedTable}
                    confirm={confirm}
                />
            </div>

            <SaveBar dirty={dirty} canSave={dirty || !record} saving={saving} onSave={save} onDiscard={discard} saveLabel={record ? 'Save guidelines' : 'Publish guidelines'} note={record ? 'All changes saved' : 'Nothing saved yet'} />
            {confirmDialog}
        </Page>
    );
}
