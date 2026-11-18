import { useState } from 'react';
import { AlertTriangle, Eye, ImageOff, ImagePlus, Upload } from 'lucide-react';
import { Banner, Button, Card, Field, Select } from '../../../components/admin/ui';
import { SEO_PAGES, isSafeImageUrl, resolveSeo } from '../../../utils/seo';
import { STATIC_FALLBACK, buildSeoPayload } from './seoForm';

/**
 * How the picked page shows in Google and in a link preview, with the
 * unsaved values. path / onPath: the page shown. onUpload(target) picks a
 * share image ('default' or the page's path): the page's own one when it has
 * one, else the site-wide one; uploading: the target being uploaded.
 */
export default function SeoPreviewCard({ form, path, onPath, onUpload, uploading }) {
    const [brokenSrc, setBrokenSrc] = useState('');
    const payload = buildSeoPayload(form);
    const preview = resolveSeo(payload, path, STATIC_FALLBACK, window.location.origin);
    const image = [form.pages[path]?.ogImage, form.defaults.ogImage].find(isSafeImageUrl) || '';
    let host = window.location.host;
    try { host = new URL(preview.canonical).host; } catch { /* no canonical: current host */ }
    const crumb = path === '/' ? '' : ` › ${path.slice(1).replace(/\//g, ' › ')}`;
    const target = form.pages[path]?.ogImage ? path : 'default';
    const broken = Boolean(image) && brokenSrc === image;
    const busy = uploading === target;

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
                <div className={`ac-seo-social-img${!image || broken ? ' is-empty' : ''}`}>
                    {image && !broken && <img key={image} src={image} alt="" onError={() => setBrokenSrc(image)} />}
                    {(!image || broken) && (
                        <span className="ac-seo-social-empty">
                            {broken ? <ImageOff size={22} aria-hidden="true" /> : <ImagePlus size={22} aria-hidden="true" />}
                            {broken ? 'The share image is missing on the server' : 'No share image'}
                        </span>
                    )}
                    {onUpload && (
                        <Button
                            size="sm"
                            icon={Upload}
                            loading={busy}
                            className={`ac-seo-social-upload${!image || broken ? ' is-shown' : ''}`}
                            onClick={() => onUpload(target)}
                        >
                            {image && !broken ? 'Change image' : 'Upload image'}
                        </Button>
                    )}
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
                These tags are in each page's HTML as the server sends it, so Google, Facebook, LinkedIn, WhatsApp and X all
                see them. Saved changes show in the page source within a minute. Metal, service and blog pages use their own
                name, description and picture.
            </p>
        </Card>
    );
}
