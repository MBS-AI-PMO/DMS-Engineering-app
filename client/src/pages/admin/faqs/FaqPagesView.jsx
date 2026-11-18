import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Hash, Layers, LayoutGrid, MessageSquare, MinusCircle, Pencil, Plus } from 'lucide-react';
import {
    Banner, Button, Card, CellText, DataTable, EmptyState, IconButton, Pill, RowActions,
} from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { faqPagesService } from '../../../services/admin/faqs';
import MoveButtons from '../content/MoveButtons';
import { move } from '../content/list';
import { pageHref, placementNote, snippet } from './faqPages';
import { useUrlParams } from './useUrlParams';
import AddFaqsDialog from './AddFaqsDialog';
import PageList from './PageList';

/**
 * Admin > FAQs, "On pages": pick a page of the site (?key=/about) to see the
 * FAQs shown on it in order, move them up or down, take one off, add
 * existing FAQs or write a new one for it. Every change saves straight away.
 * The order comes from the server; the questions themselves from `faqs`, so
 * edits made in the dialog show here at once.
 */

const idsKey = (ids) => [...ids].sort((a, b) => a - b).join(',');

export default function FaqPagesView({ faqs, categories, pages, pageCounts, loading, error, onRetry, onPlaced, onEdit, onCreate }) {
    const toast = useToast();
    const [params, setParam] = useUrlParams();
    const [loaded, setLoaded] = useState({ key: null, ids: [], error: '' });
    const [busy, setBusy] = useState(false);
    const [adding, setAdding] = useState(false);
    const [attempt, setAttempt] = useState(0);

    const firstWithFaqs = pages.list.find(p => pageCounts.get(p.key));
    const key = params.get('key') || firstWithFaqs?.key || '/';
    const page = pages.list.find(p => p.key === key)
        || (pages.loading ? { key, label: key, group: 'main' } : { key, label: key, group: 'other', missing: true });
    const faqById = useMemo(() => new Map(faqs.map(f => [f.id, f])), [faqs]);
    const categoryName = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);

    // Which FAQs the list says are on this page; when the loaded order does
    // not match (another page picked, or the dialog changed its pages), load it.
    const expected = useMemo(() => idsKey(faqs.filter(f => f.pages?.includes(key)).map(f => f.id)), [faqs, key]);
    const stale = loaded.key !== key || idsKey(loaded.ids) !== expected;
    useEffect(() => {
        if (!stale || loading || error) return undefined;
        let cancelled = false;
        faqPagesService.faqsOn(key)
            .then(rows => { if (!cancelled) setLoaded({ key, ids: (rows || []).map(r => r.id), error: '' }); })
            .catch(err => { if (!cancelled) setLoaded({ key, ids: [], error: err.message }); });
        return () => { cancelled = true; };
    }, [key, stale, expected, loading, error, attempt]);

    const listLoading = loading || loaded.key !== key;
    const rows = useMemo(() => (loaded.key === key ? loaded.ids.map(id => faqById.get(id)).filter(Boolean) : []), [loaded, key, faqById]);
    const onPage = useMemo(() => new Set(rows.map(f => f.id)), [rows]);

    // On one metal / service page, the FAQs placed on all of them show too.
    const typeKey = !page.wildcard && /^\/(metal|service)\/[^*]/.test(key) ? `/${key.split('/')[1]}/*` : null;
    const typePage = typeKey ? pages.list.find(p => p.key === typeKey) : null;
    const typeCount = typeKey ? pageCounts.get(typeKey) || 0 : 0;

    const save = async (nextIds, done) => {
        const before = loaded.ids;
        setLoaded({ key, ids: nextIds, error: '' });
        onPlaced(key, nextIds);
        setBusy(true);
        try {
            const saved = await faqPagesService.setFaqs(key, nextIds);
            setLoaded({ key, ids: saved.map(r => r.id), error: '' });
            if (done) toast(done, 'success');
            return true;
        } catch (err) {
            setLoaded({ key, ids: before, error: '' });
            onPlaced(key, before);
            toast(`Not saved. ${err.message}`, 'error');
            return false;
        } finally {
            setBusy(false);
        }
    };

    const reorder = (from, to) => {
        const next = move(rows, from, to);
        if (next !== rows) save(next.map(f => f.id));
    };
    const takeOff = (faq) => save(rows.filter(f => f.id !== faq.id).map(f => f.id), `Taken off ${page.label}. The FAQ itself is kept.`);
    const add = async (ids) => {
        const ok = await save([...rows.map(f => f.id), ...ids], `${ids.length === 1 ? '1 FAQ' : `${ids.length} FAQs`} added to ${page.label}`);
        if (ok) setAdding(false);
    };

    const columns = [
        { key: 'n', header: '#', icon: Hash, width: 64, render: (f, i) => <span className="ac-faq-num">{i + 1}</span> },
        {
            key: 'question', header: 'Question', icon: MessageSquare, className: 'ac-td-lead',
            render: (f) => <CellText main={f.question} sub={`${f.show_on_faq_page === false ? 'Page-only' : categoryName.get(f.category_id) || 'No category'} · ${snippet(f.answer, 110)}`} />,
        },
        {
            key: 'actions', header: 'Actions', actions: true,
            render: (f, i) => (
                <RowActions>
                    <MoveButtons index={i} count={rows.length} onMove={reorder} label={`question ${i + 1}`} disabled={busy} />
                    <IconButton icon={Pencil} label="Edit FAQ" onClick={() => onEdit(f)} />
                    <IconButton icon={MinusCircle} label={`Take off ${page.label}`} variant="danger" onClick={() => takeOff(f)} disabled={busy} />
                </RowActions>
            ),
        },
    ];

    const href = page.missing ? null : pageHref(key);
    const tag = page.wildcard ? <Pill tone="violet">Every page of this type</Pill>
        : page.missing ? <Pill tone="amber">No longer exists</Pill>
            : page.hidden ? <Pill tone="gray">Hidden service</Pill> : null;

    return (
        <div className="ac-faq-layout">
            <PageList pages={pages} counts={pageCounts} value={key} onChange={k => setParam({ key: k })} />

            <div className="ak-stack">
                <Card
                    icon={page.wildcard ? Layers : LayoutGrid}
                    title={page.label}
                    count={listLoading ? undefined : rows.length}
                    subtitle={<span className="ac-faq-key">{key}</span>}
                    actions={(
                        <>
                            {href && <Button size="sm" icon={ExternalLink} href={href} target="_blank" rel="noreferrer">View page</Button>}
                            {!page.missing && <Button size="sm" icon={Plus} onClick={() => onCreate(key)} disabled={loading}>New FAQ</Button>}
                            {!page.missing && <Button size="sm" variant="primary" icon={Plus} onClick={() => setAdding(true)} disabled={listLoading || busy}>Add FAQs</Button>}
                        </>
                    )}
                >
                    <div className="ac-faq-note">
                        {tag}
                        <p>{placementNote(page)}</p>
                        {typeCount > 0 && (
                            <p>
                                Visitors also see the {typeCount === 1 ? 'FAQ' : `${typeCount} FAQs`} on{' '}
                                <button type="button" className="ak-link ac-faq-linkbtn" onClick={() => setParam({ key: typeKey })}>{typePage?.label || typeKey}</button>
                                {' '}after these.
                            </p>
                        )}
                    </div>
                </Card>

                {error ? (
                    <Banner tone="error" action={<Button size="sm" onClick={onRetry}>Try again</Button>}>Could not load the FAQs. {error}</Banner>
                ) : loaded.error && loaded.key === key ? (
                    <Banner tone="error" action={<Button size="sm" onClick={() => { setLoaded({ key: null, ids: [], error: '' }); setAttempt(a => a + 1); }}>Try again</Button>}>Could not load the FAQs of this page. {loaded.error}</Banner>
                ) : (
                    <DataTable
                        caption={`FAQs on ${page.label}, in order`}
                        columns={columns}
                        rows={rows}
                        loading={listLoading}
                        skeletonRows={4}
                        onRowClick={onEdit}
                        empty={(
                            <EmptyState
                                icon={LayoutGrid}
                                title="No FAQs on this page yet"
                                action={page.missing ? null : <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>Add FAQs</Button>}
                            >
                                {page.missing ? 'Nothing is placed here.' : 'Add existing FAQs, or write a new one for this page.'}
                            </EmptyState>
                        )}
                    />
                )}
                {rows.length > 1 && <p className="ac-hint-line">The arrows set the order visitors see. Changes save straight away.</p>}
            </div>

            {adding && (
                <AddFaqsDialog
                    faqs={faqs}
                    categories={categories}
                    onPage={onPage}
                    pageName={page.label}
                    onAdd={add}
                    onClose={() => setAdding(false)}
                />
            )}
        </div>
    );
}
