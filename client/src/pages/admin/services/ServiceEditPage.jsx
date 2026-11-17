import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ExternalLink, FileText, Layers, Wrench } from 'lucide-react';
import { Page, PageHeader, SideLayout, Stack, Banner, Button, Card, Skeleton, EmptyState } from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { servicesService } from '../../../services/admin/services';
import { useDraft, useUploads } from '../catalog/useDraft';
import { useUnsavedChanges } from '../catalog/useUnsavedChanges';
import SaveBar from '../catalog/SaveBar';
import ServiceDetailsCard from './ServiceDetailsCard';
import ServiceHierarchyCard from './ServiceHierarchyCard';
import ServiceLimitsCard from './ServiceLimitsCard';
import ServiceSideCards from './ServiceSideCards';
import ServiceCatalogSection from './ServiceCatalogSection';
import { EMPTY_SERVICE, catalogKind, convertLimits, toForm, toPayload } from './serviceForm';
import '../catalog/catalog.css';

/**
 * Admin > Services > one service (/admin/services/:id or /new): details,
 * type (main production service or sub-service), part size limits, picture
 * and listing, then the catalog list that belongs to it (colours, taps,
 * countersink profiles or the hardware catalog). Pricing lives in
 * Admin > Costing; this page says so.
 */
export default function ServiceEditPage() {
    const { id } = useParams();
    const isNew = !id;
    const navigate = useNavigate();
    const toast = useToast();
    const { draft: service, setDraft, dirty, load, discard } = useDraft(EMPTY_SERVICE);
    const { busy: uploading, wrap } = useUploads();
    const { dialog: leaveDialog } = useUnsavedChanges(dirty);
    const [allServices, setAllServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const fetchAll = useCallback(() => {
        setLoading(true);
        setLoadError('');
        return servicesService.list()
            .then(rows => {
                setAllServices(rows || []);
                if (isNew) return;
                const match = (rows || []).find(s => Number(s.id) === Number(id));
                if (match) load(toForm(match));
                else setLoadError('not-found');
            })
            .catch(err => setLoadError(err.message))
            .finally(() => setLoading(false));
    }, [id, isNew, load]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const set = useCallback((key, value) => setDraft(prev => ({ ...prev, [key]: value })), [setDraft]);
    const patch = useCallback((changes) => setDraft(prev => ({ ...prev, ...changes })), [setDraft]);
    const upload = useMemo(() => wrap(servicesService.uploadImage), [wrap]);
    const kind = catalogKind(service.title);

    const save = async () => {
        if (!service.title.trim()) { setError('Give the service a title.'); return; }
        if (uploading) { toast('Wait for the picture to finish uploading.', 'warning'); return; }
        setSaving(true);
        setError('');
        try {
            const body = toPayload(service);
            const row = isNew ? await servicesService.create(body) : await servicesService.update(service.id, body);
            load(toForm(row));
            toast(isNew ? `${row.title} added` : `${row.title} saved`, 'success');
            if (isNew) navigate(`/admin/services/${row.id}`, { replace: true });
        } catch (err) {
            setError(err.message);
            toast(`Could not save: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const header = (
        <PageHeader
            icon={Wrench}
            back={{ to: '/admin/services', label: 'All services' }}
            eyebrow={isNew ? 'New service' : service.is_production ? 'Main production service' : (service.parent_ids || []).length ? 'Sub-service' : 'Service'}
            title={service.title || (isNew ? 'New service' : 'Untitled service')}
            subtitle={isNew ? 'Name it, choose its type, then save to set up its metals and catalog.' : 'Details, type, size limits and the catalog customers choose from.'}
            actions={!isNew && service.id ? (
                <>
                    <Button icon={Layers} to={`/admin/services/${service.id}/metals`}>Metals</Button>
                    <Button icon={FileText} to={`/admin/guidelines/${service.id}`}>Guidelines</Button>
                    {service.slug && <Button icon={ExternalLink} href={`/service/${service.slug}`} target="_blank" rel="noreferrer">View on site</Button>}
                </>
            ) : null}
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
                        <EmptyState icon={AlertTriangle} title="Could not load this service" action={<Button onClick={fetchAll}>Try again</Button>}>{loadError}</EmptyState>
                    )}
                </Card>
            </Page>
        );
    }

    return (
        <Page busy={loading}>
            {header}
            {error && <Banner tone="error">{error}</Banner>}

            {loading ? (
                <SideLayout
                    main={<Card><Skeleton width="40%" size="lg" /><Skeleton /><Skeleton size="block" /></Card>}
                    side={<Card><Skeleton size="block" /></Card>}
                />
            ) : (
                <Stack>
                    <SideLayout
                        main={(
                            <>
                                <ServiceDetailsCard service={service} onChange={set} titleError={error && !service.title.trim() ? 'Title is required.' : ''} />
                                <ServiceHierarchyCard service={service} allServices={allServices} onChange={patch} />
                                {service.is_production && <ServiceLimitsCard service={service} onChange={set} onUnitChange={unit => setDraft(prev => convertLimits(prev, unit))} />}
                            </>
                        )}
                        side={<ServiceSideCards service={service} onChange={set} upload={upload} />}
                    />

                    {!isNew && (
                        <Banner>
                            How this service is priced (operations, rates, setup times, markups) is set in{' '}
                            <Link className="ak-link" to="/admin/costing/services">Admin › Costing</Link>.
                            {' '}The colour, tap, countersink and hardware lists on this page set their catalog prices.
                        </Banner>
                    )}

                    <ServiceCatalogSection kind={kind} options={service.service_options || []} onChange={v => set('service_options', v)} />
                </Stack>
            )}

            {!loading && (
                <SaveBar
                    dirty={dirty}
                    isNew={isNew}
                    saving={saving}
                    busy={uploading}
                    busyText="Uploading picture…"
                    onSave={save}
                    onDiscard={isNew ? undefined : discard}
                    saveLabel={isNew ? 'Add service' : 'Save changes'}
                />
            )}
            {leaveDialog}
        </Page>
    );
}
