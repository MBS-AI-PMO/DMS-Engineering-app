import { useState } from 'react';
import { Globe } from 'lucide-react';
import { Card, Field, ImageDrop, Input, Textarea } from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { blogService } from '../../../services/admin/blog';
import { imageVariant } from '../../../utils/imageUrl';
import CharCount from '../content/CharCount';

/**
 * How the post shows in Google and in link previews: SEO title and
 * description (with recommended lengths), a share picture (the cover
 * when empty) and a Google-style preview of the result.
 * seo: the site's SEO defaults ({ titleTemplate, siteUrl }) for the preview.
 */
export default function SeoCard({ form, set, seo, autoExcerpt }) {
    const toast = useToast();
    const [busy, setBusy] = useState(false);

    const title = form.seo_title.trim() || form.title.trim() || 'Untitled post';
    const shownTitle = seo?.titleTemplate ? seo.titleTemplate.replace('%s', title) : title;
    const description = form.seo_description.trim() || form.excerpt.trim() || autoExcerpt || 'Add a summary or an SEO description; search engines will otherwise pick text from the post.';
    let host = window.location.host;
    try { if (seo?.siteUrl) host = new URL(seo.siteUrl).host; } catch { /* keep this host */ }

    const upload = async (file) => {
        setBusy(true);
        try {
            const img = await blogService.uploadImage(file);
            set({ og_image: img.url });
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card title="Search and sharing" icon={Globe}>
            <div className="be-serp" aria-label="Google result preview">
                <span className="be-serp-url">{host} › blog › {form.slug || '…'}</span>
                <span className="be-serp-title">{shownTitle}</span>
                <span className="be-serp-desc">{description}</span>
            </div>

            <Field label={<>SEO title <CharCount value={form.seo_title} max={60} /></>} optional hint="The title in Google and on the browser tab. Empty: the post title.">
                <Input value={form.seo_title} onChange={e => set({ seo_title: e.target.value })} maxLength={160} placeholder={form.title || 'Post title'} />
            </Field>
            <Field label={<>SEO description <CharCount value={form.seo_description} max={160} /></>} optional hint="The text under the title in Google. Empty: the summary.">
                <Textarea rows={3} value={form.seo_description} onChange={e => set({ seo_description: e.target.value })} maxLength={320} placeholder={form.excerpt || autoExcerpt || 'What the post is about, in a sentence or two'} />
            </Field>
            <Field as="div" label="Share picture" optional hint="Shown when the post is shared on social media. Empty: the cover.">
                <ImageDrop
                    src={form.og_image ? imageVariant(form.og_image, 640) : ''}
                    onFile={upload}
                    onRemove={() => set({ og_image: '' })}
                    busy={busy}
                    aspect="1.91 / 1"
                    hint="1200 × 630 works everywhere"
                />
            </Field>
        </Card>
    );
}
