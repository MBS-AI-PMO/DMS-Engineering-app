import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { Card, Field, ImageDrop, Input } from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { blogService } from '../../../services/admin/blog';
import { imageVariant } from '../../../utils/imageUrl';

/**
 * The cover picture (top of the post, on its card in the blog list and in
 * link previews) and its description for screen readers and search engines.
 */
export default function CoverCard({ form, set }) {
    const toast = useToast();
    const [busy, setBusy] = useState(false);

    const upload = async (file) => {
        setBusy(true);
        try {
            const img = await blogService.uploadImage(file);
            set({ cover_image: img.url });
            toast('Cover added', 'success');
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card title="Cover picture" icon={ImageIcon} subtitle="Wide pictures work best (16:9 or wider).">
            <ImageDrop
                src={form.cover_image ? imageVariant(form.cover_image, 640) : ''}
                alt={form.cover_alt}
                onFile={upload}
                onRemove={() => set({ cover_image: '' })}
                busy={busy}
                hint="JPG, PNG or WebP, up to 15 MB"
            />
            {form.cover_image && (
                <Field label="Description" hint="What the picture shows, for screen readers and search engines.">
                    <Input value={form.cover_alt} onChange={e => set({ cover_alt: e.target.value })} maxLength={250} placeholder="e.g. Laser-cut steel brackets on a bench" />
                </Field>
            )}
        </Card>
    );
}
