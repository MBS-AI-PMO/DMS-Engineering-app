import { AlertTriangle, Eye } from 'lucide-react';
import { Banner, Card, Field, Select } from '../../../components/admin/ui';
import { SEO_PAGES, isSafeImageUrl, resolveSeo } from '../../../utils/seo';
import { STATIC_FALLBACK, buildSeoPayload } from './seoForm';

/**
 * How the picked page shows in Google and in a link preview, with the
 * unsaved values. path / onPath: the page shown.
 */
export default function SeoPreviewCard({ form, path, onPath }) {
    const payload = buildSeoPayload(form);
    const preview = resolveSeo(payload, path, STATIC_FALLBACK, window.location.origin);
    const image = [form.pages[path]?.ogImage, form.defaults.ogImage].find(isSafeImageUrl) || '';
    let host = window.location.host;
    try { host = new URL(preview.canonical).host; } catch { /* no canonical: current host */ }
    const crumb = path === '/' ? '' : ` › ${path.slice(1).replace(/\//g, ' › ')}`;

    return (
        <Card title="Preview" icon={Eye} subtitle="Shows your unsaved changes.">
            <Field label="Page">
                <Select value={path} onChange={e => onPath(e.target.value)} options={SEO_PAGES.map(p => ({ value: p.path, label: `${p.label} (${p.path})` }))} />
            </Field>

            <p className="ac-seo-preview-label">Google result</p>
            <div className="ac-seo-serp">
                <div className="ac-seo-serp-url">{host}{crumb}</div>
                <div className="ac-seo-serp-title">{preview.title || 'Untitled page'}</div>
                <div className="ac-seo-serp-desc">{preview.description || 'No description. Search engines will pick text from the page.'}</div>
            </div>

            <p className="ac-seo-preview-label">Link preview</p>
            <div className="ac-seo-social">
                <div className="ac-seo-social-img">
                    {image ? <img src={image} alt="" /> : <span>No share image</span>}
                </div>
                <div className="ac-seo-social-body">
                    <div className="ac-seo-social-host">{host}</div>
                    <div className="ac-seo-social-title">{preview.og.title || 'Untitled page'}</div>
                    {preview.og.description && <div className="ac-seo-social-desc">{preview.og.description}</div>}
                </div>
            </div>

            {preview.robots.startsWith('noindex') && (
                <Banner tone="warn"><span className="ac-seo-inline"><AlertTriangle size={15} aria-hidden="true" /> Search engines are asked not to index this page.</span></Banner>
            )}
            <p className="ak-hint ac-seo-note">
                Google and Bing run the site's scripts, so they see these tags on every page. Facebook, LinkedIn and WhatsApp
                previews don't run scripts yet, so for now they show the fixed title and description built into the site.
            </p>
        </Card>
    );
}
