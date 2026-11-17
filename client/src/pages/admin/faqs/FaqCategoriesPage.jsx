import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, FolderOpen, HelpCircle, Link2, ListOrdered, Pencil, Plus, Trash2 } from 'lucide-react';
import {
    Page, PageHeader, StatGrid, StatCard, Button, IconButton, DataTable, CellText, RowActions, EmptyState, Banner,
    useConfirm,
} from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { faqCategoriesService } from '../../../services/admin/faqs';
import MoveButtons from '../content/MoveButtons';
import { move } from '../content/list';
import { plural } from '../content/format';
import FaqCategoryForm from './FaqCategoryForm';
import '../content/content.css';
import './faqs.css';

/**
 * Admin > FAQ categories: the groups on the FAQ page, in page order (the
 * arrows reorder them and save straight away). A category that still has
 * questions cannot be deleted; its count links to those questions.
 */
export default function FaqCategoriesPage() {
    const toast = useToast();
    const navigate = useNavigate();
    const [confirm, confirmDialog] = useConfirm();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(null); // null | 'new' | category
    const [busy, setBusy] = useState(false);

    const fetchAll = useCallback(() => faqCategoriesService.list()
        .then(rows => { setCategories(rows || []); setError(''); })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false)), []);

    useEffect(() => { fetchAll(); }, [fetchAll]);
    const load = () => { setLoading(true); setError(''); fetchAll(); };

    const sorted = useMemo(() => [...categories].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.id - b.id), [categories]);
    const totalFaqs = useMemo(() => categories.reduce((sum, c) => sum + (c.faq_count || 0), 0), [categories]);
    const emptyCount = useMemo(() => categories.filter(c => !c.faq_count).length, [categories]);
    const nextPosition = 1 + Math.max(-1, ...categories.map(c => c.display_order ?? 0));

    const onSaved = (row) => {
        setCategories(prev => (prev.some(c => c.id === row.id)
            ? prev.map(c => (c.id === row.id ? { ...c, ...row } : c))
            : [...prev, { ...row, faq_count: 0 }]));
        setEditing(null);
    };

    const reorder = async (from, to) => {
        const next = move(sorted, from, to);
        if (next === sorted) return;
        const before = categories;
        setCategories(next.map((c, i) => ({ ...c, display_order: i })));
        setBusy(true);
        try {
            await faqCategoriesService.reorder(next.map(c => c.id));
        } catch (err) {
            setCategories(before);
            toast(`The new order was not saved. ${err.message}`, 'error');
        } finally { setBusy(false); }
    };

    const remove = async (cat) => {
        if (cat.faq_count > 0) {
            const show = await confirm({
                title: `“${cat.name}” still has ${plural(cat.faq_count, 'question')}`,
                message: 'Move them to another category or delete them first, then delete the category.',
                confirmLabel: 'Show its questions',
                cancelLabel: 'Close',
            });
            if (show) navigate(`/admin/faqs?category=${cat.id}`);
            return;
        }
        if (!(await confirm({ title: `Delete “${cat.name}”?`, message: 'It has no questions. This cannot be undone.', confirmLabel: 'Delete category', danger: true }))) return;
        try {
            await faqCategoriesService.remove(cat.id);
            setCategories(prev => prev.filter(c => c.id !== cat.id));
            toast(`Category “${cat.name}” deleted`, 'success');
        } catch (err) { toast(err.message, 'error'); }
    };

    const columns = [
        { key: 'name', header: 'Category', icon: FolderOpen, className: 'ac-td-lead', render: (c) => <CellText avatar={c.name} main={c.name} sub={c.description} /> },
        { key: 'slug', header: 'URL name', icon: Link2, hideBelow: 1100, render: (c) => <span className="ak-mono ac-faq-slug">{c.slug}</span> },
        {
            key: 'faqs', header: 'Questions', icon: HelpCircle, align: 'right', width: 140,
            render: (c) => (
                <Link className={`ac-faq-count${c.faq_count ? '' : ' is-zero'}`} to={`/admin/faqs?category=${c.id}`} onClick={e => e.stopPropagation()}>
                    {plural(c.faq_count || 0, 'question')}
                </Link>
            ),
        },
        {
            key: 'actions', header: 'Actions', actions: true,
            render: (c, i) => (
                <RowActions>
                    <MoveButtons index={i} count={sorted.length} onMove={reorder} label={c.name} disabled={busy} />
                    <IconButton icon={Pencil} label={`Edit ${c.name}`} onClick={() => setEditing(c)} />
                    <IconButton icon={Trash2} label={`Delete ${c.name}`} variant="danger" onClick={() => remove(c)} />
                </RowActions>
            ),
        },
    ];

    return (
        <Page>
            <PageHeader
                icon={FolderOpen}
                title="FAQ categories"
                subtitle="The groups on the FAQ page, in the order they show."
                actions={(
                    <>
                        <Button icon={ExternalLink} href="/faq" target="_blank" rel="noreferrer">View page</Button>
                        <Button variant="primary" icon={Plus} onClick={() => setEditing('new')} disabled={loading}>Add category</Button>
                    </>
                )}
            />

            <StatGrid label="Category totals">
                <StatCard icon={FolderOpen} value={categories.length} label="Categories" loading={loading} />
                <StatCard icon={HelpCircle} value={totalFaqs} label="Questions" loading={loading} to="/admin/faqs" />
                <StatCard icon={ListOrdered} value={emptyCount} label="Empty" loading={loading} title="Categories without questions are hidden on the FAQ page" />
            </StatGrid>

            {!loading && sorted.length > 1 && (
                <p className="ac-hint-line">Use the arrows to change the order on the FAQ page. Changes save straight away.</p>
            )}

            {error ? (
                <Banner tone="error" action={<Button size="sm" onClick={load}>Try again</Button>}>Could not load the categories. {error}</Banner>
            ) : (
                <DataTable
                    caption="FAQ categories"
                    columns={columns}
                    rows={sorted}
                    loading={loading}
                    skeletonRows={6}
                    onRowClick={setEditing}
                    empty={(
                        <EmptyState icon={FolderOpen} title="No categories yet" action={<Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Add a category</Button>}>
                            Add categories to group the questions on the FAQ page.
                        </EmptyState>
                    )}
                />
            )}

            {editing && (
                <FaqCategoryForm
                    category={editing === 'new' ? null : editing}
                    nextPosition={nextPosition}
                    onClose={() => setEditing(null)}
                    onSaved={onSaved}
                />
            )}
            {confirmDialog}
        </Page>
    );
}
