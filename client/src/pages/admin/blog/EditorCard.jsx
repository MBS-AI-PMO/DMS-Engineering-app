import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Minimize2 } from 'lucide-react';
import { Skeleton } from '../../../components/admin/ui';
import SaveState from './SaveState';

// TipTap is only downloaded here, on the admin editor page.
const PostEditor = lazy(() => import('./editor/PostEditor'));

function EditorLoading() {
    return (
        <div className="be-editor-loading" aria-busy="true" aria-label="Loading the editor">
            <div className="be-toolbar is-placeholder"><Skeleton width="62%" /></div>
            <div className="be-editor-sk">
                <Skeleton width="92%" /><Skeleton width="86%" /><Skeleton width="74%" /><Skeleton width="40%" />
            </div>
        </div>
    );
}

/**
 * The main column: the title, the text editor and a footer with the
 * length and save state. Focus mode turns it into a full-window writing
 * view (Esc leaves). editorKey: a new key starts the editor afresh from
 * form.content (after loading, restoring or discarding).
 */
export default function EditorCard({ form, setTitle, editorKey, onContent, words, saver, onUpload, onError, onPreview, focus, setFocus }) {
    const [cardEl, setCardEl] = useState(null);
    const titleRef = useRef(null);
    const editorRef = useRef(null);
    // The bubble over selected text follows whichever area scrolls.
    const scrollEl = focus ? cardEl : cardEl?.closest('#admin-content') || null;

    // The title grows with its text.
    useLayoutEffect(() => {
        const el = titleRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }, [form.title, focus]);

    useEffect(() => {
        if (!focus) return undefined;
        const onKey = (e) => {
            if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('.ak-modal-backdrop, .ak-popover, .be-slash-host')) return;
            setFocus(false);
        };
        document.addEventListener('keydown', onKey);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = overflow;
        };
    }, [focus, setFocus]);

    const minutes = Math.max(1, Math.round(words / 225));

    return (
        <section ref={setCardEl} className={`be-editor-card${focus ? ' is-focus' : ''}`} aria-label="Post text">
            {focus && (
                <div className="be-focus-bar">
                    <SaveState saver={saver} />
                    <span className="be-focus-count">{words.toLocaleString()} words · {minutes} min read</span>
                    <button type="button" className="ak-btn is-sm" onClick={() => setFocus(false)}><Minimize2 size={14} aria-hidden="true" /> Leave focus mode</button>
                </div>
            )}
            <div className="be-editor-inner">
                <textarea
                    ref={titleRef}
                    className="be-title-input"
                    value={form.title}
                    onChange={e => setTitle(e.target.value.replace(/\n/g, ' '))}
                    onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); editorRef.current?.commands.focus('start'); }
                    }}
                    placeholder="Post title"
                    aria-label="Title"
                    maxLength={200}
                    rows={1}
                />
                <Suspense fallback={<EditorLoading />}>
                    <PostEditor
                        key={editorKey}
                        initialContent={form.content}
                        onChange={onContent}
                        onUpload={onUpload}
                        onError={onError}
                        onPreview={onPreview}
                        onReady={(editor) => { editorRef.current = editor; }}
                        focus={focus}
                        onToggleFocus={() => setFocus(!focus)}
                        scrollTarget={scrollEl}
                    />
                </Suspense>
            </div>
            {!focus && (
                <footer className="be-editor-foot">
                    <span>{words.toLocaleString()} {words === 1 ? 'word' : 'words'} · {minutes} min read</span>
                    <SaveState saver={saver} />
                </footer>
            )}
        </section>
    );
}
