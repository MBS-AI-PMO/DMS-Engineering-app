import { useCallback, useEffect, useMemo, useState } from 'react';
import { Contact, ExternalLink } from 'lucide-react';
import { Page, PageHeader, SideLayout, Banner, Button, useConfirm } from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { siteSettingsService } from '../../../services/admin/siteSettings';
import SaveBar from '../content/SaveBar';
import { useUnsavedChanges } from '../content/useUnsavedChanges';
import { ContactDetailsCard, InboxCard, QuoteDisplayCard, SocialLinksCard } from './ContactCards';
import FooterMetalsCard from './FooterMetalsCard';
import SiteImagesCard from './SiteImagesCard';
import { FORM_KEYS, IMAGE_KEYS, toForm, toValues, validate } from './contactForm';
import '../content/content.css';
import './contact.css';

/**
 * Admin > Contact: contact details, where contact-form messages go, social
 * links, footer metals and the quote display switch (saved together with
 * the sticky bar), plus logos and the home hero image (saved on upload).
 */
export default function ContactPage() {
    const toast = useToast();
    const [confirm, confirmDialog] = useConfirm();
    const [form, setForm] = useState(() => toForm());
    const [stored, setStored] = useState(() => toValues(toForm())); // last saved values, per key
    const [images, setImages] = useState({});
    const [metals, setMetals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [imageBusy, setImageBusy] = useState(null);
    const [errors, setErrors] = useState({});

    const fetchAll = useCallback(() => Promise.all([
        siteSettingsService.all(),
        siteSettingsService.private().catch(() => ({})),
        siteSettingsService.metals().catch(() => []),
    ]).then(([settings, privateSettings, metalList]) => {
        const next = toForm(settings || {}, privateSettings || {});
        setForm(next);
        setStored(toValues(next));
        setImages(Object.fromEntries(IMAGE_KEYS.map(k => [k, settings?.[k] || ''])));
        setMetals(Array.isArray(metalList) ? metalList : []);
        setErrors({});
        setError('');
    }).catch(err => setError(err.message)).finally(() => setLoading(false)), []);

    useEffect(() => { fetchAll(); }, [fetchAll]);
    const load = () => { setLoading(true); setError(''); fetchAll(); };

    const values = useMemo(() => toValues(form), [form]);
    const changedKeys = FORM_KEYS.filter(k => JSON.stringify(values[k]) !== JSON.stringify(stored[k]));
    const dirty = !loading && changedKeys.length > 0;
    useUnsavedChanges(dirty);

    const set = (key) => (value) => setForm(f => ({ ...f, [key]: value }));

    const save = async () => {
        const found = validate(form);
        setErrors(found);
        if (Object.keys(found).length) { toast('Fix the highlighted fields first.', 'error'); return; }
        setSaving(true);
        const results = await Promise.allSettled(changedKeys.map(k => siteSettingsService.save(k, values[k]).then(v => [k, v])));
        // Keep what was sent as the saved state (the database reorders object keys);
        // the inbox list comes back cleaned by the server, so use that one.
        const savedNow = Object.fromEntries(results.filter(r => r.status === 'fulfilled').map(r => r.value)
            .map(([k, v]) => [k, k === 'contact_form_recipients' ? String(v || '') : values[k]]));
        const failed = results.filter(r => r.status === 'rejected');
        setStored(prev => ({ ...prev, ...savedNow }));
        if ('contact_form_recipients' in savedNow) setForm(f => ({ ...f, contact_form_recipients: savedNow.contact_form_recipients }));
        if (failed.length) toast(failed[0].reason?.message || 'Some changes were not saved.', 'error');
        else toast('Contact settings saved', 'success');
        setSaving(false);
    };

    const discard = async () => {
        if (!(await confirm({ title: 'Discard your changes?', message: 'The fields go back to how they were last saved.', confirmLabel: 'Discard changes', danger: true }))) return;
        setForm(f => ({
            ...f,
            ...toForm({ footer_contact: stored.footer_contact, social_links: stored.social_links, top_metals: stored.top_metals, show_service_breakdown: stored.show_service_breakdown }, { contact_form_recipients: stored.contact_form_recipients }),
        }));
        setErrors({});
    };

    const upload = async (key, file) => {
        setImageBusy(key);
        try {
            const value = await siteSettingsService.uploadImage(key, file);
            setImages(prev => ({ ...prev, [key]: value }));
            toast('Image saved', 'success');
        } catch (err) {
            toast(`Upload failed. ${err.message}`, 'error');
        } finally { setImageBusy(null); }
    };

    const removeImage = async (key, label) => {
        if (!(await confirm({ title: `Remove the ${label.toLowerCase()}?`, message: 'The site goes back to its built-in image straight away.', confirmLabel: 'Remove image', danger: true }))) return;
        setImageBusy(key);
        try {
            await siteSettingsService.save(key, '');
            setImages(prev => ({ ...prev, [key]: '' }));
            toast('Image removed', 'success');
        } catch (err) {
            toast(err.message, 'error');
        } finally { setImageBusy(null); }
    };

    return (
        <Page>
            <PageHeader
                icon={Contact}
                title="Contact"
                subtitle="Contact details, social links, footer content, logos and the quote display."
                actions={<Button icon={ExternalLink} href="/contact" target="_blank" rel="noreferrer">View contact page</Button>}
            />

            {error && <Banner tone="error" action={<Button size="sm" onClick={load}>Try again</Button>}>Could not load the settings. {error}</Banner>}

            {!error && <SideLayout
                main={(
                    <>
                        <ContactDetailsCard value={form.footer_contact} onChange={set('footer_contact')} errors={errors} loading={loading} />
                        <InboxCard value={form.contact_form_recipients} onChange={set('contact_form_recipients')} error={errors.inbox} publicEmail={form.footer_contact.email.trim()} loading={loading} />
                        <SocialLinksCard value={form.social_links} onChange={set('social_links')} errors={errors} loading={loading} />
                        <FooterMetalsCard value={form.top_metals} onChange={set('top_metals')} metals={metals} loading={loading} />
                        <QuoteDisplayCard value={form.show_service_breakdown} onChange={set('show_service_breakdown')} loading={loading} />
                    </>
                )}
                side={<SiteImagesCard values={images} onUpload={upload} onRemove={removeImage} busy={imageBusy} loading={loading} />}
            />}

            <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} disabled={loading || !!error} />
            {confirmDialog}
        </Page>
    );
}
