import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CornerDownRight, Eye, EyeOff, FileText, Hash, Layers, Pencil, Plus, Search, Tag, Wrench, Zap } from 'lucide-react';
import {
    Page, PageHeader, StatGrid, StatCard, Toolbar, Tabs, SearchInput, Button, IconButton, DataTable, CellText, RowActions,
    Switch, Pill, EmptyState, Banner,
} from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { servicesService } from '../../../services/admin/services';
import { flattenTree, searchTree, serviceType } from './serviceTree';
import '../catalog/catalog.css';

const TYPE_PILL = {
    main: <Pill tone="red">Main</Pill>,
    sub: <Pill tone="blue">Sub-service</Pill>,
    standard: <Pill>Standard</Pill>,
};

/**
 * Admin > Services: every service as a tree (main production services with
 * their sub-services). Search, filter by type or visibility, show / hide a
 * service from its row, and open its editor, metals or guidelines.
 */
export default function ServicesListPage() {
    const toast = useToast();
    const navigate = useNavigate();
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(() => {
        setLoading(true);
        setError('');
        return servicesService.listWithUsage()
            .catch(() => servicesService.list())
            .then(rows => setServices(rows || []))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const counts = useMemo(() => ({
        all: services.length,
        main: services.filter(s => s.is_production).length,
        sub: services.filter(s => serviceType(s) === 'sub').length,
        hidden: services.filter(s => s.is_active === false).length,
    }), [services]);

    const rows = useMemo(() => {
        if (filter === 'all') return query ? searchTree(services, query) : flattenTree(services);
        const needle = query.trim().toLowerCase();
        return services
            .filter(s => (filter === 'hidden' ? s.is_active === false : serviceType(s) === filter))
            .filter(s => !needle || [s.title, s.description, s.slug].some(v => v && v.toLowerCase().includes(needle)))
            .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
            .map(s => ({ ...s, depth: 0, rowKey: `flat/${s.id}` }));
    }, [services, query, filter]);

    const setActive = async (service, on) => {
        setBusyId(service.id);
        try {
            await servicesService.setActive(service.id, on);
            setServices(prev => prev.map(s => (Number(s.id) === Number(service.id) ? { ...s, is_active: on } : s)));
            toast(on ? `${service.title} is visible on the website` : `${service.title} is hidden from the website`, 'success');
        } catch (err) {
            toast(`Could not change it: ${err.message}`, 'error');
        } finally {
            setBusyId(null);
        }
    };

    const columns = [
        {
            key: 'title', header: 'Service', icon: Wrench,
            render: (s) => (
                <span className="cat-tree-cell" style={{ '--depth': s.depth }}>
                    {s.depth > 0 && <CornerDownRight size={14} className="cat-tree-mark" aria-hidden="true" />}
                    <CellText thumb={s.image_path || null} main={s.title} sub={s.description ? <span className="ak-ellipsis">{s.description}</span> : `/service/${s.slug}`} />
                </span>
            ),
        },
        { key: 'type', header: 'Type', icon: Tag, render: (s) => TYPE_PILL[serviceType(s)] },
        {
            key: 'metals', header: 'Metals', icon: Box, align: 'right', hideBelow: 1100,
            render: (s) => (s.metal_count === undefined || s.metal_count === null ? '—' : Number(s.metal_count)),
        },
        { key: 'order', header: 'Order', icon: Hash, align: 'right', hideBelow: 1280, render: (s) => s.display_order },
        {
            key: 'visible', header: 'Visible', icon: Eye,
            render: (s) => (
                <RowActions>
                    <Switch
                        label={<span className="ak-sr">{`Show ${s.title} on the website`}</span>}
                        checked={s.is_active !== false}
                        disabled={busyId === s.id}
                        onChange={on => setActive(s, on)}
                    />
                </RowActions>
            ),
        },
        {
            key: 'actions', actions: true,
            render: (s) => (
                <RowActions>
                    <IconButton icon={Layers} label={`Metals for ${s.title}`} to={`/admin/services/${s.id}/metals`} />
                    <IconButton icon={FileText} label={`Guidelines for ${s.title}`} to={`/admin/guidelines/${s.id}`} />
                    <IconButton icon={Pencil} label={`Edit ${s.title}`} to={`/admin/services/${s.id}`} />
                </RowActions>
            ),
        },
    ];

    return (
        <Page>
            <PageHeader
                icon={Wrench}
                title="Services"
                subtitle="Production methods and the finishing services offered with them. Prices are set in Costing."
                actions={<Button variant="primary" icon={Plus} to="/admin/services/new">Add service</Button>}
            />

            <StatGrid label="Services summary">
                <StatCard icon={Wrench} value={counts.all} label="Services" loading={loading} active={filter === 'all'} onClick={() => setFilter('all')} />
                <StatCard icon={Zap} value={counts.main} label="Main production" loading={loading} active={filter === 'main'} onClick={() => setFilter('main')} />
                <StatCard icon={Layers} value={counts.sub} label="Sub-services" loading={loading} active={filter === 'sub'} onClick={() => setFilter('sub')} />
                <StatCard icon={EyeOff} value={counts.hidden} label="Hidden" loading={loading} active={filter === 'hidden'} onClick={() => setFilter('hidden')} />
            </StatGrid>

            {error && <Banner tone="error" action={<Button size="sm" onClick={load}>Try again</Button>}>Could not load the services. {error}</Banner>}

            <SearchInput block value={query} onChange={setQuery} placeholder="Search services…" label="Search services" />
            <Toolbar
                left={(
                    <Tabs
                        label="Show"
                        value={filter}
                        onChange={setFilter}
                        items={[
                            { value: 'all', label: 'All', count: counts.all },
                            { value: 'main', label: 'Main production', count: counts.main },
                            { value: 'sub', label: 'Sub-services', count: counts.sub },
                            { value: 'hidden', label: 'Hidden', count: counts.hidden },
                        ]}
                    />
                )}
                right={filter === 'all' && !loading ? <span className="cat-muted">Sub-services are listed under each main service</span> : undefined}
            />

            <DataTable
                caption="Services"
                columns={columns}
                rows={rows}
                rowKey="rowKey"
                loading={loading}
                skeletonRows={8}
                onRowClick={(s) => navigate(`/admin/services/${s.id}`)}
                empty={query || filter !== 'all' ? (
                    <EmptyState icon={Search} title="No services match" action={<Button size="sm" onClick={() => { setQuery(''); setFilter('all'); }}>Show all</Button>} />
                ) : (
                    <EmptyState icon={Wrench} title="No services yet" action={<Button size="sm" variant="primary" icon={Plus} to="/admin/services/new">Add service</Button>}>
                        Start with a main production service such as Laser Cutting.
                    </EmptyState>
                )}
            />
        </Page>
    );
}
