import { useCallback, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button, IconButton } from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import ImageZoom from '../catalog/ImageZoom';

/** The showcase pictures of one thickness: add (upload), view large, remove. */
export default function ShowcaseImages({ images = [], onChange, upload, thickness }) {
    const toast = useToast();
    const inputRef = useRef(null);
    const [busy, setBusy] = useState(false);
    const [zoom, setZoom] = useState(null);
    const closeZoom = useCallback(() => setZoom(null), []);

    const add = async (file) => {
        if (!file) return;
        setBusy(true);
        try {
            const path = await upload(file);
            onChange([...images, path]);
            toast('Picture added. Save to keep it.', 'success');
        } catch (err) {
            toast(`Upload failed: ${err.message}`, 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="ak-stack is-tight">
            {images.length > 0 ? (
                <div className="cat-gallery">
                    {images.map((src, i) => (
                        <div key={`${src}-${i}`} className="cat-gallery-item">
                            <div className="ak-image-tile">
                                <button type="button" onClick={() => setZoom({ src, title: `${thickness} · picture ${i + 1}` })} aria-label={`View picture ${i + 1} larger`}>
                                    <img src={src} alt="" loading="lazy" decoding="async" />
                                </button>
                            </div>
                            <IconButton className="cat-gallery-remove" icon={X} size="xs" variant="danger" label={`Remove picture ${i + 1}`} onClick={() => onChange(images.filter((_, idx) => idx !== i))} />
                        </div>
                    ))}
                </div>
            ) : (
                <p className="cat-rows-empty">No showcase pictures for {thickness} yet.</p>
            )}
            <div>
                <input ref={inputRef} type="file" accept="image/*" hidden onChange={e => { add(e.target.files?.[0]); e.target.value = ''; }} />
                <Button size="sm" icon={ImagePlus} loading={busy} onClick={() => inputRef.current?.click()}>Add picture</Button>
            </div>
            <ImageZoom image={zoom} onClose={closeZoom} />
        </div>
    );
}
