import { Image as ImageIcon, Settings2 } from 'lucide-react';
import { Card, Field, Input, Switch } from '../../../components/admin/ui';
import ImageField from '../catalog/ImageField';

/** The service picture, and where / whether it is listed. */
export default function ServiceSideCards({ service, onChange, upload }) {
    return (
        <>
            <Card title="Picture" icon={ImageIcon} subtitle="Shown on service cards and the services page.">
                <ImageField
                    value={service.image_path}
                    onChange={v => onChange('image_path', v)}
                    upload={upload}
                    alt={service.title}
                    placeholder="/uploads/services/…"
                    hint="JPG, PNG, WebP or SVG, up to 25 MB"
                />
            </Card>
            <Card title="Listing" icon={Settings2}>
                <Switch
                    label="Visible on the website"
                    description="Hidden services keep their settings but are not offered."
                    checked={service.is_active !== false}
                    onChange={v => onChange('is_active', v)}
                />
                <hr className="ak-divider" />
                <Field label="Sort order" hint="Lower numbers are listed first.">
                    <Input type="number" step="1" value={service.display_order} onChange={e => onChange('display_order', e.target.value)} />
                </Field>
            </Card>
        </>
    );
}
