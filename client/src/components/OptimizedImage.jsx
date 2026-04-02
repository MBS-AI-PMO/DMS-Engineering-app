import { useState } from 'react';

/**
 * OptimizedImage - Drop-in replacement for <img> with:
 * - Lazy loading by default (set eager={true} for above-the-fold images)
 * - Async decoding on all images
 * - Automatic fallback to placeholder on error
 */
export default function OptimizedImage({
  src,
  alt = '',
  className,
  style,
  eager = false,
  fallback = '/placeholder.png',
  width,
  height,
  onError,
  ...rest
}) {
  const [imgSrc, setImgSrc] = useState(src);
  const [failed, setFailed] = useState(false);

  const handleError = (e) => {
    if (!failed && fallback && imgSrc !== fallback) {
      setFailed(true);
      setImgSrc(fallback);
    }
    onError?.(e);
  };

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      style={style}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      width={width}
      height={height}
      onError={handleError}
      {...rest}
    />
  );
}
