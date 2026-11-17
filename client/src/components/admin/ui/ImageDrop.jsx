import { useRef, useState } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { Button, IconButton } from './Button';

/**
 * One image: shows the current one (src) or a drop zone; choosing or
 * dropping a file calls onFile(file). onRemove (optional) clears it.
 * aspect: CSS aspect-ratio of the preview ('16 / 9', '1', …).
 */
export function ImageDrop({ src, alt = '', onFile, onRemove, busy = false, aspect = '16 / 9', hint = 'JPG, PNG or WebP', accept = 'image/*' }) {
    const inputRef = useRef(null);
    const [over, setOver] = useState(false);
    const pick = () => inputRef.current?.click();
    const take = (files) => { const f = files?.[0]; if (f) onFile(f); };
    const dropProps = {
        onDragOver: (e) => { e.preventDefault(); setOver(true); },
        onDragLeave: () => setOver(false),
        onDrop: (e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); },
    };
    return (
        <div {...dropProps}>
            <input ref={inputRef} type="file" accept={accept} hidden onChange={e => { take(e.target.files); e.target.value = ''; }} />
            {src ? (
                <div className="ak-stack is-tight">
                    <div className="ak-image-tile" style={{ aspectRatio: aspect }}>
                        <img src={src} alt={alt} loading="lazy" decoding="async" />
                    </div>
                    <div className="ak-row-actions">
                        <Button size="sm" icon={Upload} onClick={pick} loading={busy}>Replace</Button>
                        {onRemove && <IconButton icon={Trash2} label="Remove image" variant="danger" size="xs" onClick={onRemove} disabled={busy} />}
                    </div>
                </div>
            ) : (
                <button type="button" className={`ak-dropzone${over ? ' is-over' : ''}`} onClick={pick} disabled={busy} style={{ aspectRatio: aspect }}>
                    <ImagePlus size={24} aria-hidden="true" />
                    <span className="ak-cell-main">{busy ? 'Uploading…' : 'Drop an image or click to choose'}</span>
                    <span className="ak-hint">{hint}</span>
                </button>
            )}
        </div>
    );
}
