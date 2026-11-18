import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { blogExtensions } from './extensions';
import EditorToolbar from './EditorToolbar';
import SelectionBubble from './SelectionBubble';
import YoutubeDialog from './YoutubeDialog';
import '../../../../styles/BlogArticle.css';
import './editor.css';

/**
 * The post's text editor (TipTap). Loaded on its own, only on the admin
 * editor page, so the site never downloads it.
 *
 * The text is shown with the site's article styles (what you see is what
 * readers get), with a sticky toolbar, a bar over selected text, a "/"
 * menu for blocks, Markdown shortcuts, and pictures by button, drag and
 * drop or paste (uploaded, then placed where they were dropped).
 *
 *   initialContent  the document to start from (remount with a new key to reset)
 *   onChange(doc, words)   doc is null on the first call (words only)
 *   onUpload(file) -> Promise<{ url, width, height }>
 *   onError(message), onPreview(), focus + onToggleFocus(), scrollTarget (for the bubble)
 *   onReady(editor)  once it exists (the page focuses it from the title)
 */
export default function PostEditor({ initialContent, onChange, onUpload, onError, onPreview, onReady, focus, onToggleFocus, scrollTarget }) {
    const [linkOpen, setLinkOpen] = useState(false);
    const [youtubeOpen, setYoutubeOpen] = useState(false);
    const [uploading, setUploading] = useState(0);
    const fileRef = useRef(null);
    const editorRef = useRef(null);
    const callbacks = useRef({});
    useEffect(() => { callbacks.current = { onChange, onUpload, onError, onReady }; });

    // Uploads pictures one by one and puts each where it was dropped (or at the cursor).
    const uploadFiles = useRef(null);
    uploadFiles.current = async (files, at) => {
        const images = [...files].filter(f => /^image\//.test(f.type) || /\.(heic|heif)$/i.test(f.name));
        if (!images.length) return;
        setUploading(n => n + images.length);
        let pos = at;
        for (const file of images) {
            try {
                const img = await callbacks.current.onUpload(file);
                const editor = editorRef.current;
                if (!img || !editor || editor.isDestroyed) continue;
                const node = { type: 'image', attrs: { src: img.url, alt: '', width: img.width || null, height: img.height || null } };
                if (pos === undefined || pos === null) {
                    editor.chain().focus().insertContent(node).run();
                } else {
                    editor.chain().focus().insertContentAt(Math.min(pos, editor.state.doc.content.size), node).run();
                    pos = editor.state.selection.to;
                }
            } catch (err) {
                callbacks.current.onError?.(err.message || 'The picture could not be uploaded.');
            } finally {
                setUploading(n => n - 1);
            }
        }
    };

    // The extensions get stable functions that call the latest ones.
    const extensions = useMemo(() => blogExtensions({
        upload: (file) => callbacks.current.onUpload(file),
        pickImage: () => fileRef.current?.click(),
        openYoutube: () => setYoutubeOpen(true),
        openLink: () => setLinkOpen(true),
    }), []);

    const editor = useEditor({
        extensions,
        content: initialContent,
        immediatelyRender: true,
        shouldRerenderOnTransaction: false,
        editorProps: {
            attributes: { class: 'bp-prose be-prose', 'aria-label': 'Post text', spellcheck: 'true' },
            handleDrop: (view, event, _slice, moved) => {
                const files = event.dataTransfer?.files;
                if (moved || !files?.length || ![...files].some(f => /^image\//.test(f.type))) return false;
                event.preventDefault();
                const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
                uploadFiles.current(files, at ? at.pos : null);
                return true;
            },
            handlePaste: (_view, event) => {
                const files = event.clipboardData?.files;
                if (!files?.length || ![...files].some(f => /^image\//.test(f.type))) return false;
                event.preventDefault();
                uploadFiles.current(files, null);
                return true;
            },
        },
        onCreate: ({ editor: e }) => callbacks.current.onChange?.(null, e.storage.characterCount.words()),
        onUpdate: ({ editor: e }) => callbacks.current.onChange?.(e.getJSON(), e.storage.characterCount.words()),
    }, []);

    useEffect(() => {
        editorRef.current = editor;
        if (editor) callbacks.current.onReady?.(editor);
    }, [editor]);

    if (!editor) return null;
    return (
        <div className="be-editor-body">
            <EditorToolbar
                editor={editor}
                linkOpen={linkOpen}
                setLinkOpen={setLinkOpen}
                onPickImage={() => fileRef.current?.click()}
                onYoutube={() => setYoutubeOpen(true)}
                focus={focus}
                onToggleFocus={onToggleFocus}
                onPreview={onPreview}
                uploading={uploading}
            />
            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={e => { uploadFiles.current(e.target.files, null); e.target.value = ''; }}
            />
            <SelectionBubble editor={editor} scrollTarget={scrollTarget} />
            <EditorContent editor={editor} className="be-content" />
            {youtubeOpen && (
                <YoutubeDialog
                    onClose={() => { setYoutubeOpen(false); editor.commands.focus(); }}
                    onInsert={({ src, start }) => {
                        setYoutubeOpen(false);
                        editor.chain().focus().setYoutubeVideo({ src, start }).run();
                    }}
                />
            )}
        </div>
    );
}
