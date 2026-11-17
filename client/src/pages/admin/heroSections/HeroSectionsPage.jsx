import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImageOff, Images, Wrench } from 'lucide-react';
import { Page, PageHeader, StatGrid, StatCard, Toolbar, Tabs, Grid, Card, Skeleton, Banner, Button, EmptyState, useConfirm } from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { heroSectionsService } from '../../../services/admin/heroSections';
import HeroCard from './HeroCard';
import { heroPreview } from './heroImage';
import '../catalog/catalog.css';

/**
 * Admin > Hero Sections: the wide picture at the top of each service page
 * (/service/:slug). Choosing a picture uploads and saves it straight away;
 * removing one brings back the default picture.
 */
export default function HeroSectionsPage() {
    const toast = useToast();
    const [confirm, confirmDialog] = useConfirm();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('all');
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(() => {
        setLoading(true);
        setError('');
        return heroSectionsService.list()
            .then(rows => setItems(rows || []))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const customCount = useMemo(() => items.filter(i => heroPreview(i.hero_image)).length, [items]);
    const visible = items.filter(i => filter === 'all' || (filter === 'custom') === Boolean(heroPreview(i.hero_image)));

    const patch = (serviceId, changes) => setItems(prev => prev.map(i => (i.service_id === serviceId ? { ...i, ...changes } : i)));

    const upload = async (item, file) => {
        setBusyId(item.service_id);
        try {
            const heroImage = await heroSectionsService.upload(file);
            const row = await heroSectionsService.save(item.service_id, heroImage);
            patch(item.service_id, { hero_image: heroImage, updated_at: row?.updated_at || new Date().toISOString() });
            toast(`${item.title}: new hero picture saved`, 'success');
        } catch (err) {
            toast(`Upload failed: ${err.message}`, 'error');
        } finally {
            setBusyId(null);
        }
    };

    const remove = async (item) => {
        const ok = await confirm({
            title: `Remove the ${item.title} picture?`,
            message: 'The service page goes back to the default picture. You can upload a new one at any time.',
            confirmLabel: 'Remove picture',
            danger: true,
        });
        if (!ok) return;
        setBusyId(item.service_id);
        try {
            await heroSectionsService.remove(item.service_id);
            patch(item.service_id, { hero_image: null, updated_at: null });
            toast(`${item.title} now uses the default picture`, 'success');
        } catch (err) {
            toast(`Could not remove: ${err.message}`, 'error');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <Page>
            <PageHeader
                icon={Images}
                title="Hero sections"
                subtitle="The wide picture at the top of each service page. A new picture is saved as soon as it uploads."
            />

            <StatGrid label="Hero pictures summary">
                <StatCard icon={Wrench} value={items.length} label="Service pages" loading={loading} />
                <StatCard icon={Images} value={customCount} label="Custom pictures" loading={loading} active={filter === 'custom'} onClick={() => setFilter(filter === 'custom' ? 'all' : 'custom')} />
                <StatCard icon={ImageOff} value={items.length - customCount} label="Default picture" loading={loading} active={filter === 'default'} onClick={() => setFilter(filter === 'default' ? 'all' : 'default')} />
            </StatGrid>

            {error && <Banner tone="error" action={<Button size="sm" onClick={load}>Try again</Button>}>Could not load the hero sections. {error}</Banner>}

            <Toolbar
                left={(
                    <Tabs
                        label="Show"
                        value={filter}
                        onChange={setFilter}
                        items={[
                            { value: 'all', label: 'All', count: items.length },
                            { value: 'custom', label: 'Custom picture', count: customCount },
                            { value: 'default', label: 'Default picture', count: items.length - customCount },
                        ]}
                    />
                )}
            />

            {loading ? (
                <Grid columns={3}>
                    {[0, 1, 2].map(i => <Card key={i}><Skeleton width="50%" size="lg" /><Skeleton size="block" /></Card>)}
                </Grid>
            ) : visible.length === 0 ? (
                <Card>
                    <EmptyState icon={Images} title={items.length ? 'Nothing here' : 'No services yet'}>
                        {items.length ? 'No service pages match this filter.' : 'Add services first; each one gets a page with a hero picture.'}
                    </EmptyState>
                </Card>
            ) : (
                <Grid columns={3}>
                    {visible.map(item => (
                        <HeroCard key={item.service_id} item={item} busy={busyId === item.service_id} onUpload={upload} onRemove={remove} />
                    ))}
                </Grid>
            )}
            {confirmDialog}
        </Page>
    );
}
