import React, { useCallback, useState } from 'react';
import { imageSrcSet, imageVariant } from '../utils/imageUrl';
import '../styles/Shimmer.css';

/**
 * A small decorative picture on a tile. The tile shimmers until the
 * picture has loaded, then the picture fades in. If it fails, the
 * fallback picture is tried, then the bare tile is left, so a missing
 * file never shows as a broken image. Give it a `key` of the source so a
 * new source starts fresh.
 *
 * `width` is the widest the tile is shown, in CSS pixels. With it, an
 * uploaded picture is fetched as a resized copy of about that size (up to
 * twice for sharp screens) instead of the full upload. `sizes` overrides
 * the browser hint when the tile width changes with the window.
 */
const ThumbImage = ({ src, fallback, className = '', width, sizes }) => {
    const [current, setCurrent] = useState(src || fallback || '');
    const [loaded, setLoaded] = useState(false);

    const handleError = () => {
        setLoaded(false);
        setCurrent(prev => (fallback && prev !== fallback ? fallback : ''));
    };

    // A picture already in the browser cache can finish loading before
    // React attaches onLoad; catch that when the element mounts.
    const imgRef = useCallback((img) => {
        if (img && img.complete && img.naturalWidth > 0) setLoaded(true);
    }, []);

    const state = !current ? 'is-empty' : loaded ? 'is-loaded' : 'is-loading';
    const srcSet = width ? imageSrcSet(current, width) : undefined;

    return (
        <span className={`ti ${state} ${className}`.trim()} aria-hidden="true">
            {current && (
                <img
                    key={current}
                    ref={imgRef}
                    className="ti-img"
                    src={width ? imageVariant(current, width) : current}
                    srcSet={srcSet}
                    sizes={srcSet ? (sizes || `${width}px`) : undefined}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onLoad={() => setLoaded(true)}
                    onError={handleError}
                />
            )}
        </span>
    );
};

export default ThumbImage;
