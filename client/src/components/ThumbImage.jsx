import React, { useCallback, useState } from 'react';
import '../styles/Shimmer.css';

/**
 * A small decorative picture on a tile. The tile shimmers until the
 * picture has loaded, then the picture fades in. If it fails, the
 * fallback picture is tried, then the bare tile is left, so a missing
 * file never shows as a broken image. Give it a `key` of the source so a
 * new source starts fresh.
 */
const ThumbImage = ({ src, fallback, className = '' }) => {
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

    return (
        <span className={`ti ${state} ${className}`.trim()} aria-hidden="true">
            {current && (
                <img
                    key={current}
                    ref={imgRef}
                    className="ti-img"
                    src={current}
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
