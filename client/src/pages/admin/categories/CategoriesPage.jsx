import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Box, FileText, Hash, Pencil, Plus, Search, Tag, Trash2 } from 'lucide-react';
import {
    Page, PageHeader, StatGrid, StatCard, SearchInput, Button, IconButton, DataTable, CellText, RowActions,
    EmptyState, Banner, useConfirm,
} from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { categoriesService } from '../../../services/admin/categories';
import CategoryDialog from './CategoryDialog';
import '../catalog/catalog.css';

/**
 * Admin > Categories: the groups metals are listed under (Aluminum, Steel…).
 * Add / edit in a dialog; a category can only be deleted once no metal uses it.
 */
export default function CategoriesPage() {
    const toast = useToast();
    const navigate = useNavigate();
    const [confirm, confirmDialog] = useConfirm();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState(null); // null | 'new' | category
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(() => {
        setLoading(true);
        setError('');
        return categoriesService.list()
            .then(rows => setCategories(rows || []))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);
    const closeDialog = useCallback(() => setEditing(null), []);

    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return needle ? categories.filter(c => [c.name, c.slug, c.description].some(v => v && v.toLowerCase().includes(needle))) : categories;
    }, [categories, query]);
    const metalTotal = categories.reduce((n, c) => n + (c.metal_count || 0), 0);
    const emptyCount = categories.filter(c => !c.metal_count).length;

    const save = async (form) => {
        setSaving(true);
        try {
            if (editing === 'new') {
                await categoriesService.create(form);
                toast(`${form.name} added`, 'success');
            } else {
                await categoriesService.update(editing.id, form);
                toast(`${form.name} saved`, 'success');
            }
            setEditing(null);
            load();
        } catch (err) {
            toast(`Could not save: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const remove = async (category) => {
        if (category.metal_count > 0) {
            const show = await confirm({
                title: `${category.name} is in use`,
                message: `${category.metal_count} ${category.metal_count === 1 ? 'metal uses' : 'metals use'} this category. Move ${category.metal_count === 1 ? 'it' : 'them'} to another category first, then delete it.`,
                confirmLabel: 'Show its metals',
                cancelLabel: 'Close',
            });
            if (show) navigate(`/admin/metals?category=${category.id}`);
            return;
        }
        if (!(await confirm({ title: `Delete ${category.name}?`, message: 'This cannot be undone.', confirmLabel: 'Delete category', danger: true }))) return;
        setBusyId(category.id);
        try {
            await categoriesService.remove(category.id);
            setCategories(prev => prev.filter(c => c.id !== category.id));
            toast(`${category.name} deleted`, 'success');
        } catch (err) {
            toast(`Could not delete: ${err.message}`, 'error');
        } finally {
            setBusyId(null);
        }
    };

    const columns = [
        { key: 'name', header: 'Category', icon: Tag, render: (c) => <CellText avatar={c.name} main={c.name} sub={c.slug} /> },
        { key: 'description', header: 'Description', icon: FileText, hideBelow: 1100, render: (c) => (c.description ? <span className="ak-ellipsis" title={c.description}>{c.description}</span> : <span className="cat-muted">None</span>) },
        {
            key: 'metals', header: 'Metals', icon: Box, align: 'right',
            render: (c) => (c.metal_count ? <Link className="ak-link" to={`/admin/metals?category=${c.id}`} onClick={e => e.stopPropagation()}>{c.metal_count}</Link> : <span className="cat-muted">0</span>),
        },
        { key: 'order', header: 'Order', icon: Hash, align: 'right', hideBelow: 860, render: (c) => c.display_order },
        {
            key: 'actions', actions: true,
            render: (c) => (
                <RowActions>
                    <IconButton icon={Pencil} label={`Edit ${c.name}`} onClick={() => setEditing(c)} />
                    <IconButton icon={Trash2} label={`Delete ${c.name}`} variant="danger" loading={busyId === c.id} onClick={() => remove(c)} />
                </RowActions>
            ),
        },
    ];

    return (
        <Page>
            <PageHeader
                icon={Tag}
                title="Categories"
                subtitle="The groups metals are listed under on the website and in the quote flow."
                actions={<Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Add category</Button>}
            />

            <StatGrid label="Categories summary">
                <StatCard icon={Tag} value={categories.length} label="Categories" loading={loading} />
                <StatCard icon={Box} value={metalTotal} label="Metals in them" loading={loading} to="/admin/metals" />
                <StatCard icon={Hash} value={emptyCount} label="Without metals" loading={loading} />
            </StatGrid>

            {error && <Banner tone="error" action={<Button size="sm" onClick={load}>Try again</Button>}>Could not load the categories. {error}</Banner>}

            <SearchInput block value={query} onChange={setQuery} placeholder="Search categories…" label="Search categories" />

            <DataTable
                caption="Metal categories"
                columns={columns}
                rows={visible}
                loading={loading}
                skeletonRows={4}
                onRowClick={(c) => setEditing(c)}
                empty={query ? (
                    <EmptyState icon={Search} title="No categories match" action={<Button size="sm" onClick={() => setQuery('')}>Clear search</Button>} />
                ) : (
                    <EmptyState icon={Tag} title="No categories yet" action={<Button size="sm" variant="primary" icon={Plus} onClick={() => setEditing('new')}>Add category</Button>}>
                        Categories group metals, e.g. Aluminum or Stainless Steel.
                    </EmptyState>
                )}
            />

            {editing && <CategoryDialog category={editing === 'new' ? null : editing} saving={saving} onSave={save} onClose={closeDialog} />}
            {confirmDialog}
        </Page>
    );
}
