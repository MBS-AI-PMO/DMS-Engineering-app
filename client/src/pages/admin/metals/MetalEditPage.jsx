import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Box, ExternalLink } from 'lucide-react';
import { Page, PageHeader, SideLayout, Tabs, Banner, Button, Card, Skeleton, Stack, EmptyState } from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { metalsService } from '../../../services/admin/metals';
import { categoriesService } from '../../../services/admin/categories';
import { servicesService } from '../../../services/admin/services';
import { useDraft, useUploads } from '../catalog/useDraft';
import { useUnsavedChanges } from '../catalog/useUnsavedChanges';
import SaveBar from '../catalog/SaveBar';
import MetalDetailsCard from './MetalDetailsCard';
import MetalImageCard from './MetalImageCard';
import MetalQuickLook from './MetalQuickLook';
import MetalServicesTab from './MetalServicesTab';
import MetalSpecifications from './MetalSpecifications';
import MetalAbout from './MetalAbout';
import MetalFaqs from './MetalFaqs';
import MetalCompatibility from './MetalCompatibility';
import MetalCustomFields from './MetalCustomFields';
import { EMPTY_METAL, toForm, toPayload } from './metalForm';
import '../catalog/catalog.css';

const TABS = [
    { value: 'quick', label: 'Quick look' },
    { value: 'services', label: 'Services' },
    { value: 'specs', label: 'Specifications' },
    { value: 'about', label: 'About' },
    { value: 'faqs', label: 'FAQs' },
    { value: 'compat', label: 'Compatibility' },
];

function EditorSkeleton() {
    return (
        <SideLayout
            main={<Card><Skeleton width="40%" size="lg" /><Skeleton /><Skeleton width="80%" /><Skeleton size="block" /></Card>}
            side={<Card><Skeleton size="block" /><Skeleton width="60%" /></Card>}
        />
    );
}

/**
 * Admin > Metals > one metal (/admin/metals/:slug, or /admin/metals/new).
 * Details and picture on top, then the sections of the metal page as tabs,
 * custom fields, and a sticky save bar. Saving stays on the page; a new or
 * renamed metal moves to its new address.
 */
export default function MetalEditPage() {
    const { slug } = useParams();
    const isNew = !slug;
    const navigate = useNavigate();
    const toast = useToast();
    const { draft: metal, setDraft, dirty, load, discard } = useDraft(EMPTY_METAL);
    const { busy: uploading, wrap } = useUploads();
    const { dialog: leaveDialog } = useUnsavedChanges(dirty);

    const [categories, setCategories] = useState([]);
    const [services, setServices] = useState([]);
    const [tab, setTab] = useState('quick');
    const [loading, setLoading] = useState(!isNew);
    const [loadError, setLoadError] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        categoriesService.list().then(setCategories).catch(err => toast(`Could not load categories: ${err.message}`, 'error'));
        servicesService.list().then(setServices).catch(err => toast(`Could not load services: ${err.message}`, 'error'));
    }, [toast]);

    const fetchMetal = useCallback(() => {
        if (isNew) return undefined;
        setLoading(true);
        setLoadError('');
        return metalsService.get(slug)
            .then(row => load(toForm(row)))
            .catch(err => setLoadError(err.status === 404 ? 'not-found' : err.message))
            .finally(() => setLoading(false));
    }, [isNew, slug, load]);

    useEffect(() => { fetchMetal(); }, [fetchMetal]);

    const set = useCallback((key, value) => setDraft(prev => ({ ...prev, [key]: value })), [setDraft]);
    const upload = useMemo(() => wrap(metalsService.uploadImage), [wrap]);

    const save = async () => {
        if (!metal.name.trim()) { setError('Give the metal a name.'); return; }
        if (uploading) { toast('Wait for the picture to finish uploading.', 'warning'); return; }
        setSaving(true);
        setError('');
        try {
            const body = toPayload(metal);
            const row = isNew ? await metalsService.create(body) : await metalsService.update(metal.id, body);
            load(toForm(row));
            toast(isNew ? `${row.name} added` : `${row.name} saved`, 'success');
            if (row.slug !== slug) navigate(`/admin/metals/${row.slug}`, { replace: true });
        } catch (err) {
            setError(err.message);
            toast(`Could not save: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const header = (
        <PageHeader
            icon={Box}
            back={{ to: '/admin/metals', label: 'All metals' }}
            eyebrow={isNew ? 'New metal' : categories.find(c => String(c.id) === String(metal.category_id))?.name || 'Metal'}
            title={isNew ? (metal.name || 'New metal') : (metal.name || 'Untitled metal')}
            subtitle={isNew ? 'Add the name and category, then the thicknesses customers can order.' : 'Everything the metal page and the quote page show for this material.'}
            actions={!isNew && metal.slug ? <Button icon={ExternalLink} href={`/metal/${metal.slug}`} target="_blank" rel="noreferrer">View on site</Button> : null}
        />
    );

    if (loadError) {
        return (
            <Page>
                {header}
                <Card>
                    {loadError === 'not-found' ? (
                        <EmptyState icon={Box} title="Metal not found" action={<Button to="/admin/metals">Back to metals</Button>}>It may have been renamed or deleted.</EmptyState>
                    ) : (
                        <EmptyState icon={AlertTriangle} title="Could not load this metal" action={<Button onClick={fetchMetal}>Try again</Button>}>{loadError}</EmptyState>
                    )}
                </Card>
            </Page>
        );
    }

    return (
        <Page busy={loading}>
            {header}
            {error && <Banner tone="error">{error}</Banner>}

            {loading ? <EditorSkeleton /> : (
                <Stack>
                    <SideLayout
                        main={<MetalDetailsCard metal={metal} categories={categories} onChange={set} nameError={error && !metal.name.trim() ? 'Name is required.' : ''} />}
                        side={<MetalImageCard metal={metal} onChange={set} upload={upload} />}
                    />

                    <Tabs label="Metal sections" items={TABS} value={tab} onChange={setTab} />

                    {tab === 'quick' && <MetalQuickLook quickLook={metal.quick_look} onChange={v => set('quick_look', v)} />}
                    {tab === 'services' && <MetalServicesTab metal={metal} services={services} onChange={set} />}
                    {tab === 'specs' && <MetalSpecifications metal={metal} onChange={set} upload={upload} />}
                    {tab === 'about' && <MetalAbout about={metal.about_section} onChange={v => set('about_section', v)} upload={upload} metalName={metal.name} />}
                    {tab === 'faqs' && <MetalFaqs faqs={metal.faqs || []} onChange={v => set('faqs', v)} />}
                    {tab === 'compat' && <MetalCompatibility metal={metal} services={services} />}

                    <MetalCustomFields fields={metal.custom_fields} onChange={v => set('custom_fields', v)} />
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
                    saveLabel={isNew ? 'Add metal' : 'Save changes'}
                />
            )}
            {leaveDialog}
        </Page>
    );
}
