import { useMemo, useState } from 'react';
import { ClipboardPaste } from 'lucide-react';
import { Banner, Button, Field, Modal, Pill, Textarea } from '../../../components/admin/ui';
import { describeTag, parseSnippet, tagHtml, toDraft, validateDraft } from './headTagsForm';

/**
 * Paste the HTML a service gives you (Google, Bing, Pinterest, Meta…):
 * each <meta>, <link>, <script> and <noscript> in it becomes a head tag,
 * on for all pages. onAdd(tags) gets the ones that pass the checks.
 * room: how many more tags fit.
 */
export default function PasteTagsModal({ onAdd, onClose, room }) {
    const [html, setHtml] = useState('');
    const parsed = useMemo(() => {
        if (!html.trim()) return null;
        const { tags, skipped } = parseSnippet(html);
        return {
            skipped,
            rows: tags.map(tag => ({ tag, error: Object.values(validateDraft(toDraft(tag)))[0] || '' })),
        };
    }, [html]);
    const ready = parsed ? parsed.rows.filter(r => !r.error).map(r => r.tag) : [];
    const adding = ready.slice(0, Math.max(0, room));

    return (
        <Modal
            title="Paste HTML"
            subtitle="Paste the snippet you were given. Each tag in it is added for all pages; edit them afterwards to choose pages."
            size="lg"
            onClose={onClose}
            closeOnBackdrop={false}
            footer={(
                <>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button variant="primary" icon={ClipboardPaste} disabled={!adding.length} onClick={() => onAdd(adding)}>
                        {adding.length ? `Add ${adding.length} ${adding.length === 1 ? 'tag' : 'tags'}` : 'Add tags'}
                    </Button>
                </>
            )}
        >
            <div className="ac-seo-modal">
                <Field label="HTML snippet">
                    <Textarea
                        rows={7}
                        value={html}
                        onChange={e => setHtml(e.target.value)}
                        className="ak-mono ac-seo-codearea"
                        spellCheck={false}
                        placeholder={'<meta name="msvalidate.01" content="1234ABCD…" />'}
                        autoFocus
                    />
                </Field>
                {parsed && !parsed.rows.length && <Banner tone="warn">No &lt;meta&gt;, &lt;link&gt;, &lt;script&gt; or &lt;noscript&gt; tags found in that.</Banner>}
                {parsed && parsed.rows.length > 0 && (
                    <ul className="ac-seo-found" aria-label="Tags found">
                        {parsed.rows.map(({ tag, error }) => (
                            <li key={tag.id} className={error ? 'is-bad' : ''}>
                                <span className="ac-seo-found-head">
                                    <strong>{describeTag(tag)}</strong>
                                    {error ? <Pill tone="red">Can't add</Pill> : <Pill tone="green" dot>Ready</Pill>}
                                </span>
                                <code className="ac-seo-oneline">{tagHtml(tag)}</code>
                                {error && <span className="ak-error-text">{error}</span>}
                            </li>
                        ))}
                    </ul>
                )}
                {parsed?.skipped.length > 0 && <p className="ak-hint">Left out: {parsed.skipped.join(', ')} (not a head tag this page can add).</p>}
                {ready.length > adding.length && <Banner tone="warn">Only {adding.length} more tags fit (50 at most).</Banner>}
            </div>
        </Modal>
    );
}
