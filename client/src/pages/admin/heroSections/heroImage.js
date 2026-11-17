/* hero_image is { avif, webp, jpg, src } (or an old plain string): the one a browser shows best. */
export const heroPreview = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.webp || value.jpg || value.src || value.avif || '';
};
