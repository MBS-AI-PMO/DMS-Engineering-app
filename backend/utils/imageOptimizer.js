const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Optimizes an uploaded image using Sharp.
 * - Converts to WebP format for high compression.
 * - Resizes to max 1200px (width) for performance.
 * - Strips metadata.
 */
const optimizeImage = async (filePath) => {
    try {
        const ext = path.extname(filePath);
        const dirname = path.dirname(filePath);
        const basename = path.basename(filePath, ext);
        const webpPath = path.join(dirname, `${basename}.webp`);

        await sharp(filePath)
            .resize(1200, null, { // Max width 1200px, auto height
                withoutEnlargement: true,
                fit: 'inside'
            })
            .webp({ quality: 80 }) // 80 quality is visually great but ~50-70% smaller
            .toFile(webpPath);

        // Delete the original high-res upload to save space
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        return `${basename}.webp`;
    } catch (err) {
        console.error('Image optimization failed:', err);
        return path.basename(filePath); // Fallback to original filename if sharp fails
    }
};

module.exports = { optimizeImage };
