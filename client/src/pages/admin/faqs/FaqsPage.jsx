import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, HelpCircle, LayoutGrid, List, Plus } from 'lucide-react';
import { Page, PageHeader, Segmented, Button, useConfirm } from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { faqCategoriesService, faqPagesService, faqsService } from '../../../services/admin/faqs';
import { displayMetalName } from '../../../utils/metalDisplay';
import { countByPage, snippet } from './faqPages';
import { useUrlParams } from './useUrlParams';
import FaqForm from './FaqForm';
import FaqListView from './FaqListView';
import FaqPagesView from './FaqPagesView';
import '../content/content.css';
import './faqs.css';

/**
 * Admin > FAQs. Two views (?view=pages for the second):
 *   All FAQs   every question on the FAQ page: search, filters, order, edit
 *   On pages   pick a page of the site and set which FAQs show on it, in order
 * Both share the FAQ list, the categories, the page list and the edit dialog.
 */

const VIEW_PAGES = 'pages';

export default function FaqsPage() {
    const toast = useToast();
    const [confirm, confirmDialog] = useConfirm();
    const [params, setParam] = useUrlParams();
    const view = params.get('view') === VIEW_PAGES ? VIEW_PAGES : 'list';
    const category = params.get('category') || '';

    const [faqs, setFaqs] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pages, setPages] = useState({ list: [], loading: true, error: '' });
    const [editing, setEditing] = useState(null); // null | 'new' | { pages } (new, on a page) | faq row

    const fetchAll = useCallback(() => Promise.all([faqsService.list(), faqCategoriesService.list()])
        .then(([f, c]) => { setFaqs(f || []); setCategories(c || []); setError(''); })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false)), []);
    // Metal names are stored in capitals; show them as the public site does.
    const fetchPages = useCallback(() => faqPagesService.list()
        .then(list => setPages({
            list: (list || []).map(p => (p.group === 'metal' && !p.wildcard ? { ...p, label: displayMetalName(p.label) } : p)),
            loading: false,
            error: '',
        }))
        .catch(err => setPages({ list: [], loading: false, error: err.message })), []);

    useEffect(() => { fetchAll(); fetchPages(); }, [fetchAll, fetchPages]);
    const load = () => { setLoading(true); setError(''); fetchAll(); };
    const reloadPages = useCallback(() => { setPages(p => ({ ...p, loading: true, error: '' })); fetchPages(); }, [fetchPages]);
    const pagesState = useMemo(() => ({ ...pages, reload: reloadPages }), [pages, reloadPages]);

    const categoryById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
    const pageCounts = useMemo(() => countByPage(faqs), [faqs]);
    const placedCount = useMemo(() => faqs.filter(f => f.pages?.length).length, [faqs]);
    const selectedCategory = category && category !== 'none' ? categoryById.get(Number(category)) : null;

    const nextPosition = (categoryId) => 1 + Math.max(0, ...faqs.filter(f => (f.category_id ?? null) === categoryId).map(f => f.display_order || 0));

    const onSaved = (row) => {
        const cat = categoryById.get(row.category_id);
        const full = { ...row, category_name: cat?.name || null, category_slug: cat?.slug || null };
        setFaqs(prev => (prev.some(f => f.id === row.id) ? prev.map(f => (f.id === row.id ? full : f)) : [...prev, full]));
        setEditing(null);
    };

    /* The page view changed which FAQs are on `key`: keep each FAQ's `pages` in step. */
    const onPlaced = useCallback((key, ids) => {
        const on = new Set(ids);
        setFaqs(prev => prev.map(f => {
            const has = (f.pages || []).includes(key);
            if (has === on.has(f.id)) return f;
            return { ...f, pages: has ? f.pages.filter(k => k !== key) : [...(f.pages || []), key].sort() };
        }));
    }, []);

    const remove = async (faq) => {
        const count = faq.pages?.length || 0;
        const where = faq.show_on_faq_page === false
            ? `is removed from the ${count === 1 ? 'page' : `${count} pages`} it shows on.`
            : `is removed from the FAQ page${count ? ` and from the ${count === 1 ? 'other page' : `${count} other pages`} it shows on` : ''}.`;
        const yes = await confirm({
            title: 'Delete this FAQ?',
            message: `“${snippet(faq.question, 120)}” ${where} This cannot be undone.`,
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

    const isNew = editing === 'new' || Boolean(editing && !editing.id);
    return (
        <Page>
            <PageHeader
                icon={HelpCircle}
                title="FAQs"
                subtitle="Questions and answers for the FAQ page and for any other page of the site."
                actions={(
                    <>
                        <Button icon={ExternalLink} href="/faq" target="_blank" rel="noreferrer">View page</Button>
                        <Button variant="primary" icon={Plus} onClick={() => setEditing('new')} disabled={loading}>Add FAQ</Button>
                    </>
                )}
            />

            <nav className="ac-faq-views" aria-label="FAQ views">
                <Segmented
                    label="FAQ views"
                    value={view}
                    onChange={v => setParam({ view: v === VIEW_PAGES ? VIEW_PAGES : '' })}
                    items={[
                        { value: 'list', label: 'All FAQs', icon: List, count: loading ? undefined : faqs.length },
                        { value: VIEW_PAGES, label: 'On pages', icon: LayoutGrid, count: loading ? undefined : placedCount },
                    ]}
                />
            </nav>

            {view === VIEW_PAGES ? (
                <FaqPagesView
                    faqs={faqs}
                    categories={categories}
                    pages={pagesState}
                    pageCounts={pageCounts}
                    loading={loading}
                    error={error}
                    onRetry={load}
                    onPlaced={onPlaced}
                    onEdit={setEditing}
                    onCreate={(key) => setEditing({ pages: [key] })}
                />
            ) : (
                <FaqListView
                    faqs={faqs}
                    setFaqs={setFaqs}
                    categories={categories}
                    pages={pages.list}
                    pageCounts={pageCounts}
                    loading={loading}
                    error={error}
                    onRetry={load}
                    onAdd={() => setEditing('new')}
                    onEdit={setEditing}
                    onRemove={remove}
                />
            )}

            {editing && (
                <FaqForm
                    faq={isNew ? null : editing}
                    categories={categories}
                    defaultCategoryId={selectedCategory ? String(selectedCategory.id) : ''}
                    defaultPages={editing.pages && !editing.id ? editing.pages : []}
                    nextPosition={nextPosition}
                    pages={pagesState}
                    onClose={() => setEditing(null)}
                    onSaved={onSaved}
                />
            )}
            {confirmDialog}
        </Page>
    );
}
