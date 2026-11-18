import { useEffect, useState } from 'react';
import { FileSearch } from 'lucide-react';
import { Banner, Card, Field, Select, Skeleton, Spinner } from '../../../components/admin/ui';
import { seoService } from '../../../services/admin/seo';
import { PAGE_CHOICES, tagHtml } from './headTagsForm';

const PAGE_OPTIONS = PAGE_CHOICES.map(p => ({
    value: p.path,
    label: p.path.endsWith('/*') ? `${p.label.replace(/^Every /, 'A ')} (${p.path.slice(0, -1)}…)` : `${p.label} (${p.path})`,
}));

/**
 * What the server puts into a page's <head> (backend/seo/head.js), built
 * from the unsaved values: built-in tags first, then the admin's own
 * (marked). seoMeta / headTags: the payloads the page would save.
 */
export default function HeadPreviewCard({ seoMeta, headTags }) {
    const [path, setPath] = useState('/');
    // The last answer and what it was asked for (path + values).
    const [shown, setShown] = useState({ key: '', result: null, error: '' });
    const body = JSON.stringify({ seoMeta, headTags });
    const key = `${path}\n${body}`;
    const { result, error } = shown;
    const loading = shown.key !== key;

    // Asks again a moment after the last change.
    useEffect(() => {
        const controller = new AbortController();
        const asked = `${path}\n${body}`;
        const timer = setTimeout(() => {
            seoService.previewHead({ path, ...JSON.parse(body) }, { signal: controller.signal })
                .then(data => setShown({ key: asked, result: data, error: '' }))
                .catch((err) => {
                    if (err.name !== 'AbortError') setShown(prev => ({ key: asked, result: prev.result, error: err.message }));
                });
        }, 450);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [path, body]);

    const yours = result ? result.tags.filter(t => t.source === 'yours').length : 0;

    return (
        <Card
            title="Page source"
            icon={FileSearch}
            subtitle="The <head> tags the server sends for a page, with your unsaved changes. Your own tags are marked in red."
            actions={loading ? <Spinner label="Updating the preview" /> : undefined}
        >
            <Field label="Page" hint={result && result.path !== path ? `Shown for ${result.path}` : undefined}>
                <Select value={path} onChange={e => setPath(e.target.value)} options={PAGE_OPTIONS} />
            </Field>
            {error && <Banner tone="error">Could not build the preview. {error}</Banner>}
            {!result && !error && <Skeleton size="block" />}
            {result && (
                <>
                    <p className="ac-seo-preview-label">
                        &lt;head&gt; · {result.tags.length} tags{yours ? ` · ${yours} yours` : ''}
                    </p>
                    <ol className="ac-seo-src" aria-label={`Head tags for ${result.path}`}>
                        {result.tags.map((t, i) => (
                            <li key={`${i}-${t.tag}`} className={t.source === 'yours' ? 'is-yours' : undefined}>
                                <code>{tagHtml(t, { mark: t.tag !== 'title' })}</code>
                            </li>
                        ))}
                    </ol>
                    {result.replaced?.length > 0 && (
                        <>
                            <p className="ac-seo-preview-label">Replaced by your tags on this page</p>
                            <ol className="ac-seo-src is-replaced">
                                {result.replaced.map(html => <li key={html}><code>{html}</code></li>)}
                            </ol>
                        </>
                    )}
                </>
            )}
        </Card>
    );
}
