import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    AlertTriangle, Clock3, ExternalLink, FolderOpen, Hash, HelpCircle, MessageSquare, Pencil, Plus, Trash2,
} from 'lucide-react';
import {
    Page, PageHeader, StatGrid, StatCard, Toolbar, SearchInput, Select, Button, IconButton, DataTable, CellText,
    RowActions, Pill, EmptyState, Banner, useConfirm,
} from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { faqCategoriesService, faqsService } from '../../../services/admin/faqs';
import MoveButtons from '../content/MoveButtons';
import Pager from '../content/Pager';
import { move } from '../content/list';
import { compactDate, shortDate } from '../content/format';
import FaqForm from './FaqForm';
import '../content/content.css';
import './faqs.css';

/**
 * Admin > FAQs: every question on the FAQ page. Filter by category or
 * search; with one category picked (and no search) the arrows set the
 * order the questions show in. A row opens it for editing. Filters live in
 * the URL (?category=<id>|none, ?q=, ?page=) so "back" returns to them.
 */

const PAGE_SIZE = 25;
const NO_CATEGORY = 'none';

const snippet = (text, max = 150) => {
    const flat = String(text || '').replace(/\s+/g, ' ').trim();
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

export default function FaqsPage() {
    const toast = useToast();
    const [confirm, confirmDialog] = useConfirm();
    const [params, setParams] = useSearchParams();
    const category = params.get('category') || '';
    const query = params.get('q') || '';
    const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);

    const [faqs, setFaqs] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(null); // null | 'new' | faq row
    const [busy, setBusy] = useState(false);

    const setParam = useCallback((changes) => {
        setParams(prev => {
            const next = new URLSearchParams(prev);
            Object.entries(changes).forEach(([k, v]) => {
                if (v === null || v === undefined || v === '' || (k === 'page' && v === 1)) next.delete(k); else next.set(k, String(v));
            });
            return next;
        }, { replace: true });
    }, [setParams]);

    const fetchAll = useCallback(() => Promise.all([faqsService.list(), faqCategoriesService.list()])
        .then(([f, c]) => { setFaqs(f || []); setCategories(c || []); setError(''); })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false)), []);

    useEffect(() => { fetchAll(); }, [fetchAll]);
    const load = () => { setLoading(true); setError(''); fetchAll(); };

    const categoryById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

    // The FAQ page's order: category order, then position, then id.
    const sorted = useMemo(() => {
        const rank = (f) => categoryById.get(f.category_id)?.display_order ?? Number.MAX_SAFE_INTEGER;
        return [...faqs].sort((a, b) => rank(a) - rank(b) || (a.display_order ?? 0) - (b.display_order ?? 0) || a.id - b.id);
    }, [faqs, categoryById]);

    const counts = useMemo(() => {
        const map = new Map();
        faqs.forEach(f => { const k = f.category_id ?? NO_CATEGORY; map.set(k, (map.get(k) || 0) + 1); });
        return map;
    }, [faqs]);

    const lastEdited = useMemo(() => {
        const times = faqs.map(f => Date.parse(f.updated_at || f.created_at)).filter(Number.isFinite);
        return times.length ? new Date(Math.max(...times)) : null;
    }, [faqs]);

    const needle = query.trim().toLowerCase();
    const visible = useMemo(() => sorted.filter(f => {
        if (category === NO_CATEGORY ? f.category_id != null : category && String(f.category_id) !== category) return false;
        return !needle || f.question.toLowerCase().includes(needle) || String(f.answer || '').toLowerCase().includes(needle);
    }), [sorted, category, needle]);

    const selectedCategory = category && category !== NO_CATEGORY ? categoryById.get(Number(category)) : null;
    const reorderable = Boolean(selectedCategory) && !needle;
    const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const current = Math.min(page, pages);
    const shown = reorderable ? visible : visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

    const nextPosition = (categoryId) => 1 + Math.max(0, ...faqs.filter(f => (f.category_id ?? null) === categoryId).map(f => f.display_order || 0));

    const onSaved = (row) => {
        const cat = categoryById.get(row.category_id);
        const full = { ...row, category_name: cat?.name || null, category_slug: cat?.slug || null };
        setFaqs(prev => (prev.some(f => f.id === row.id) ? prev.map(f => (f.id === row.id ? full : f)) : [...prev, full]));
        setEditing(null);
    };

    const remove = async (faq) => {
        const yes = await confirm({
            title: 'Delete this FAQ?',
            message: `“${snippet(faq.question, 120)}” is removed from the FAQ page. This cannot be undone.`,
            confirmLabel: 'Delete FAQ',
            danger: true,
        });
        if (!yes) return;
        try {
            await faqsService.remove(faq.id);
            setFaqs(prev => prev.filter(f => f.id !== faq.id));
            toast('FAQ deleted', 'success');
        } catch (err) { toast(err.message, 'error'); }
    };

    const reorder = async (from, to) => {
        const next = move(visible, from, to);
        if (next === visible) return;
        const positions = new Map(next.map((f, i) => [f.id, i + 1]));
        const before = faqs;
        setFaqs(prev => prev.map(f => (positions.has(f.id) ? { ...f, display_order: positions.get(f.id) } : f)));
        setBusy(true);
        try {
            await faqsService.reorder(next.map(f => f.id));
        } catch (err) {
            setFaqs(before);
            toast(`The new order was not saved. ${err.message}`, 'error');
        } finally { setBusy(false); }
    };

    const columns = [
        { key: 'question', header: 'Question', icon: MessageSquare, className: 'ac-td-lead', render: (f) => <CellText main={f.question} sub={snippet(f.answer)} /> },
        ...(selectedCategory ? [] : [{
            key: 'category', header: 'Category', icon: FolderOpen, hideBelow: 860, width: 210,
            render: (f) => (f.category_id != null
                ? <Pill tone="gray">{categoryById.get(f.category_id)?.name || f.category_name || 'Unknown'}</Pill>
                : <Pill tone="amber">No category</Pill>),
        }]),
        { key: 'position', header: 'Position', icon: Hash, align: 'right', width: 110, hideBelow: 1100, render: (f) => f.display_order ?? '—' },
        {
            key: 'actions', header: 'Actions', actions: true,
            render: (f, i) => (
                <RowActions>
                    {reorderable && <MoveButtons index={i} count={visible.length} onMove={reorder} label={`question ${i + 1}`} disabled={busy} />}
                    <IconButton icon={Pencil} label="Edit FAQ" onClick={() => setEditing(f)} />
                    <IconButton icon={Trash2} label="Delete FAQ" variant="danger" onClick={() => remove(f)} />
                </RowActions>
            ),
        },
    ];

    const uncategorised = counts.get(NO_CATEGORY) || 0;
    const categoryOptions = [
        { value: '', label: `All categories (${faqs.length})` },
        ...categories.map(c => ({ value: String(c.id), label: `${c.name} (${counts.get(c.id) || 0})` })),
        ...(uncategorised ? [{ value: NO_CATEGORY, label: `No category (${uncategorised})` }] : []),
    ];

    const empty = faqs.length === 0 ? (
        <EmptyState icon={HelpCircle} title="No FAQs yet" action={<Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Add the first FAQ</Button>}>
            Questions you add here appear on the FAQ page.
        </EmptyState>
    ) : (
        <EmptyState icon={HelpCircle} title="No FAQs match" action={<Button onClick={() => setParam({ q: '', category: '', page: 1 })}>Clear filters</Button>}>
            Try another search or category.
        </EmptyState>
    );

    return (
        <Page>
            <PageHeader
                icon={HelpCircle}
                title="FAQs"
                subtitle="Questions and answers on the FAQ page, grouped by category."
                actions={(
                    <>
                        <Button icon={ExternalLink} href="/faq" target="_blank" rel="noreferrer">View page</Button>
                        <Button variant="primary" icon={Plus} onClick={() => setEditing('new')} disabled={loading}>Add FAQ</Button>
                    </>
                )}
            />

            <StatGrid label="FAQ totals">
                <StatCard icon={HelpCircle} value={faqs.length} label="Questions" loading={loading} active={!category} onClick={() => setParam({ category: '', page: 1 })} />
                <StatCard icon={FolderOpen} value={categories.length} label="Categories" loading={loading} to="/admin/faq-categories" title="Manage categories" />
                <StatCard icon={AlertTriangle} value={uncategorised} label="No category" loading={loading} active={category === NO_CATEGORY} onClick={uncategorised ? () => setParam({ category: category === NO_CATEGORY ? '' : NO_CATEGORY, page: 1 }) : undefined} />
                <StatCard icon={Clock3} value={lastEdited ? compactDate(lastEdited) : '—'} label="Last edited" loading={loading} title={lastEdited ? shortDate(lastEdited) : undefined} />
            </StatGrid>

            <SearchInput block value={query} onChange={v => setParam({ q: v, page: 1 })} placeholder="Search questions and answers…" label="Search FAQs" />

            <Toolbar
                left={(
                    <Select
                        className="ac-toolbar-select"
                        aria-label="Filter by category"
                        value={category}
                        onChange={e => setParam({ category: e.target.value, page: 1 })}
                        options={categoryOptions}
                    />
                )}
                right={<Button icon={FolderOpen} to="/admin/faq-categories">Manage categories</Button>}
            />
            {reorderable && visible.length > 1 && (
                <p className="ac-hint-line">Use the arrows to set the order of the questions in <strong>{selectedCategory.name}</strong>. Changes save straight away.</p>
            )}

            {error ? (
                <Banner tone="error" action={<Button size="sm" onClick={load}>Try again</Button>}>Could not load the FAQs. {error}</Banner>
            ) : (
                <DataTable
                    caption="FAQs"
                    columns={columns}
                    rows={shown}
                    loading={loading}
                    skeletonRows={8}
                    empty={empty}
                    onRowClick={setEditing}
                    footer={!reorderable && !loading ? <Pager page={current} pageSize={PAGE_SIZE} total={visible.length} onChange={p => setParam({ page: p })} label="FAQs" /> : null}
                />
            )}

            {editing && (
                <FaqForm
                    faq={editing === 'new' ? null : editing}
                    categories={categories}
                    defaultCategoryId={selectedCategory ? String(selectedCategory.id) : ''}
                    nextPosition={nextPosition}
                    onClose={() => setEditing(null)}
                    onSaved={onSaved}
                />
            )}
            {confirmDialog}
        </Page>
    );
}
