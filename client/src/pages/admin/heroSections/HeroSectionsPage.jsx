import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, ImageOff, Images, Wrench } from 'lucide-react';
import { Page, PageHeader, StatGrid, StatCard, Toolbar, Tabs, Grid, Card, Skeleton, Banner, Button, EmptyState, useConfirm } from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { heroSectionsService } from '../../../services/admin/heroSections';
import { PAGE_HERO_DEFAULTS, pictureOf } from '../../../utils/pageHeroes';
import HeroCard from './HeroCard';
import './heroSections.css';

/**
 * Admin > Hero sections: the wide picture at the top of every public page
 * that has one (site pages from backend/heroes/slots.js, plus one per
 * service). Each card shows the picture in the exact shape the page shows it,
 * on desktop and on a phone, with the exact size to make. Choosing a picture
 * uploads and saves it at once; removing one brings back the built-in picture.
 */
export default function HeroSectionsPage() {
    const toast = useToast();
    const [confirm, confirmDialog] = useConfirm();
    const [pages, setPages] = useState([]);
    const [servicePage, setServicePage] = useState(null);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('all');
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(() => {
        setLoading(true);
        setError('');
        return Promise.all([heroSectionsService.pages(), heroSectionsService.list()])
            .then(([pageData, rows]) => {
                setPages(pageData?.pages || []);
                setServicePage(pageData?.service || null);
                setServices(rows || []);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    // Every hero as one card model; service pages fall back to the Services page picture.
    const servicesPicture = useMemo(() => pages.find(p => p.key === 'services')?.image || PAGE_HERO_DEFAULTS.services, [pages]);

    const pageSlots = useMemo(() => pages.map(p => ({
        id: `page:${p.key}`,
        kind: 'page',
        key: p.key,
        title: p.label,
        href: p.path,
        size: p.size,
        phone: p.phone,
        position: p.position,
        note: p.note,
        src: p.image || PAGE_HERO_DEFAULTS[p.key] || '',
        custom: Boolean(p.image),
        updatedAt: p.updated_at,
        defaultLabel: 'Built-in picture',
    })), [pages]);

    const serviceSlots = useMemo(() => (servicePage ? services.map(s => {
        const own = pictureOf(s.hero_image);
        return {
            id: `service:${s.service_id}`,
            kind: 'service',
            serviceId: s.service_id,
            title: s.title,
            href: `/service/${s.slug}`,
            size: servicePage.size,
            phone: servicePage.phone,
            position: servicePage.position,
            src: own || servicesPicture,
            custom: Boolean(own),
            updatedAt: own ? s.updated_at : null,
            defaultLabel: 'Shows the Services page picture',
        };
    }) : []), [services, servicePage, servicesPicture]);

    const all = [...pageSlots, ...serviceSlots];
    const customCount = all.filter(s => s.custom).length;
    const show = (slots) => slots.filter(s => filter === 'all' || filter === s.kind || (filter === 'builtin' && !s.custom));

    const upload = async (slot, file) => {
        setBusyId(slot.id);
        try {
            const picture = await heroSectionsService.upload(file);
            if (slot.kind === 'page') {
                const saved = await heroSectionsService.savePage(slot.key, picture.src);
                setPages(prev => prev.map(p => (p.key === slot.key ? { ...p, image: saved.image, updated_at: saved.updated_at } : p)));
            } else {
                const row = await heroSectionsService.save(slot.serviceId, picture);
                setServices(prev => prev.map(s => (s.service_id === slot.serviceId ? { ...s, hero_image: picture, updated_at: row?.updated_at || new Date().toISOString() } : s)));
            }
            toast(`${slot.title}: new hero picture saved`, 'success');
        } catch (err) {
            toast(`Upload failed: ${err.message}`, 'error');
        } finally {
            setBusyId(null);
        }
    };

    const remove = async (slot) => {
        const ok = await confirm({
            title: `Remove the ${slot.title} picture?`,
            message: slot.kind === 'page'
                ? 'The page goes back to its built-in picture. You can upload a new one at any time.'
                : 'The service page goes back to the Services page picture. You can upload a new one at any time.',
            confirmLabel: 'Remove picture',
            danger: true,
        });
        if (!ok) return;
        setBusyId(slot.id);
        try {
            if (slot.kind === 'page') {
                await heroSectionsService.removePage(slot.key);
                setPages(prev => prev.map(p => (p.key === slot.key ? { ...p, image: '', updated_at: null } : p)));
            } else {
                await heroSectionsService.remove(slot.serviceId);
                setServices(prev => prev.map(s => (s.service_id === slot.serviceId ? { ...s, hero_image: null, updated_at: null } : s)));
            }
            toast(`${slot.title} is back to its built-in picture`, 'success');
        } catch (err) {
            toast(`Could not remove: ${err.message}`, 'error');
        } finally {
            setBusyId(null);
        }
    };

    const section = (title, hint, slots) => {
        const visible = show(slots);
        if (!visible.length) return null;
        return (
            <section className="ahs-section" aria-label={title}>
                <header className="ahs-section-head">
                    <h2>{title} <span>{visible.length}</span></h2>
                    <p>{hint}</p>
                </header>
                <Grid columns={3}>
                    {visible.map(slot => (
                        <HeroCard
                            key={slot.id}
                            slot={slot}
                            busy={busyId === slot.id}
                            onUpload={(file) => upload(slot, file)}
                            onRemove={() => remove(slot)}
                        />
                    ))}
                </Grid>
            </section>
        );
    };

    return (
        <Page>
            <PageHeader
                icon={Images}
                title="Hero sections"
                subtitle="The wide picture at the top of every page. Each card shows the exact size to make, and how the page crops it on a desktop and on a phone."
            />

            <StatGrid label="Hero pictures summary">
                <StatCard icon={FileText} value={pageSlots.length} label="Pages" loading={loading} active={filter === 'page'} onClick={() => setFilter(filter === 'page' ? 'all' : 'page')} />
                <StatCard icon={Wrench} value={serviceSlots.length} label="Services" loading={loading} active={filter === 'service'} onClick={() => setFilter(filter === 'service' ? 'all' : 'service')} />
                <StatCard icon={Images} value={customCount} label="Custom" loading={loading} />
                <StatCard icon={ImageOff} value={all.length - customCount} label="Built-in" loading={loading} active={filter === 'builtin'} onClick={() => setFilter(filter === 'builtin' ? 'all' : 'builtin')} />
            </StatGrid>

            {error && <Banner tone="error" action={<Button size="sm" onClick={load}>Try again</Button>}>Could not load the hero sections. {error}</Banner>}

            <Toolbar
                left={(
                    <Tabs
                        label="Show"
                        value={filter}
                        onChange={setFilter}
                        items={[
                            { value: 'all', label: 'All', count: all.length },
                            { value: 'page', label: 'Site pages', count: pageSlots.length },
                            { value: 'service', label: 'Service pages', count: serviceSlots.length },
                            { value: 'builtin', label: 'Built-in picture', count: all.length - customCount },
                        ]}
                    />
                )}
            />

            {loading ? (
                <Grid columns={3}>
                    {[0, 1, 2].map(i => <Card key={i}><Skeleton width="50%" size="lg" /><Skeleton size="block" /></Card>)}
                </Grid>
            ) : !all.length && !error ? (
                <Card><EmptyState icon={Images} title="No pages yet">No pages with a hero picture were found.</EmptyState></Card>
            ) : (
                <>
                    {section('Site pages', 'One picture per page. "Every metal page" covers all the /metal/… pages.', pageSlots)}
                    {section('Service pages', 'Each service page can have its own picture; without one it shows the Services page picture.', serviceSlots)}
                    {!show(all).length && <Card><EmptyState icon={Images} title="Nothing here">No pages match this filter.</EmptyState></Card>}
                </>
            )}
            {confirmDialog}
        </Page>
    );
}
