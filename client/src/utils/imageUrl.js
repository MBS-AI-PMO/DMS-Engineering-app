/**
 * Sized copies of uploaded pictures. The backend serves
 * `/uploads/...picture.png?w=480` as a WebP no wider than 480 px, made once
 * and cached (backend/utils/imageVariants.js). Uploaded originals can be
 * several megabytes; a tile on a page needs a few kilobytes.
 *
 * Only pictures under /uploads (or /api/uploads) are rewritten; bundled
 * assets, data: and blob: URLs and SVGs are returned unchanged.
 */

// Must match WIDTHS in backend/utils/imageVariants.js.
export const IMAGE_WIDTHS = [160, 320, 480, 640, 960, 1280, 1600, 1920];

const VARIANTABLE = /\/(?:api\/)?uploads\/[^?#]+\.(?:png|jpe?g|webp|avif|tiff?)(?:$|[?#])/i;

export const isVariantable = (src) => typeof src === 'string' && VARIANTABLE.test(src) && !/[?&]w=/.test(src);

export const snapImageWidth = (px) => IMAGE_WIDTHS.find(w => w >= px) || IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1];

/** URL of the copy at least `px` wide (or the source itself when it is not an upload). */
export const imageVariant = (src, px) => {
    if (!isVariantable(src) || !px) return src;
    const [base, hash = ''] = src.split('#');
    return `${base}${base.includes('?') ? '&' : '?'}w=${snapImageWidth(px)}${hash ? `#${hash}` : ''}`;
};

/**
 * `srcSet` for a picture shown at most `maxPx` CSS pixels wide, with copies
 * up to twice that for sharp screens. Undefined when the source has no copies.
 */
export const imageSrcSet = (src, maxPx) => {
    if (!isVariantable(src) || !maxPx) return undefined;
    const top = snapImageWidth(maxPx * 2);
    return IMAGE_WIDTHS.filter(w => w <= top).map(w => `${imageVariant(src, w)} ${w}w`).join(', ');
};
