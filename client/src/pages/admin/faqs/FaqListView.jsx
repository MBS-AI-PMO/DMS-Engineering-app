import { useMemo, useState } from 'react';
import {
    AlertTriangle, Clock3, EyeOff, FolderOpen, Hash, HelpCircle, LayoutGrid, MessageSquare, Pencil, Plus, Trash2,
} from 'lucide-react';
import {
    StatGrid, StatCard, Toolbar, SearchInput, Select, Button, IconButton, DataTable, CellText, RowActions, Pill,
    EmptyState, Banner,
} from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { faqsService } from '../../../services/admin/faqs';
import MoveButtons from '../content/MoveButtons';
import Pager from '../content/Pager';
import { move } from '../content/list';
import { compactDate, shortDate } from '../content/format';
import { PAGE_GROUPS, pageLabel, snippet } from './faqPages';
import { useUrlParams } from './useUrlParams';

/**
 * Admin > FAQs, "All FAQs": every question, those on the FAQ page and the
 * page-only ones (written for other pages, left off the FAQ page). Filter by
 * category, by where it is shown, or search; with one category picked (and
 * no other filter) the arrows set the order the questions show in. A row
 * opens it for editing. Filters live in the address (?category=<id>|none,
 * ?shown=<page key>|faq|pageonly|any, ?q=, ?page=) so "back" returns to them.
 */

const PAGE_SIZE = 25;
const NO_CATEGORY = 'none';
const ON_ANY_PAGE = 'any';
const ON_FAQ_PAGE = 'faq';
const PAGE_ONLY = 'pageonly';
const PAGES_SHOWN = 2;

const onFaqPage = (f) => f.show_on_faq_page !== false;
const SHOWN_FILTERS = {
    [ON_ANY_PAGE]: (f) => (f.pages || []).length > 0,
    [ON_FAQ_PAGE]: onFaqPage,
    [PAGE_ONLY]: (f) => !onFaqPage(f),
};

