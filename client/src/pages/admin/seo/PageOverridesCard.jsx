import { FileText, RotateCcw } from 'lucide-react';
import { Button, Card, Field, Input, Tabs, Textarea } from '../../../components/admin/ui';
import { SEO_PAGES } from '../../../utils/seo';
import CharCount from '../content/CharCount';
import ImageUrlField from './ImageUrlField';
import { DESCRIPTION_RECOMMENDED, STATIC_FALLBACK, TITLE_RECOMMENDED, emptyPage, isCustomPage } from './seoForm';

/**
 * Per-page text: pick a page (green dot = has its own text), then its
 * title, description and share image. Empty fields use the defaults.
 * selected / onSelect: the page path (the preview follows it).
 */
export default function PageOverridesCard({ pages, defaults, selected, onSelect, setPage, errors, onUpload, uploading }) {
    const page = pages[selected] || emptyPage();
    const meta = SEO_PAGES.find(p => p.path === selected);
    const custom = isCustomPage(page);
    const customCount = SEO_PAGES.filter(p => isCustomPage(pages[p.path])).length;
    const shownTitle = page.title.trim() && defaults.titleTemplate.includes('%s') ? defaults.titleTemplate.replace('%s', page.title.trim()) : '';

    return (
        <Card
            title="Page by page"
            icon={FileText}
            count={customCount ? `${customCount} of ${SEO_PAGES.length} with their own text` : undefined}
            subtitle="Optional. Give a page its own title, description or share image; empty fields use the defaults."
        >
            <Tabs
                label="Page"
                value={selected}
                onChange={onSelect}
                items={SEO_PAGES.map(p => ({ value: p.path, label: p.label, dot: isCustomPage(pages[p.path]) ? 'green' : undefined }))}
            />
            <div className="ac-seo-page">
                <div className="ac-seo-page-head">
                    <p className="ac-seo-page-name">{meta?.label} <span className="ak-mono">{selected}</span></p>
                    {custom && (
                        <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => ['title', 'description', 'ogImage'].forEach(k => setPage(selected, k, ''))}>
                            Use the defaults
                        </Button>
                    )}
                </div>
                <Field label={<span className="ac-label-row">Page title <CharCount value={page.title} max={TITLE_RECOMMENDED} /></span>} hint={shownTitle ? `Shows as: ${shownTitle}` : 'Wrapped by the title template.'}>
                    <Input value={page.title} maxLength={150} onChange={e => setPage(selected, 'title', e.target.value)} placeholder={defaults.title || STATIC_FALLBACK.title} />
                </Field>
                <Field label={<span className="ac-label-row">Page description <CharCount value={page.description} max={DESCRIPTION_RECOMMENDED} /></span>}>
                    <Textarea rows={2} value={page.description} maxLength={500} onChange={e => setPage(selected, 'description', e.target.value)} placeholder={defaults.description || 'Uses the default meta description'} />
                </Field>
                <ImageUrlField
                    label="Page share image"
                    value={page.ogImage}
                    onChange={v => setPage(selected, 'ogImage', v)}
                    onUpload={onUpload}
                    uploading={uploading}
                    error={errors[`page:${selected}`]}
                    placeholder="Uses the default share image"
                />
            </div>
        </Card>
    );
}
