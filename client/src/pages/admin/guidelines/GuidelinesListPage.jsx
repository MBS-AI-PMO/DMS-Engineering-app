import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CircleCheck, Clock3, ExternalLink, FileText, Layers, ListChecks, Pencil, Plus, Wrench } from 'lucide-react';
import {
    Page, PageHeader, StatGrid, StatCard, SearchInput, Toolbar, Tabs, Button, DataTable, CellText, RowActions, Pill,
    EmptyState, Banner,
} from '../../../components/admin/ui';
import { guidelinesService } from '../../../services/admin/guidelines';
import { compactDate, plural, shortDate } from '../content/format';
import '../content/content.css';
import './guidelines.css';

/**
 * Admin > Guidelines: every service, with or without design guidelines.
 * Services that have them are on the public Design guidelines page; the
 * others can be set up from here. A row opens the editor.
 */

const FILTERS = { all: 'All services', published: 'Published', missing: 'Not set up' };

export default function GuidelinesListPage() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const filter = FILTERS[params.get('show')] ? params.get('show') : 'all';
    const query = params.get('q') || '';

    const [guidelines, setGuidelines] = useState([]);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const setParam = (key, value) => setParams(prev => {
        const next = new URLSearchParams(prev);
        if (!value || (key === 'show' && value === 'all')) next.delete(key); else next.set(key, value);
        return next;
    }, { replace: true });

    const fetchAll = useCallback(() => Promise.all([guidelinesService.list(), guidelinesService.services().catch(() => [])])
        .then(([g, s]) => { setGuidelines(g || []); setServices(s || []); setError(''); })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false)), []);

    useEffect(() => { fetchAll(); }, [fetchAll]);
    const load = () => { setLoading(true); setError(''); fetchAll(); };

    // One row per service; guidelines whose service is not listed are kept too.
    const rows = useMemo(() => {
        const byService = new Map(guidelines.map(g => [g.service_id, g]));
        const list = services.map(s => ({ serviceId: s.id, service: s, guideline: byService.get(s.id) || null }));
        guidelines.filter(g => !services.some(s => s.id === g.service_id))
            .forEach(g => list.push({ serviceId: g.service_id, service: null, guideline: g }));
        return list;
    }, [guidelines, services]);

    const published = rows.filter(r => r.guideline).length;
    const missing = rows.length - published;
    const materials = useMemo(() => {
        const names = new Set();
        guidelines.forEach(g => (Array.isArray(g.tables) ? g.tables : []).forEach(t => t?.material && names.add(String(t.material).trim().toLowerCase())));
        return names.size;
    }, [guidelines]);
    const lastSaved = useMemo(() => {
        const times = guidelines.map(g => Date.parse(g.updated_at || g.created_at)).filter(Number.isFinite);
        return times.length ? new Date(Math.max(...times)) : null;
    }, [guidelines]);

    const needle = query.trim().toLowerCase();
    const visible = rows.filter(r => {
        if (filter === 'published' && !r.guideline) return false;
        if (filter === 'missing' && r.guideline) return false;
        if (!needle) return true;
        return [r.service?.title, r.guideline?.title].some(t => t && t.toLowerCase().includes(needle));
    });

    const open = (row) => navigate(`/admin/guidelines/${row.serviceId}`);

    const columns = [
        {
            key: 'service', header: 'Service', icon: Wrench, className: 'ac-td-lead',
            render: (r) => (
                <CellText
                    avatar={r.guideline?.title || r.service?.title || '?'}
                    main={r.guideline?.title || r.service?.title || `Service ${r.serviceId}`}
                    sub={[
                        r.service && r.guideline && r.service.title !== r.guideline.title ? r.service.title : null,
                        r.service && r.service.is_active === false ? 'Hidden service' : null,
                        !r.service ? 'Service not found' : null,
                    ].filter(Boolean).join(' · ') || null}
                />
            ),
        },
        {
            key: 'status', header: 'Status', icon: CircleCheck, width: 150,
            render: (r) => (r.guideline ? <Pill tone="green" dot>Published</Pill> : <Pill tone="gray" dot>Not set up</Pill>),
        },
        {
            key: 'requirements', header: 'Requirements', icon: ListChecks, hideBelow: 1100, width: 160,
            render: (r) => (r.guideline ? plural(Array.isArray(r.guideline.requirements) ? r.guideline.requirements.length : 0, 'item') : '—'),
        },
        {
            key: 'materials', header: 'Size tables', icon: Layers, hideBelow: 860,
            render: (r) => {
                const tables = Array.isArray(r.guideline?.tables) ? r.guideline.tables : [];
                if (!r.guideline) return '—';
                return <CellText main={plural(tables.length, 'material')} sub={<span className="ak-ellipsis">{tables.map(t => t?.material).filter(Boolean).join(', ')}</span>} />;
            },
        },
        { key: 'updated', header: 'Last saved', icon: Clock3, hideBelow: 1280, width: 150, render: (r) => (r.guideline ? shortDate(r.guideline.updated_at || r.guideline.created_at) : '—') },
        {
            key: 'actions', header: 'Actions', actions: true,
            render: (r) => (
                <RowActions>
                    {r.guideline
                        ? <Button size="sm" icon={Pencil} to={`/admin/guidelines/${r.serviceId}`}>Edit</Button>
                        : <Button size="sm" icon={Plus} to={`/admin/guidelines/${r.serviceId}`}>Set up</Button>}
                </RowActions>
            ),
        },
    ];

    return (
        <Page>
            <PageHeader
                icon={FileText}
                title="Guidelines"
                subtitle="Requirements and size limits on the Design guidelines page, one set per service."
                actions={<Button icon={ExternalLink} href="/guidelines" target="_blank" rel="noreferrer">View page</Button>}
            />

            <StatGrid label="Guidelines totals">
                <StatCard icon={FileText} value={published} label="Published" loading={loading} active={filter === 'published'} onClick={() => setParam('show', filter === 'published' ? 'all' : 'published')} />
                <StatCard icon={AlertTriangle} value={missing} label="Not set up" loading={loading} active={filter === 'missing'} onClick={() => setParam('show', filter === 'missing' ? 'all' : 'missing')} />
                <StatCard icon={Layers} value={materials} label="Materials" loading={loading} />
                <StatCard icon={Clock3} value={lastSaved ? compactDate(lastSaved) : '—'} label="Last saved" loading={loading} title={lastSaved ? shortDate(lastSaved) : undefined} />
            </StatGrid>

            <SearchInput block value={query} onChange={v => setParam('q', v)} placeholder="Search services…" label="Search guidelines" />
            <Toolbar
                left={(
                    <Tabs
                        label="Show"
                        value={filter}
                        onChange={v => setParam('show', v)}
                        items={[
                            { value: 'all', label: FILTERS.all, count: rows.length },
                            { value: 'published', label: FILTERS.published, count: published, dot: 'green' },
                            { value: 'missing', label: FILTERS.missing, count: missing, dot: 'gray' },
                        ]}
                    />
                )}
            />

            {error ? (
                <Banner tone="error" action={<Button size="sm" onClick={load}>Try again</Button>}>Could not load the guidelines. {error}</Banner>
            ) : (
                <DataTable
                    caption="Guidelines by service"
                    columns={columns}
                    rows={visible}
                    rowKey="serviceId"
                    loading={loading}
                    skeletonRows={6}
                    onRowClick={open}
                    empty={(
                        <EmptyState icon={FileText} title={rows.length ? 'Nothing matches' : 'No services yet'} action={rows.length ? <Button onClick={() => setParams({}, { replace: true })}>Clear filters</Button> : <Button to="/admin/services">Go to services</Button>}>
                            {rows.length ? 'Try another search or filter.' : 'Guidelines belong to a service. Add services first.'}
                        </EmptyState>
                    )}
                />
            )}
        </Page>
    );
}
