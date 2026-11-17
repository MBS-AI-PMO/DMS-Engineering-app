import { Image as ImageIcon } from 'lucide-react';
import { Card } from '../../../components/admin/ui';
import ImageField from '../catalog/ImageField';

/** The metal's main picture (cards, the metal page and the quote page). */
export default function MetalImageCard({ metal, onChange, upload }) {
    return (
        <Card title="Picture" icon={ImageIcon} subtitle="Shown on metal cards and the metal page.">
            <ImageField
                value={metal.image_path}
                onChange={v => onChange('image_path', v)}
                upload={upload}
                alt={metal.name}
                aspect="4 / 3"
                placeholder="/uploads/metals/…"
                hint="JPG, PNG or WebP, up to 25 MB"
            />
        </Card>
    );
}
