import { AlertTriangle, AppWindow, BarChart3, Search, Share2 } from 'lucide-react';
import { Banner, Card, Field, FieldRow, Input, Select, Switch, Textarea } from '../../../components/admin/ui';
import CharCount from '../content/CharCount';
import ImageUrlField from './ImageUrlField';
import { DESCRIPTION_RECOMMENDED, PIXELS, STATIC_FALLBACK, TITLE_RECOMMENDED } from './seoForm';

/*
 * The cards of Admin > SEO & tracking that edit site-wide values. Each gets
 * the defaults (or pixels), a setter and the field errors; SeoPage owns
 * the state.
 */

const counted = (text, value, max) => <span className="ac-label-row">{text} <CharCount value={value} max={max} /></span>;

/* Title, description, keywords, canonical URL, indexing, Search Console. */
export function SearchDefaultsCard({ d, set, errors }) {
    const on = (key) => (e) => set(key, e.target.value);
    return (
        <Card title="Search engine defaults" icon={Search} subtitle="Used on every page unless the page has its own text below.">
            <Field label={counted('Default page title', d.title, TITLE_RECOMMENDED)}>
                <Input value={d.title} maxLength={150} onChange={on('title')} placeholder="Dynamic Manufacturing Solutions | Custom laser-cut metal parts" />
            </Field>
            <FieldRow>
                <Field label="Title template" hint="Wraps page titles: %s becomes the page title." error={errors.titleTemplate}>
                    <Input value={d.titleTemplate} maxLength={150} onChange={on('titleTemplate')} placeholder="%s | DMS" invalid={!!errors.titleTemplate} />
                </Field>
                <Field label="Site name" hint="Shown as the site name on social shares.">
                    <Input value={d.siteName} maxLength={100} onChange={on('siteName')} placeholder={STATIC_FALLBACK.siteName} />
                </Field>
            </FieldRow>
            <Field label={counted('Meta description', d.description, DESCRIPTION_RECOMMENDED)}>
                <Textarea rows={3} value={d.description} maxLength={500} onChange={on('description')} placeholder="Upload a CAD file and get instant pricing on custom laser-cut, bent and machined metal parts." />
            </Field>
            <Field label="Keywords" optional hint="Comma separated. Google ignores this tag; some other search engines still read it.">
                <Input value={d.keywords} maxLength={500} onChange={on('keywords')} placeholder="laser cutting, sheet metal fabrication, CNC machining" />
            </Field>
            <FieldRow>
                <Field label="Site address" optional hint="For canonical links and full image URLs. Empty uses the current domain." error={errors.siteUrl}>
                    <Input value={d.siteUrl} maxLength={200} onChange={on('siteUrl')} placeholder="https://dmscuts.com" invalid={!!errors.siteUrl} spellCheck={false} />
                </Field>
                <Field label="Search engine indexing" hint="Cart, checkout, account and admin pages are never indexed.">
                    <Select
                        value={d.robots}
                        onChange={on('robots')}
                        options={[{ value: 'index', label: 'Allow (index, follow)' }, { value: 'noindex', label: 'Block (noindex, nofollow)' }]}
                    />
                </Field>
            </FieldRow>
            <Field label="Google Search Console verification" optional hint="The code, or the whole meta tag Google gives you." error={errors.googleVerification}>
                <Input value={d.googleVerification} maxLength={300} onChange={on('googleVerification')} placeholder='Code or <meta name="google-site-verification" …>' invalid={!!errors.googleVerification} spellCheck={false} />
            </Field>
            {d.robots === 'noindex' && (
                <Banner tone="warn">Search engines are asked not to list any page of the site. Use this only while the site is not ready.</Banner>
            )}
        </Card>
    );
}

