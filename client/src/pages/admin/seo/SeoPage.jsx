import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, FileCode2, FileText, Globe, Search, Share2 } from 'lucide-react';
import { Page, PageHeader, PageTabs, SideLayout, Stack, StatGrid, StatCard, Banner, Button, Card, Skeleton, useConfirm } from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { siteSettingsService } from '../../../services/admin/siteSettings';
import { SEO_PAGES, SEO_SETTINGS_SAVED_EVENT } from '../../../utils/seo';
import SaveBar from '../content/SaveBar';
import { useUnsavedChanges } from '../content/useUnsavedChanges';
import HeadPreviewCard from './HeadPreviewCard';
import HeadTagsCard from './HeadTagsCard';
import PageOverridesCard from './PageOverridesCard';
import { BrowserIconsCard, SearchDefaultsCard, SocialSharingCard, TrackingCard } from './SeoCards';
import SeoPreviewCard from './SeoPreviewCard';
import { buildHeadTagsPayload, toHeadTags, validateHeadTags } from './headTagsForm';
import { PIXELS, buildPixelPayload, buildSeoPayload, isCustomPage, tabOfError, toForm, toPixels, validate } from './seoForm';
import '../content/content.css';
import './seo.css';

// The page's sections; the open one is ?tab= in the address.
const TABS = [
    { value: 'search', label: 'Search', icon: Search },
    { value: 'social', label: 'Social sharing', icon: Share2 },
    { value: 'pages', label: 'Pages', icon: FileText },
    { value: 'head', label: 'Head tags', icon: FileCode2 },
    { value: 'pixels', label: 'Tracking', icon: BarChart3 },
];

/**
 * Admin > SEO & tracking, in tabs: search defaults and browser icons,
 * social sharing, per-page text, the admin's own <head> tags (with the
 * page source they produce) and the analytics pixels. All three settings
 * (seo_meta, head_tags, tracking_pixels) save together from the sticky
 * bar, whichever tab is open; share images upload straight away but only
 * apply once saved.
 */
