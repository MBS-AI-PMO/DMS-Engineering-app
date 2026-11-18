import { useRef, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { AlertCircle, Replace, Trash2, Type } from 'lucide-react';
import { imageVariant } from '../../../../utils/imageUrl';

/**
 * A picture in the editor: the image, a caption typed under it, and on
 * hover or selection tools to describe it (alt text), replace it or
 * remove it. Missing descriptions are flagged. extension.options.upload(file)
 * uploads a replacement and resolves to { url, width, height }.
 */
export default function ImageView({ node, updateAttributes, deleteNode, selected, extension }) {
    const { src, alt, caption, width, height } = node.attrs;
    const [altOpen, setAltOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const fileRef = useRef(null);

    const replace = async (file) => {
        if (!file || !extension.options.upload) return;
        setBusy(true);
        try {
            const img = await extension.options.upload(file);
            if (img) updateAttributes({ src: img.url, width: img.width, height: img.height });
        } finally {
            setBusy(false);
        }
    };

    return (
        <NodeViewWrapper as="figure" className={`be-figure${selected ? ' is-selected' : ''}${busy ? ' is-busy' : ''}`}>
            <div className="be-figure-media" contentEditable={false} data-drag-handle="">
                <img src={imageVariant(src, 960)} alt={alt || ''} width={width || undefined} height={height || undefined} draggable={false} />
                <div className="be-figure-tools">
                    <button type="button" className={`be-chip${alt ? '' : ' is-warn'}`} onClick={() => setAltOpen(v => !v)} aria-expanded={altOpen}>
                        {alt ? <Type size={13} aria-hidden="true" /> : <AlertCircle size={13} aria-hidden="true" />}
                        {alt ? 'Description' : 'Add description'}
                    </button>
                    <button type="button" className="be-chip" onClick={() => fileRef.current?.click()} disabled={busy}>
                        <Replace size={13} aria-hidden="true" /> {busy ? 'Uploading…' : 'Replace'}
                    </button>
                    <button type="button" className="be-chip is-danger" onClick={deleteNode} aria-label="Remove picture">
                        <Trash2 size={13} aria-hidden="true" />
                    </button>
                </div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { replace(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            {altOpen && (
                <label className="be-figure-alt" contentEditable={false}>
                    <span>Description (alt text): what the picture shows, for screen readers and search engines</span>
                    <input
                        value={alt || ''}
                        onChange={e => updateAttributes({ alt: e.target.value.slice(0, 250) })}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setAltOpen(false); } }}
                        placeholder="e.g. Flat pattern of a bracket in a CAD program"
                        maxLength={250}
                        autoFocus
                    />
                </label>
            )}
            <figcaption contentEditable={false}>
                <input
                    className="be-caption"
                    value={caption || ''}
                    onChange={e => updateAttributes({ caption: e.target.value.slice(0, 300) || null })}
                    placeholder="Add a caption (optional)"
                    aria-label="Caption"
                    maxLength={300}
                />
            </figcaption>
        </NodeViewWrapper>
    );
}
