import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, FileText, Globe, Search } from 'lucide-react';
import { Page, PageHeader, SideLayout, StatGrid, StatCard, Banner, Button, Card, Skeleton, useConfirm } from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { siteSettingsService } from '../../../services/admin/siteSettings';
import { SEO_PAGES, SEO_SETTINGS_SAVED_EVENT } from '../../../utils/seo';
import SaveBar from '../content/SaveBar';
import { useUnsavedChanges } from '../content/useUnsavedChanges';
import PageOverridesCard from './PageOverridesCard';
import { SearchDefaultsCard, SocialSharingCard, TrackingCard } from './SeoCards';
import SeoPreviewCard from './SeoPreviewCard';
import { PIXELS, buildPixelPayload, buildSeoPayload, isCustomPage, toForm, toPixels, validate } from './seoForm';
import '../content/content.css';
import './seo.css';

/**
 * Admin > SEO & tracking: meta tags for search engines and link previews
 * (site-wide and per page) and the analytics pixels, with a live preview.
 * Both settings save together from the sticky bar; share images upload
 * straight away but only apply once saved.
 */
export default function SeoPage() {
    const toast = useToast();
    const [confirm, confirmDialog] = useConfirm();
    const [form, setForm] = useState(() => toForm(null));
    const [pixels, setPixels] = useState(() => toPixels(null));
    const [saved, setSaved] = useState({ seo: '', pixels: '' }); // JSON of what is stored
    const [stored, setStored] = useState({ seo: null, pixels: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(null); // 'default' | page path
    const [errors, setErrors] = useState({});
    const [pagePath, setPagePath] = useState('/');
    const fileRef = useRef(null);
    const targetRef = useRef(null);

    const reset = useCallback((seoRaw, pixelRaw) => {
        const nextForm = toForm(seoRaw);
        const nextPixels = toPixels(pixelRaw);
        setForm(nextForm);
        setPixels(nextPixels);
        setStored({ seo: seoRaw, pixels: pixelRaw });
        setSaved({ seo: JSON.stringify(buildSeoPayload(nextForm)), pixels: JSON.stringify(buildPixelPayload(nextPixels)) });
        setErrors({});
    }, []);

    const fetchAll = useCallback(() => siteSettingsService.all()
        .then(data => { reset(data?.seo_meta ?? null, data?.tracking_pixels ?? null); setError(''); })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false)), [reset]);

    useEffect(() => { fetchAll(); }, [fetchAll]);
    const load = () => { setLoading(true); setError(''); fetchAll(); };

    const seoPayload = useMemo(() => buildSeoPayload(form), [form]);
    const pixelPayload = useMemo(() => buildPixelPayload(pixels), [pixels]);
    const seoDirty = JSON.stringify(seoPayload) !== saved.seo;
    const pixelsDirty = JSON.stringify(pixelPayload) !== saved.pixels;
    const dirty = !loading && !error && (seoDirty || pixelsDirty);
    useUnsavedChanges(dirty);

    const setDefault = (key, value) => setForm(prev => ({ ...prev, defaults: { ...prev.defaults, [key]: value } }));
    const setPage = (path, key, value) => setForm(prev => ({ ...prev, pages: { ...prev.pages, [path]: { ...prev.pages[path], [key]: value } } }));
    const setPixel = (key, patch) => setPixels(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));

    const startUpload = (target) => {
        targetRef.current = target;
        fileRef.current?.click();
    };
    const onFile = async (file) => {
        const target = targetRef.current;
        if (!file || !target) return;
        setUploading(target);
        try {
            // Stored by the shared image endpoint (WebP, max 1200 px wide).
            const path = await siteSettingsService.uploadImage('seo_og_image', file);
            if (target === 'default') setDefault('ogImage', path); else setPage(target, 'ogImage', path);
            toast('Image uploaded. Save to use it.', 'success');
        } catch (err) {
            toast(`Upload failed. ${err.message}`, 'error');
        } finally { setUploading(null); }
    };

    const save = async () => {
        const found = validate(seoPayload, pixelPayload);
        setErrors(found);
        if (Object.keys(found).length) {
            const pageError = Object.keys(found).find(k => k.startsWith('page:'));
            if (pageError) setPagePath(pageError.slice(5));
            toast('Fix the highlighted fields first.', 'error');
            return;
        }
        setSaving(true);
        let step = 'the SEO settings';
        try {
            let seoRaw = stored.seo;
            let pixelRaw = stored.pixels;
            if (seoDirty) seoRaw = await siteSettingsService.save('seo_meta', seoPayload);
            step = 'the tracking pixels';
            if (pixelsDirty) pixelRaw = await siteSettingsService.save('tracking_pixels', pixelPayload);
            reset(seoRaw, pixelRaw);
            window.dispatchEvent(new Event(SEO_SETTINGS_SAVED_EVENT));
            toast('SEO and tracking saved', 'success');
        } catch (err) {
            toast(`Could not save ${step}. ${err.message}`, 'error');
        } finally { setSaving(false); }
    };

    const discard = async () => {
        if (!(await confirm({ title: 'Discard your changes?', message: 'Everything goes back to how it was last saved.', confirmLabel: 'Discard changes', danger: true }))) return;
        reset(stored.seo, stored.pixels);
    };

    const customPages = SEO_PAGES.filter(p => isCustomPage(form.pages[p.path])).length;
    const pixelsOn = PIXELS.filter(p => pixels[p.key].enabled).length;
    const choosePage = (path) => setPagePath(path);

    return (
        <Page>
            <PageHeader
                icon={Globe}
                title="SEO & tracking"
                subtitle="Meta tags for search engines and link previews, and the analytics pixels."
            />

            <StatGrid label="SEO summary">
                <StatCard icon={Search} value={form.defaults.robots === 'noindex' ? 'Blocked' : 'Allowed'} label="Indexing" loading={loading} />
                <StatCard icon={FileText} value={`${customPages} / ${SEO_PAGES.length}`} label="Custom pages" loading={loading} />
                <StatCard icon={BarChart3} value={`${pixelsOn} / ${PIXELS.length}`} label="Pixels on" loading={loading} />
            </StatGrid>

            {error && <Banner tone="error" action={<Button size="sm" onClick={load}>Try again</Button>}>Could not load the settings. {error}</Banner>}

            <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }} />

            {loading && (
                <SideLayout
                    main={[0, 1, 2].map(i => <Card key={i}><Skeleton width="35%" /><Skeleton size="lg" /><Skeleton size="lg" /><Skeleton size="block" /></Card>)}
                    side={<Card><Skeleton width="30%" /><Skeleton size="block" /><Skeleton size="block" /></Card>}
                />
            )}
            {!loading && !error && (
                <SideLayout
                    main={(
                        <>
                            <SearchDefaultsCard d={form.defaults} set={setDefault} errors={errors} />
                            <SocialSharingCard d={form.defaults} set={setDefault} errors={errors} onUpload={() => startUpload('default')} uploading={uploading === 'default'} />
                            <PageOverridesCard
                                pages={form.pages}
                                defaults={form.defaults}
                                selected={pagePath}
                                onSelect={choosePage}
                                setPage={setPage}
                                errors={errors}
                                onUpload={() => startUpload(pagePath)}
                                uploading={uploading === pagePath}
                            />
                            <TrackingCard pixels={pixels} setPixel={setPixel} errors={errors} />
                        </>
                    )}
                    side={<div className="ac-seo-side"><SeoPreviewCard form={form} path={pagePath} onPath={choosePage} /></div>}
                />
            )}

            <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} disabled={loading || !!error || !!uploading} />
            {confirmDialog}
        </Page>
    );
}
