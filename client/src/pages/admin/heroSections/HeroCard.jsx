import { ExternalLink } from 'lucide-react';
import { Card, IconButton, ImageDrop, Pill } from '../../../components/admin/ui';
import { heroPreview } from './heroImage';

const changedOn = (when) => (when ? new Date(when).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');

/** One service page's hero picture: preview, replace (upload saves at once) and remove. */
export default function HeroCard({ item, busy, onUpload, onRemove }) {
    const preview = heroPreview(item.hero_image);
    return (
        <Card
            title={item.title}
            subtitle={preview && item.updated_at ? `Changed ${changedOn(item.updated_at)}` : 'Shows the default picture'}
            actions={(
                <>
                    {preview ? <Pill tone="green" dot>Custom</Pill> : <Pill dot>Default</Pill>}
                    <IconButton icon={ExternalLink} size="xs" label={`Open the ${item.title} page`} href={`/service/${item.slug}`} target="_blank" rel="noreferrer" />
                </>
            )}
        >
            <ImageDrop
                src={preview}
                alt={`${item.title} hero`}
                aspect="21 / 9"
                busy={busy}
                hint="Wide pictures work best, at least 1600 px across"
                onFile={(file) => onUpload(item, file)}
                onRemove={preview ? () => onRemove(item) : undefined}
            />
        </Card>
    );
}