export default function FaqListView({ faqs, setFaqs, categories, pages, pageCounts, loading, error, onRetry, onAdd, onEdit, onRemove }) {
    const toast = useToast();
    const [params, setParam] = useUrlParams();
    const category = params.get('category') || '';
    const shown = params.get('shown') || '';
    const query = params.get('q') || '';
    const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
    const [busy, setBusy] = useState(false);

    const categoryById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
    const pageByKey = useMemo(() => new Map(pages.map(p => [p.key, p])), [pages]);

    // The FAQ page's order: category order, then position, then id.
    const sorted = useMemo(() => {
        const rank = (f) => categoryById.get(f.category_id)?.display_order ?? Number.MAX_SAFE_INTEGER;
        return [...faqs].sort((a, b) => rank(a) - rank(b) || (a.display_order ?? 0) - (b.display_order ?? 0) || a.id - b.id);
    }, [faqs, categoryById]);

    const counts = useMemo(() => {
        const map = new Map();
        // "No category" means an FAQ-page question missing its topic; page-only ones need none.
        faqs.forEach(f => { const k = f.category_id ?? (onFaqPage(f) ? NO_CATEGORY : PAGE_ONLY); map.set(k, (map.get(k) || 0) + 1); });
        return map;
    }, [faqs]);
    const placedCount = useMemo(() => faqs.filter(SHOWN_FILTERS[ON_ANY_PAGE]).length, [faqs]);
    const pageOnlyCount = useMemo(() => faqs.filter(SHOWN_FILTERS[PAGE_ONLY]).length, [faqs]);

    const lastEdited = useMemo(() => {
        const times = faqs.map(f => Date.parse(f.updated_at || f.created_at)).filter(Number.isFinite);
        return times.length ? new Date(Math.max(...times)) : null;
    }, [faqs]);

    const needle = query.trim().toLowerCase();
    const visible = useMemo(() => sorted.filter(f => {
        if (category === NO_CATEGORY ? f.category_id != null || !onFaqPage(f) : category && String(f.category_id) !== category) return false;
        if (shown && !(SHOWN_FILTERS[shown] ? SHOWN_FILTERS[shown](f) : (f.pages || []).includes(shown))) return false;
        return !needle || f.question.toLowerCase().includes(needle) || String(f.answer || '').toLowerCase().includes(needle);
    }), [sorted, category, shown, needle]);

    const selectedCategory = category && category !== NO_CATEGORY ? categoryById.get(Number(category)) : null;
    const reorderable = Boolean(selectedCategory) && !needle && !shown;
    const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const current = Math.min(page, pageCount);
    const rows = reorderable ? visible : visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

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

    const pagesCell = (f) => {
        const on = f.pages || [];
        if (!on.length) return <span className="ac-faq-none">{onFaqPage(f) ? 'FAQ page only' : 'Nowhere yet'}</span>;
        const names = on.map(key => pageLabel(key, pageByKey));
        return (
            <span className="ac-faq-pages-cell" title={names.join(', ')}>
                {names.slice(0, PAGES_SHOWN).map((name, i) => <Pill key={on[i]} tone={pageByKey.get(on[i])?.missing ? 'amber' : 'blue'}>{name}</Pill>)}
                {on.length > PAGES_SHOWN && <Pill tone="gray">+{on.length - PAGES_SHOWN}</Pill>}
            </span>
        );
    };

    const columns = [
        { key: 'question', header: 'Question', icon: MessageSquare, className: 'ac-td-lead', render: (f) => <CellText main={f.question} sub={snippet(f.answer)} /> },
        ...(selectedCategory ? [] : [{
            key: 'category', header: 'Category', icon: FolderOpen, hideBelow: 860, width: 190,
            render: (f) => (!onFaqPage(f) ? <Pill tone="violet" title="Not on the FAQ page: only on the pages it is placed on">Page-only</Pill>
                : f.category_id != null
                    ? <Pill tone="gray">{categoryById.get(f.category_id)?.name || f.category_name || 'Unknown'}</Pill>
                    : <Pill tone="amber">No category</Pill>),
        }]),
        { key: 'pages', header: 'Also on', icon: LayoutGrid, width: 230, render: pagesCell },
        { key: 'position', header: 'Position', icon: Hash, align: 'right', width: 100, hideBelow: 1280, render: (f) => f.display_order ?? '—' },
        {
            key: 'actions', header: 'Actions', actions: true,
            render: (f, i) => (
                <RowActions>
                    {reorderable && <MoveButtons index={i} count={visible.length} onMove={reorder} label={`question ${i + 1}`} disabled={busy} />}
                    <IconButton icon={Pencil} label="Edit FAQ" onClick={() => onEdit(f)} />
                    <IconButton icon={Trash2} label="Delete FAQ" variant="danger" onClick={() => onRemove(f)} />
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
    const groupLabel = new Map(PAGE_GROUPS.map(g => [g.id, g.label]));
    const pageOptions = [
        { value: '', label: 'Any page' },
        { value: ON_FAQ_PAGE, label: `On the FAQ page (${faqs.length - pageOnlyCount})` },
        { value: PAGE_ONLY, label: `Page-only, not on the FAQ page (${pageOnlyCount})` },
        { value: ON_ANY_PAGE, label: `On other pages (${placedCount})` },
        ...pages.map(p => ({ value: p.key, label: `${p.label} (${pageCounts.get(p.key) || 0})`, group: groupLabel.get(p.group) })),
    ];

    const filtered = Boolean(needle || category || shown);
    const empty = faqs.length === 0 ? (
        <EmptyState icon={HelpCircle} title="No FAQs yet" action={<Button variant="primary" icon={Plus} onClick={onAdd}>Add the first FAQ</Button>}>
            Questions you add here appear on the FAQ page.
        </EmptyState>
    ) : (
        <EmptyState icon={HelpCircle} title="No FAQs match" action={filtered ? <Button onClick={() => setParam({ q: '', category: '', shown: '', page: 1 })}>Clear filters</Button> : null}>
            Try another search, category or page.
        </EmptyState>
    );

    return (
        <>
            <div className="ac-faq-stats">
                <StatGrid label="FAQ totals">
                    <StatCard icon={HelpCircle} value={faqs.length} label="Questions" loading={loading} active={!category && !shown} onClick={() => setParam({ category: '', shown: '', page: 1 })} />
                    <StatCard icon={FolderOpen} value={categories.length} label="Categories" loading={loading} to="/admin/faq-categories" title="Manage categories" />
                    <StatCard icon={LayoutGrid} value={placedCount} label="On other pages" loading={loading} active={shown === ON_ANY_PAGE} onClick={() => setParam({ shown: shown === ON_ANY_PAGE ? '' : ON_ANY_PAGE, page: 1 })} />
                    <StatCard icon={EyeOff} value={pageOnlyCount} label="Page-only" loading={loading} title="Not on the FAQ page: only on the pages they are placed on" active={shown === PAGE_ONLY} onClick={() => setParam({ shown: shown === PAGE_ONLY ? '' : PAGE_ONLY, page: 1 })} />
                    <StatCard icon={AlertTriangle} value={uncategorised} label="No category" loading={loading} active={category === NO_CATEGORY} onClick={uncategorised ? () => setParam({ category: category === NO_CATEGORY ? '' : NO_CATEGORY, page: 1 }) : undefined} />
                    <StatCard icon={Clock3} value={lastEdited ? compactDate(lastEdited) : '—'} label="Last edited" loading={loading} title={lastEdited ? shortDate(lastEdited) : undefined} />
                </StatGrid>
            </div>

            <SearchInput block value={query} onChange={v => setParam({ q: v, page: 1 })} placeholder="Search questions and answers…" label="Search FAQs" />

            <Toolbar
                left={(
                    <>
                        <Select
                            className="ac-toolbar-select"
                            aria-label="Filter by category"
                            value={category}
                            onChange={e => setParam({ category: e.target.value, page: 1 })}
                            options={categoryOptions}
                        />
                        <Select
                            className="ac-toolbar-select"
                            aria-label="Filter by page it shows on"
                            value={shown}
                            onChange={e => setParam({ shown: e.target.value, page: 1 })}
                            options={pageOptions}
                        />
                    </>
                )}
                right={<Button icon={FolderOpen} to="/admin/faq-categories">Manage categories</Button>}
            />
            {reorderable && visible.length > 1 && (
                <p className="ac-hint-line">Use the arrows to set the order of the questions in <strong>{selectedCategory.name}</strong>. Changes save straight away.</p>
            )}

            {error ? (
                <Banner tone="error" action={<Button size="sm" onClick={onRetry}>Try again</Button>}>Could not load the FAQs. {error}</Banner>
            ) : (
                <DataTable
                    caption="FAQs"
                    columns={columns}
                    rows={rows}
                    loading={loading}
                    skeletonRows={8}
                    empty={empty}
                    onRowClick={onEdit}
                    footer={!reorderable && !loading ? <Pager page={current} pageSize={PAGE_SIZE} total={visible.length} onChange={p => setParam({ page: p })} label="FAQs" /> : null}
                />
            )}
        </>
    );
}
