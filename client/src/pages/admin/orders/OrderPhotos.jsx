import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Eye, EyeOff, ImagePlus, Trash2, Upload } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { Button, Card, Checkbox, IconButton, Input, Modal, Select, useConfirm } from '../../../components/admin/ui';
import { ordersApi } from './ordersApi';
import { dateText } from './orderFormat';

/**
 * Photos the shop takes of an order (finished parts, packing, QC). Each can
 * be shown to the customer on their order page or kept for staff, tied to a
 * part, captioned, and attached to an email from "Email the customer".
 */
export default function OrderPhotos({ orderId, photos, items, onChanged }) {
    const toast = useToast();
    const [confirm, confirmDialog] = useConfirm();
    const inputRef = useRef(null);
    const [visible, setVisible] = useState(true);
    const [itemId, setItemId] = useState('');
    const [uploading, setUploading] = useState(0);
    const [dragging, setDragging] = useState(false);
    const [open, setOpen] = useState(null); // index in photos
    const [editing, setEditing] = useState(null); // { id, caption }

    const partName = (id) => {
        const index = items.findIndex(i => i.id === id);
        return index >= 0 ? `Part ${index + 1}` : '';
    };

    const upload = async (fileList) => {
        const files = [...(fileList || [])].filter(f => /^image\//.test(f.type) || /\.(heic|heif)$/i.test(f.name));
        if (!files.length) { toast('Choose image files (JPG, PNG, WebP or HEIC).', 'warning'); return; }
        const form = new FormData();
        files.slice(0, 12).forEach(f => form.append('photos', f));
        form.append('customer_visible', String(visible));
        if (itemId) form.append('order_item_id', itemId);
        setUploading(files.length);
        try {
            const result = await ordersApi.addPhotos(orderId, form);
            if (result.added.length) toast(`${result.added.length} photo${result.added.length > 1 ? 's' : ''} added`, 'success');
            result.failed.forEach(f => toast(`${f.name}: ${f.error}`, 'warning'));
            if (files.length > 12) toast('Only the first 12 photos were uploaded. Add the rest in another go.', 'info');
            await onChanged();
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            setUploading(0);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    const save = async (photo, body, message) => {
        try {
            await ordersApi.savePhoto(orderId, photo.id, body);
            if (message) toast(message, 'success');
            await onChanged();
        } catch (err) { toast(err.message, 'error'); }
    };

    const remove = async (photo) => {
        if (!(await confirm({ title: 'Delete this photo?', message: photo.customer_visible ? 'The customer will no longer see it either.' : undefined, confirmLabel: 'Delete', danger: true }))) return;
        try {
            await ordersApi.deletePhoto(orderId, photo.id);
            setOpen(null);
            await onChanged();
        } catch (err) { toast(err.message, 'error'); }
    };

    const current = open !== null ? photos[open] : null;
    useEffect(() => {
        if (open === null) return undefined;
        const onKey = (e) => {
            if (e.key === 'ArrowRight') setOpen(i => (i + 1) % photos.length);
            if (e.key === 'ArrowLeft') setOpen(i => (i - 1 + photos.length) % photos.length);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, photos.length]);

    const dropProps = {
        onDragOver: (e) => { e.preventDefault(); setDragging(true); },
        onDragLeave: () => setDragging(false),
        onDrop: (e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); },
    };

    return (
        <Card
            id="ao-photos"
            title="Photos"
            count={photos.length}
            {...dropProps}
            actions={(
                <>
                    {items.length > 1 && (
                        <Select
                            size="sm"
                            value={itemId}
                            onChange={e => setItemId(e.target.value)}
                            aria-label="Which part the new photos show"
                            placeholder="Whole order"
                            options={items.map((it, i) => ({ value: String(it.id), label: `Part ${i + 1}: ${it.file_name}` }))}
                        />
                    )}
                    <Checkbox label="Customer can see" checked={visible} onChange={setVisible} />
                    <Button variant="primary" icon={Upload} loading={uploading > 0} onClick={() => inputRef.current?.click()}>
                        {uploading ? `Uploading ${uploading}…` : 'Add photos'}
                    </Button>
                    <input ref={inputRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={e => upload(e.target.files)} />
                </>
            )}
        >
            {photos.length === 0 ? (
                <button type="button" className={`ak-dropzone${dragging ? ' is-over' : ''}`} onClick={() => inputRef.current?.click()}>
                    <ImagePlus size={26} aria-hidden="true" />
                    <span className="ak-cell-main">Drop photos here or click to choose</span>
                    <span className="ak-hint">Finished parts, packing, quality checks. Up to 12 at a time, 25 MB each. Phone photos are turned upright and location data is removed.</span>
                </button>
            ) : (
                <ul className={`ao-photo-grid${dragging ? ' is-over' : ''}`}>
                    {photos.map((p, i) => (
                        <li key={p.id} className="ao-photo">
                            <button type="button" className="ao-photo-img" onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1}${p.caption ? `: ${p.caption}` : ''}`}>
                                <img src={p.thumb_url} alt={p.caption || `Order photo ${i + 1}`} loading="lazy" decoding="async" width={p.width || undefined} height={p.height || undefined} />
                            </button>
                            <div className="ao-photo-meta">
                                {editing?.id === p.id ? (
                                    <form onSubmit={e => { e.preventDefault(); save(p, { caption: editing.caption }); setEditing(null); }}>
                                        <Input size="sm" value={editing.caption} maxLength={300} autoFocus onChange={e => setEditing({ ...editing, caption: e.target.value })} aria-label="Caption" onKeyDown={e => { if (e.key === 'Escape') setEditing(null); }} />
                                    </form>
                                ) : (
                                    <button type="button" className={`ao-caption${p.caption ? '' : ' is-empty'}`} onClick={() => setEditing({ id: p.id, caption: p.caption || '' })}>
                                        {p.caption || 'Add a caption'}
                                    </button>
                                )}
                                <div className="ao-photo-tags">
                                    <button
                                        type="button"
                                        className={`ak-pill ${p.customer_visible ? 'is-green' : 'is-gray'} ao-pill-button`}
                                        onClick={() => save(p, { customer_visible: !p.customer_visible }, p.customer_visible ? 'Hidden from the customer' : 'The customer can see this photo')}
                                        title={p.customer_visible ? "Shown on the customer's order page. Click to hide." : 'Staff only. Click to show the customer.'}
                                    >
                                        {p.customer_visible ? <Eye size={12} aria-hidden="true" /> : <EyeOff size={12} aria-hidden="true" />}
                                        {p.customer_visible ? 'Customer' : 'Staff only'}
                                    </button>
                                    {p.order_item_id && <span className="ak-pill is-gray">{partName(p.order_item_id)}</span>}
                                    <IconButton icon={Trash2} label="Delete photo" variant="danger" size="xs" onClick={() => remove(p)} className="ao-photo-delete" />
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {current && (
                <Modal
                    size="xl"
                    title={current.caption || `Photo ${open + 1} of ${photos.length}`}
                    subtitle={`${current.original_name || ''}${current.created_at ? ` · added ${dateText(current.created_at, true)}` : ''}${current.actor_email ? ` by ${current.actor_email}` : ''}`}
                    onClose={() => setOpen(null)}
                    footer={(
                        <>
                            <Button href={current.url} download={current.original_name || `photo-${current.id}.jpg`} icon={Download}>Download</Button>
                            <Button variant="danger" icon={Trash2} onClick={() => remove(current)}>Delete</Button>
                        </>
                    )}
                >
                    <div className="ao-lightbox">
                        {photos.length > 1 && <button type="button" className="ao-lightbox-nav is-prev" onClick={() => setOpen((open - 1 + photos.length) % photos.length)} aria-label="Previous photo"><ChevronLeft size={22} /></button>}
                        <img src={current.url} alt={current.caption || `Order photo ${open + 1}`} />
                        {photos.length > 1 && <button type="button" className="ao-lightbox-nav is-next" onClick={() => setOpen((open + 1) % photos.length)} aria-label="Next photo"><ChevronRight size={22} /></button>}
                    </div>
                </Modal>
            )}
            {confirmDialog}
        </Card>
    );
}
