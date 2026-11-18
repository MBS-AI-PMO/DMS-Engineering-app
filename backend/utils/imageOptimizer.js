const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Optimizes an uploaded image using Sharp.
 * - Converts to WebP for ~50-70% smaller file size vs JPEG/PNG.
 * - Produces a full-size version (max 1200px wide) for detail views.
 * - Produces a thumbnail version (max 400px wide) for catalog/card views.
 * - Strips all metadata (EXIF, GPS, etc.).
 * - Deletes the original upload after conversion.
 *
 * Returns the base filename (without extension) so callers can construct
 * both paths: `/uploads/.../name.webp` and `/uploads/.../name_thumb.webp`
 */
const optimizeImage = async (filePath) => {
    try {
        const ext = path.extname(filePath);
        const dirname = path.dirname(filePath);
        const basename = path.basename(filePath, ext);

        const fullPath = path.join(dirname, `${basename}.webp`);
        const thumbPath = path.join(dirname, `${basename}_thumb.webp`);

        const pipeline = sharp(filePath).rotate(); // auto-rotate from EXIF

        // Full-size version — max 1200px wide, 80% quality
        // Use a temporary path if target is same as original
        const tempFullPath = path.join(dirname, `temp_${basename}.webp`);
        await pipeline
            .clone()
            .resize(1200, null, { withoutEnlargement: true, fit: 'inside' })
            .webp({ quality: 80 })
            .toFile(tempFullPath);

        // Thumbnail — max 400px wide, 75% quality (for card/list views)
        await pipeline
            .clone()
            .resize(400, null, { withoutEnlargement: true, fit: 'inside' })
            .webp({ quality: 75 })
            .toFile(thumbPath);

        // Move full-size temp to final destination
        if (fs.existsSync(fullPath) && fullPath === filePath) {
            // If we are overwriting the original, we already have it in temp
            fs.renameSync(tempFullPath, fullPath);
        } else {
            // Otherwise move/ensure final name
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
            fs.renameSync(tempFullPath, fullPath);
        }

        // Remove the original upload ONLY if it's different from the optimized one
        if (fs.existsSync(filePath) && filePath !== fullPath) {
            fs.unlinkSync(filePath);
        }

        return `${basename}.webp`;
    } catch (err) {
        console.error('Image optimization failed:', err);
        return path.basename(filePath); // Fallback: return original filename
    }
};

/**
 * Hero optimizer for homepage banners.
 * Produces AVIF/WebP/JPEG variants from one upload, strips metadata,
 * and keeps large visual quality while reducing transfer size.
 */
const optimizeHeroImage = async (filePath) => {
    try {
        const ext = path.extname(filePath);
        const dirname = path.dirname(filePath);
        const basename = path.basename(filePath, ext);

        const avifPath = path.join(dirname, `${basename}.avif`);
        const webpPath = path.join(dirname, `${basename}.webp`);
        const jpgPath = path.join(dirname, `${basename}.jpg`);

        const pipeline = sharp(filePath).rotate();

        await pipeline
            .clone()
            .resize(2200, null, { withoutEnlargement: true, fit: 'inside' })
            .avif({ quality: 50, effort: 9, chromaSubsampling: '4:2:0' })
            .toFile(avifPath);

        await pipeline
            .clone()
            .resize(2200, null, { withoutEnlargement: true, fit: 'inside' })
            .webp({ quality: 78, effort: 6, smartSubsample: true })
            .toFile(webpPath);

        await pipeline
            .clone()
            .resize(2200, null, { withoutEnlargement: true, fit: 'inside' })
            .jpeg({ quality: 82, mozjpeg: true, progressive: true, chromaSubsampling: '4:2:0' })
            .toFile(jpgPath);

        if (fs.existsSync(filePath) && filePath !== avifPath && filePath !== webpPath && filePath !== jpgPath) {
            fs.unlinkSync(filePath);
        }

        return {
            avif: `${basename}.avif`,
            webp: `${basename}.webp`,
            jpg: `${basename}.jpg`,
        };
    } catch (err) {
        console.error('Hero image optimization failed:', err);
        return {
            src: path.basename(filePath),
        };
    }
};

/* A link-preview (Open Graph) image: the upload fitted whole onto a 1200x630
 * card (the 1.91:1 shape Facebook, LinkedIn and WhatsApp show) with even
 * margins, so no app crops it. JPEG, because not every preview service
 * reads WebP. Returns the new file name (same folder); removes the upload. */
const SHARE_W = 1200;
const SHARE_H = 630;
const makeShareCard = async (filePath, { background = '#ffffff', margin = 0.08 } = {}) => {
    const dirname = path.dirname(filePath);
    const basename = path.basename(filePath, path.extname(filePath));
    const outName = `${basename}_share.jpg`;
    const innerW = Math.round(SHARE_W * (1 - margin * 2));
    const innerH = Math.round(SHARE_H * (1 - margin * 2));
    const fitted = await sharp(filePath).rotate()
        .resize(innerW, innerH, { fit: 'inside', withoutEnlargement: false })
        .flatten({ background })
        .toBuffer({ resolveWithObject: true });
    await sharp({ create: { width: SHARE_W, height: SHARE_H, channels: 3, background } })
        .composite([{ input: fitted.data, left: Math.round((SHARE_W - fitted.info.width) / 2), top: Math.round((SHARE_H - fitted.info.height) / 2) }])
        .jpeg({ quality: 86, mozjpeg: true })
        .toFile(path.join(dirname, outName));
    try { fs.unlinkSync(filePath); } catch { /* the upload may already be gone */ }
    return outName;
};

module.exports = { optimizeImage, optimizeHeroImage, makeShareCard };