export default function SeoPage() {
    const toast = useToast();
    const [confirm, confirmDialog] = useConfirm();
    const [params, setParams] = useSearchParams();
    const [form, setForm] = useState(() => toForm(null));
    const [pixels, setPixels] = useState(() => toPixels(null));
    const [headTags, setHeadTags] = useState([]);
    const [saved, setSaved] = useState({ seo: '', pixels: '', head: '' }); // JSON of what is stored
    const [stored, setStored] = useState({ seo: null, pixels: null, head: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(null); // 'default' | page path
    const [tried, setTried] = useState(false); // a save was refused: show the problems as they are fixed
    const [pagePath, setPagePath] = useState('/');
    const fileRef = useRef(null);
    const targetRef = useRef(null);

    const tab = TABS.some(t => t.value === params.get('tab')) ? params.get('tab') : TABS[0].value;
    const goTo = useCallback((value) => setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', value);
        return next;
    }), [setParams]);

    const reset = useCallback((seoRaw, pixelRaw, headRaw) => {
        const nextForm = toForm(seoRaw);
        const nextPixels = toPixels(pixelRaw);
        const nextHead = toHeadTags(headRaw);
        setForm(nextForm);
        setPixels(nextPixels);
        setHeadTags(nextHead);
        setStored({ seo: seoRaw, pixels: pixelRaw, head: headRaw });
        setSaved({
            seo: JSON.stringify(buildSeoPayload(nextForm)),
            pixels: JSON.stringify(buildPixelPayload(nextPixels)),
            head: JSON.stringify(buildHeadTagsPayload(nextHead)),
        });
        setTried(false);
    }, []);

    const fetchAll = useCallback(() => siteSettingsService.all()
        .then(data => { reset(data?.seo_meta ?? null, data?.tracking_pixels ?? null, data?.head_tags ?? null); setError(''); })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false)), [reset]);

    useEffect(() => { fetchAll(); }, [fetchAll]);
    const load = () => { setLoading(true); setError(''); fetchAll(); };

    const seoPayload = useMemo(() => buildSeoPayload(form), [form]);
    const pixelPayload = useMemo(() => buildPixelPayload(pixels), [pixels]);
    const headPayload = useMemo(() => buildHeadTagsPayload(headTags), [headTags]);
    const seoDirty = JSON.stringify(seoPayload) !== saved.seo;
    const pixelsDirty = JSON.stringify(pixelPayload) !== saved.pixels;
    const headDirty = JSON.stringify(headPayload) !== saved.head;
    const dirty = !loading && !error && (seoDirty || pixelsDirty || headDirty);
    useUnsavedChanges(dirty);

    const findErrors = useCallback(() => ({ ...validate(seoPayload, pixelPayload), ...validateHeadTags(headTags) }), [seoPayload, pixelPayload, headTags]);
    const errors = useMemo(() => (tried ? findErrors() : {}), [tried, findErrors]);

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
        const found = findErrors();
        setTried(true);
        const keys = Object.keys(found);
        if (keys.length) {
            const pageError = keys.find(k => k.startsWith('page:'));
            if (pageError) setPagePath(pageError.slice(5));
            if (!keys.some(k => tabOfError(k) === tab)) goTo(tabOfError(keys[0]));
            toast('Fix the highlighted fields first.', 'error');
            return;
        }
        setSaving(true);
        let step = { label: 'the SEO settings', tab: 'search' };
        try {
            let { seo: seoRaw, pixels: pixelRaw, head: headRaw } = stored;
            if (seoDirty) seoRaw = await siteSettingsService.save('seo_meta', seoPayload);
            step = { label: 'the head tags', tab: 'head' };
            if (headDirty) headRaw = await siteSettingsService.save('head_tags', headPayload);
            step = { label: 'the tracking pixels', tab: 'pixels' };
            if (pixelsDirty) pixelRaw = await siteSettingsService.save('tracking_pixels', pixelPayload);
            reset(seoRaw, pixelRaw, headRaw);
            window.dispatchEvent(new Event(SEO_SETTINGS_SAVED_EVENT));
            toast('SEO and tracking saved', 'success');
        } catch (err) {
            if (step.tab !== tab && step.tab !== 'search') goTo(step.tab);
            toast(`Could not save ${step.label}. ${err.message}`, 'error');
        } finally { setSaving(false); }
    };

    const discard = async () => {
        if (!(await confirm({ title: 'Discard your changes?', message: 'Everything goes back to how it was last saved.', confirmLabel: 'Discard changes', danger: true }))) return;
        reset(stored.seo, stored.pixels, stored.head);
    };

    const customPages = SEO_PAGES.filter(p => isCustomPage(form.pages[p.path])).length;
    const pixelsOn = PIXELS.filter(p => pixels[p.key].enabled).length;
    const headOn = headTags.filter(t => t.enabled).length;

    const tabItems = useMemo(() => {
        const problems = {};
        Object.keys(errors).forEach((key) => { const t = tabOfError(key); problems[t] = (problems[t] || 0) + 1; });
        const counts = { pages: customPages || undefined, head: headTags.length || undefined, pixels: pixelsOn || undefined };
        return TABS.map(t => ({
            ...t,
            count: loading ? undefined : counts[t.value],
            alert: problems[t.value] ? `${problems[t.value]} to fix` : undefined,
        }));
    }, [errors, customPages, headTags.length, pixelsOn, loading]);

    const preview = <div className="ac-seo-side"><SeoPreviewCard form={form} path={pagePath} onPath={setPagePath} /></div>;
    const sections = {
        search: <SideLayout main={<><SearchDefaultsCard d={form.defaults} set={setDefault} errors={errors} /><BrowserIconsCard d={form.defaults} set={setDefault} errors={errors} /></>} side={preview} />,
        social: (
            <SideLayout
                main={<SocialSharingCard d={form.defaults} set={setDefault} errors={errors} onUpload={() => startUpload('default')} uploading={uploading === 'default'} />}
                side={preview}
            />
        ),
        pages: (
            <SideLayout
                main={(
                    <PageOverridesCard
                        pages={form.pages}
                        defaults={form.defaults}
                        selected={pagePath}
                        onSelect={setPagePath}
                        setPage={setPage}
                        errors={errors}
                        onUpload={() => startUpload(pagePath)}
                        uploading={uploading === pagePath}
                    />
                )}
                side={preview}
            />
        ),
        head: (
            <Stack>
                <HeadTagsCard tags={headTags} onChange={setHeadTags} errors={errors} confirm={confirm} />
                <HeadPreviewCard seoMeta={seoPayload} headTags={headPayload} />
            </Stack>
        ),
        pixels: <TrackingCard pixels={pixels} setPixel={setPixel} errors={errors} />,
    };

    return (
        <Page>
            <PageHeader
                icon={Globe}
                title="SEO & tracking"
                subtitle="Meta tags for search engines and link previews, your own head tags, and the analytics pixels."
            />

            <StatGrid label="SEO summary">
                <StatCard icon={Search} value={form.defaults.robots === 'noindex' ? 'Blocked' : 'Allowed'} label="Indexing" loading={loading} />
                <StatCard icon={FileText} value={`${customPages} / ${SEO_PAGES.length}`} label="Custom pages" loading={loading} />
                <StatCard icon={FileCode2} value={headTags.length ? `${headOn} / ${headTags.length}` : '0'} label="Head tags on" loading={loading} />
                <StatCard icon={BarChart3} value={`${pixelsOn} / ${PIXELS.length}`} label="Pixels on" loading={loading} />
            </StatGrid>

            <div className="ac-seo-tabs">
                <PageTabs items={tabItems} value={tab} onChange={goTo} label="SEO & tracking sections" />
            </div>

            {error && <Banner tone="error" action={<Button size="sm" onClick={load}>Try again</Button>}>Could not load the settings. {error}</Banner>}

            <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }} />

            {loading && (
                <SideLayout
                    main={[0, 1].map(i => <Card key={i}><Skeleton width="35%" /><Skeleton size="lg" /><Skeleton size="lg" /><Skeleton size="block" /></Card>)}
                    side={<Card><Skeleton width="30%" /><Skeleton size="block" /><Skeleton size="block" /></Card>}
                />
            )}
            {!loading && !error && sections[tab]}

            <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} disabled={loading || !!error || !!uploading} />
            {confirmDialog}
        </Page>
    );
}