/* Open Graph / X card defaults. */
export function SocialSharingCard({ d, set, errors, onUpload, uploading }) {
    const on = (key) => (e) => set(key, e.target.value);
    return (
        <Card title="Social sharing" icon={Share2} subtitle="How links look on Facebook, LinkedIn, WhatsApp and X. Empty fields use the search text above.">
            <Field label={counted('Social title', d.ogTitle, TITLE_RECOMMENDED)}>
                <Input value={d.ogTitle} maxLength={150} onChange={on('ogTitle')} placeholder={d.title || STATIC_FALLBACK.title} />
            </Field>
            <Field label={counted('Social description', d.ogDescription, DESCRIPTION_RECOMMENDED)}>
                <Textarea rows={2} value={d.ogDescription} maxLength={500} onChange={on('ogDescription')} placeholder={d.description || 'Uses the meta description'} />
            </Field>
            <ImageUrlField
                label="Share image"
                hint="1200 × 630 px works everywhere."
                value={d.ogImage}
                onChange={v => set('ogImage', v)}
                onUpload={onUpload}
                uploading={uploading}
                error={errors.ogImage}
            />
            <FieldRow>
                <Field label="X card type">
                    <Select
                        value={d.twitterCard}
                        onChange={on('twitterCard')}
                        options={[{ value: 'summary_large_image', label: 'Large image' }, { value: 'summary', label: 'Small summary' }]}
                    />
                </Field>
                <Field label="X handle" optional error={errors.twitterSite}>
                    <Input value={d.twitterSite} maxLength={20} onChange={on('twitterSite')} placeholder="@yourcompany" invalid={!!errors.twitterSite} spellCheck={false} />
                </Field>
            </FieldRow>
        </Card>
    );
}

/* Favicon, home screen icon and the browser theme colour. */
export function BrowserIconsCard({ d, set, errors }) {
    const color = /^#[0-9a-f]{6}$/i.test(d.themeColor) ? d.themeColor : '#ffffff';
    return (
        <Card title="Browser icons" icon={AppWindow} subtitle="The icon in the browser tab and on phone home screens, and the colour some phones give the browser bar.">
            <ImageUrlField
                label="Favicon"
                hint="An .ico, .png or .svg file. Empty uses the built-in /favicon.ico."
                value={d.favicon}
                onChange={v => set('favicon', v)}
                error={errors.favicon}
                placeholder="/favicon.ico (built in)"
            />
            <ImageUrlField
                label="Home screen icon"
                hint="Used when someone adds the site to an iPhone or iPad home screen. A 180 × 180 px PNG."
                value={d.appleTouchIcon}
                onChange={v => set('appleTouchIcon', v)}
                error={errors.appleTouchIcon}
                placeholder="Optional, e.g. /apple-touch-icon.png"
            />
            <Field label="Theme colour" optional hint="Empty: the phone picks." error={errors.themeColor}>
                <span className="ac-seo-color">
                    <Input type="color" value={color} onChange={e => set('themeColor', e.target.value)} aria-label="Pick the theme colour" className="ac-seo-swatch" />
                    <Input value={d.themeColor} maxLength={7} onChange={e => set('themeColor', e.target.value.trim())} placeholder="#e31b23" invalid={!!errors.themeColor} spellCheck={false} className="ak-mono" />
                </span>
            </Field>
        </Card>
    );
}

/* GA4, Meta and TikTok: an on/off switch and an ID each. */
export function TrackingCard({ pixels, setPixel, errors }) {
    return (
        <Card title="Tracking pixels" icon={BarChart3} subtitle="Loaded on public pages only (never in admin), and only when on. Page views, add to cart, checkout and purchase are sent automatically.">
            <div className="ac-seo-pixels">
                {PIXELS.map(p => {
                    const state = pixels[p.key];
                    const error = errors[`pixel:${p.key}`];
                    return (
                        <div key={p.key} className={`ac-seo-pixel${state.enabled ? ' is-on' : ''}`}>
                            <div className="ac-seo-pixel-head">
                                <div>
                                    <p className="ac-seo-pixel-name">{p.name}</p>
                                    <p className="ak-hint">Find it in {p.where}</p>
                                </div>
                                <Switch label={state.enabled ? 'On' : 'Off'} checked={state.enabled} onChange={enabled => setPixel(p.key, { enabled })} />
                            </div>
                            <Field label={<>{p.idLabel}<span className="ak-sr"> for {p.name}</span></>} hint={p.format} error={error} className="ac-seo-pixel-field">
                                <Input
                                    value={state.id}
                                    maxLength={40}
                                    spellCheck={false}
                                    autoComplete="off"
                                    className="ak-mono"
                                    onChange={e => setPixel(p.key, { id: p.upper ? e.target.value.toUpperCase() : e.target.value })}
                                    placeholder={p.placeholder}
                                    invalid={!!error}
                                />
                            </Field>
                        </div>
                    );
                })}
            </div>
            <Banner tone="warn">
                <span className="ac-seo-inline"><AlertTriangle size={15} aria-hidden="true" /> Visitors in the EU, UK or California may need a cookie consent banner before these run. The site does not have one yet.</span>
            </Banner>
        </Card>
    );
}
