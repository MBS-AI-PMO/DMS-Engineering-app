import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Box, CheckCircle2, Pencil, Ruler, Search, Wrench } from 'lucide-react';
import {
    Page, PageHeader, StatGrid, StatCard, SearchInput, Toolbar, Tabs, Grid, Card, Skeleton, Button, EmptyState, Banner,
} from '../../../../components/admin/ui';
import { useToast } from '../../../../context/ToastContext';
import { metalsService } from '../../../../services/admin/metals';
import { servicesService } from '../../../../services/admin/services';
import { useDraft } from '../../catalog/useDraft';
import { useUnsavedChanges } from '../../catalog/useUnsavedChanges';
import SaveBar from '../../catalog/SaveBar';
import MetalAssignmentCard from './MetalAssignmentCard';
import '../../catalog/catalog.css';

const has = (list, id) => (Array.isArray(list) ? list : []).some(x => Number(x) === Number(id));

/* What the metals currently say about this service. */
const assignmentsFor = (metals, serviceId) => metals.map(m => ({
    id: m.id,
    assigned: has(m.services, serviceId),
    thicknesses: (m.quick_look?.thicknesses || []).filter(t => has(t.services, serviceId)).map(t => t.value),
}));

/**
 * Admin > Services > Metals for one service (/admin/services/:id/metals):
 * which metals offer it, for the whole metal and per thickness. These ticks
 * decide where the service appears in the quote flow.
 */
export default function ServiceMetalsPage() {
    const { id } = useParams();
    const toast = useToast();
    const [service, setService] = useState(null);
    const [metals, setMetals] = useState([]);
    const { draft: assignments, setDraft, dirty, load, discard, saved } = useDraft([]);
    const { dialog: leaveDialog } = useUnsavedChanges(dirty);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [saving, setSaving] = useState(false);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');

    const fetchAll = useCallback(() => {
        setLoading(true);
        setLoadError('');
        return Promise.all([metalsService.list(), servicesService.list()])
            .then(([metalRows, serviceRows]) => {
                const svc = (serviceRows || []).find(s => Number(s.id) === Number(id));
                if (!svc) { setLoadError('not-found'); return; }
                setService(svc);
                setMetals(metalRows || []);
                load(assignmentsFor(metalRows || [], id));
            })
            .catch(err => setLoadError(err.message))
            .finally(() => setLoading(false));
    }, [id, load]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const byId = useMemo(() => Object.fromEntries(assignments.map(a => [a.id, a])), [assignments]);
    const isOffered = useCallback((m) => { const a = byId[m.id]; return Boolean(a && (a.assigned || a.thicknesses.length)); }, [byId]);
    const offeredCount = metals.filter(isOffered).length;
    const thicknessCount = assignments.reduce((n, a) => n + a.thicknesses.length, 0);

    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return metals
            .filter(m => filter === 'all' || (filter === 'on') === isOffered(m))
            .filter(m => !needle || [m.name, m.category_name].some(v => v && v.toLowerCase().includes(needle)));
    }, [metals, filter, query, isOffered]);

    const update = (next) => setDraft(prev => prev.map(a => (a.id === next.id ? next : a)));

    const save = async () => {
        setSaving(true);
        try {
            // Only the metals whose ticks changed are sent, so other metals are left untouched.
            const before = Object.fromEntries(saved.map(a => [a.id, JSON.stringify(a)]));
            const changed = assignments.filter(a => before[a.id] !== JSON.stringify(a));
            await servicesService.saveMetalAssignments(id, changed.map(a => ({ id: a.id, assigned: a.assigned, thicknesses: a.thicknesses })));
            load(assignments);
            toast(`Metals for ${service.title} saved`, 'success');
        } catch (err) {
            toast(`Could not save: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const header = (
        <PageHeader
            icon={Wrench}
            back={{ to: '/admin/services', label: 'All services' }}
            eyebrow={service?.title || 'Service'}
            title={service ? `Metals for ${service.title}` : 'Metals for this service'}
            subtitle="Choose the metals and thicknesses that offer this service. The quote flow only shows it where it is ticked."
            actions={service ? <Button icon={Pencil} to={`/admin/services/${service.id}`}>Edit service</Button> : null}
        />
    );

    if (loadError) {
        return (
            <Page>
                {header}
                <Card>
                    {loadError === 'not-found' ? (
                        <EmptyState icon={Wrench} title="Service not found" action={<Button to="/admin/services">Back to services</Button>}>It may have been deleted.</EmptyState>
                    ) : (
                        <EmptyState icon={AlertTriangle} title="Could not load the metals" action={<Button onClick={fetchAll}>Try again</Button>}>{loadError}</EmptyState>
                    )}
                </Card>
            </Page>
        );
    }

    return (
        <Page busy={loading}>
            {header}

            <StatGrid label="Assignment summary">
                <StatCard icon={Box} value={metals.length} label="Metals" loading={loading} />
                <StatCard icon={CheckCircle2} value={offeredCount} label="Offer this service" loading={loading} active={filter === 'on'} onClick={() => setFilter(filter === 'on' ? 'all' : 'on')} />
                <StatCard icon={Ruler} value={thicknessCount} label="Thicknesses ticked" loading={loading} />
            </StatGrid>

            {dirty && <Banner tone="warn">You have unsaved changes. Save them at the bottom of the page.</Banner>}

            <SearchInput block value={query} onChange={setQuery} placeholder="Search metals…" label="Search metals" />
            <Toolbar
                left={(
                    <Tabs
                        label="Show"
                        value={filter}
                        onChange={setFilter}
                        items={[
                            { value: 'all', label: 'All', count: metals.length },
                            { value: 'on', label: 'Offered', count: offeredCount },
                            { value: 'off', label: 'Not offered', count: metals.length - offeredCount },
                        ]}
                    />
                )}
            />

            {loading ? (
                <Grid>{[0, 1, 2, 3].map(i => <Card key={i}><Skeleton width="45%" size="lg" /><Skeleton /><Skeleton width="70%" /></Card>)}</Grid>
            ) : visible.length === 0 ? (
                <Card>
                    <EmptyState icon={Search} title="No metals match" action={<Button size="sm" onClick={() => { setQuery(''); setFilter('all'); }}>Show all</Button>} />
                </Card>
            ) : (
                <Grid>
                    {visible.map(m => (
                        <MetalAssignmentCard key={m.id} metal={m} assignment={byId[m.id] || { id: m.id, assigned: false, thicknesses: [] }} serviceTitle={service?.title || 'this service'} onChange={update} />
                    ))}
                </Grid>
            )}

            {!loading && <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} saveLabel="Save assignments" />}
            {leaveDialog}
        </Page>
    );
}
