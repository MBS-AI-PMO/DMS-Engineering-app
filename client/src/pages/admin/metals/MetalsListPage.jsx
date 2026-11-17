import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, ExternalLink, Layers, Pencil, Plus, Ruler, Search, Tag, Trash2 } from 'lucide-react';
import {
    Page, PageHeader, StatGrid, StatCard, Toolbar, SearchInput, Tabs, Button, IconButton,
    DataTable, CellText, RowActions, EmptyState, Banner, Pill, useConfirm,
} from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { metalsService } from '../../../services/admin/metals';
import { categoriesService } from '../../../services/admin/categories';
import '../catalog/catalog.css';

/**
 * Admin > Metals: every metal in the catalog. Search by name or slug, filter
 * by category; a row opens the editor (/admin/metals/:slug).
 */
export default function MetalsListPage() {
    const toast = useToast();
    const navigate = useNavigate();
    const [confirm, confirmDialog] = useConfirm();
    const [metals, setMetals] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [params] = useSearchParams();
    const [category, setCategory] = useState(() => params.get('category') || '');
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(() => {
        setLoading(true);
        setError('');
        return Promise.all([metalsService.list(), categoriesService.list()])
            .then(([m, c]) => { setMetals(m || []); setCategories(c || []); })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return metals.filter(m => (!category || String(m.category_id) === category)
            && (!needle || [m.name, m.slug, m.category_name, m.thickness].some(v => v && String(v).toLowerCase().includes(needle))));
    }, [metals, query, category]);

    const thicknessCount = useMemo(() => metals.reduce((n, m) => n + (m.quick_look?.thicknesses?.length || 0), 0), [metals]);

    const remove = async (metal) => {
        const ok = await confirm({
            title: `Delete ${metal.name}?`,
            message: 'It disappears from the website and the quote page. Orders already placed keep their details. This cannot be undone.',
            confirmLabel: 'Delete metal',
            danger: true,
        });
        if (!ok) return;
        setBusyId(metal.id);
        try {
            await metalsService.remove(metal.id);
            setMetals(prev => prev.filter(m => m.id !== metal.id));
            toast(`${metal.name} deleted`, 'success');
        } catch (err) {
            toast(`Could not delete: ${err.message}`, 'error');
        } finally {
            setBusyId(null);
        }
    };

    const columns = [
        {
            key: 'name', header: 'Metal', icon: Box,
            render: (m) => <CellText thumb={m.image_path || null} main={m.name} sub={`/metal/${m.slug}`} />,
        },
        { key: 'category', header: 'Category', icon: Tag, render: (m) => (m.category_name ? <Pill>{m.category_name}</Pill> : <span className="cat-muted">None</span>) },
        {
            key: 'thickness', header: 'Thicknesses', icon: Ruler, hideBelow: 1100,
            render: (m) => <CellText main={`${m.quick_look?.thicknesses?.length || 0} on the quote page`} sub={m.thickness || undefined} />,
        },
        {
            key: 'services', header: 'Production', icon: Layers, align: 'right', hideBelow: 1280,
            render: (m) => (Array.isArray(m.services) ? m.services.length : 0),
        },
        {
            key: 'actions', actions: true,
            render: (m) => (
                <RowActions>
                    <IconButton icon={ExternalLink} label={`View ${m.name} on the website`} href={`/metal/${m.slug}`} target="_blank" rel="noreferrer" />
                    <IconButton icon={Pencil} label={`Edit ${m.name}`} to={`/admin/metals/${m.slug}`} />
                    <IconButton icon={Trash2} label={`Delete ${m.name}`} variant="danger" loading={busyId === m.id} onClick={() => remove(m)} />
                </RowActions>
            ),
        },
    ];

    const filtered = query || category;

    return (
        <Page>
            <PageHeader
                icon={Box}
                title="Metals"
                subtitle="The materials customers can choose, with their thicknesses, specs and FAQs."
                actions={<Button variant="primary" icon={Plus} to="/admin/metals/new">Add metal</Button>}
            />

            <StatGrid label="Catalog summary">
                <StatCard icon={Box} value={metals.length} label="Metals" loading={loading} />
                <StatCard icon={Tag} value={categories.length} label="Categories" loading={loading} to="/admin/categories" />
                <StatCard icon={Ruler} value={thicknessCount} label="Thickness options" loading={loading} />
            </StatGrid>

            {error && <Banner tone="error" action={<Button size="sm" onClick={load}>Try again</Button>}>Could not load the metals. {error}</Banner>}

            <SearchInput block value={query} onChange={setQuery} placeholder="Search by name, slug or thickness…" label="Search metals" />
            <Toolbar
                left={(
                    <Tabs
                        label="Category"
                        value={category}
                        onChange={setCategory}
                        items={[
                            { value: '', label: 'All', count: metals.length },
                            ...categories.map(c => ({ value: String(c.id), label: c.name, count: metals.filter(m => String(m.category_id) === String(c.id)).length })),
                        ]}
                    />
                )}
                right={<span className="cat-muted">{loading ? '' : `${visible.length} of ${metals.length} shown`}</span>}
            />

            <DataTable
                caption="Metals"
                columns={columns}
                rows={visible}
                loading={loading}
                onRowClick={(m) => navigate(`/admin/metals/${m.slug}`)}
                empty={filtered ? (
                    <EmptyState icon={Search} title="No metals match" action={<Button size="sm" onClick={() => { setQuery(''); setCategory(''); }}>Clear filters</Button>}>
                        Try another name, or show every category.
                    </EmptyState>
                ) : (
                    <EmptyState icon={Box} title="No metals yet" action={<Button variant="primary" size="sm" icon={Plus} to="/admin/metals/new">Add metal</Button>}>
                        Add the first material customers can order.
                    </EmptyState>
                )}
            />
            {confirmDialog}
        </Page>
    );
}
