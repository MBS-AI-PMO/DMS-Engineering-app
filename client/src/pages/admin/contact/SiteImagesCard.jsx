import { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { Card, ImageDrop, Skeleton } from '../../../components/admin/ui';
import { imageSrc } from './contactForm';

/* Whether an image URL loads: 'loading' | 'ok' | 'missing' ('ok' for no URL). */
function useImageStatus(src) {
    const [status, setStatus] = useState({ src: '', state: 'ok' });
    useEffect(() => {
        if (!src) return undefined;
        let alive = true;
        const probe = new window.Image();
        probe.onload = () => { if (alive) setStatus({ src, state: 'ok' }); };
        probe.onerror = () => { if (alive) setStatus({ src, state: 'missing' }); };
        probe.src = src;
        return () => { alive = false; };
    }, [src]);
    if (!src) return 'ok';
    return status.src === src ? status.state : 'loading';
}

/* One stored image. A path whose file is gone shows the upload box and says so. */
function SettingImage({ image, value, busy, onUpload, onRemove }) {
    const src = imageSrc(value);
    const status = useImageStatus(src);
    const missing = status === 'missing';
    return (
        <div className={`ac-ct-image${image.dark ? ' is-dark' : ''}${image.cover ? ' is-cover' : ''}`}>
            <p className="ac-ct-image-label">{image.label}</p>
            <ImageDrop
                src={missing ? '' : src}
                alt={image.label}
                aspect={image.aspect}
                busy={busy}
                hint={image.hint}
                onFile={onUpload}
                onRemove={onRemove}
            />
            {missing
                ? <p className="ak-error-text">The saved file ({src.split('/').pop()}) is missing on the server. Upload the image again.</p>
                : src && <p className="ak-hint">{image.hint}</p>}
        </div>
    );
}

// The images stored in site settings. dark: shown on a dark background on the site.
const IMAGES = [
    { key: 'navbar_logo', label: 'Header logo', hint: 'Top of every page, 64 px tall. PNG, SVG or WebP.', aspect: '3 / 1' },
    { key: 'footer_logo', label: 'Footer logo', hint: 'On the dark footer, 70 px tall. A light logo works best.', aspect: '3 / 1', dark: true },
    { key: 'site_logo', label: 'Site icon', hint: 'Square icon for the browser tab and shortcuts.', aspect: '2 / 1' },
    { key: 'hero_image', label: 'Home page hero image', hint: 'Large photo at the top of the home page. Saved as AVIF, WebP and JPG.', aspect: '16 / 9', cover: true },
];

/**
 * Logos and the home hero image. Each one saves as soon as it is uploaded
 * or removed (no Save needed). values: { key: stored value }.
 * onUpload(key, file), onRemove(key); busy: the key being changed.
 */
export default function SiteImagesCard({ values, onUpload, onRemove, busy, loading }) {
    return (
        <Card title="Logos and images" icon={ImageIcon} subtitle="These save as soon as you upload or remove them.">
            <div className="ac-ct-images">
                {IMAGES.map(img => (loading ? (
                    <div key={img.key} className="ac-ct-image">
                        <p className="ac-ct-image-label">{img.label}</p>
                        <Skeleton size="block" />
                    </div>
                ) : (
                    <SettingImage
                        key={img.key}
                        image={img}
                        value={values[img.key]}
                        busy={busy === img.key}
                        onUpload={file => onUpload(img.key, file)}
                        onRemove={() => onRemove(img.key, img.label)}
                    />
                )))}
            </div>
        </Card>
    );
}
