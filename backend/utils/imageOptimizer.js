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
        await pipeline
            .clone()
            .resize(1200, null, { withoutEnlargement: true, fit: 'inside' })
            .webp({ quality: 80 })
            .toFile(fullPath);

        // Thumbnail — max 400px wide, 75% quality (for card/list views)
        await pipeline
            .clone()
            .resize(400, null, { withoutEnlargement: true, fit: 'inside' })
            .webp({ quality: 75 })
            .toFile(thumbPath);

        // Remove the original upload
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        return `${basename}.webp`;
    } catch (err) {
        console.error('Image optimization failed:', err);
        return path.basename(filePath); // Fallback: return original filename
    }
};

module.exports = { optimizeImage };
