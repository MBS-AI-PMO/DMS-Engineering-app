/**
 * Makes the resized WebP copies of every uploaded picture ahead of time, so
 * the first visitor after a deploy does not wait for them. Optional: the
 * server makes any missing copy on its first request anyway.
 *
 *   node scripts/generate_image_variants.js              # usual widths
 *   node scripts/generate_image_variants.js 160 480 960  # chosen widths
 *
 * Originals are left untouched. Copies go to uploads/.variants/<width>/...
 * and are only remade when the original is newer.
 */
const fs = require('fs');
const path = require('path');
const { ensureVariant, snapWidth, RASTER } = require('../utils/imageVariants');

const UPLOADS = path.join(__dirname, '..', 'uploads');
// Customer order files are not shown on the public site.
const FOLDERS = ['metals', 'services', 'logos', 'service-heroes', 'hardware'];
// The widths the public pages ask for (see client/src/utils/imageUrl.js).
const DEFAULT_WIDTHS = [160, 320, 480, 640, 960];

const walk = (dir) => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        if (entry.name.startsWith('.')) return [];
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
    });
};

(async () => {
    const asked = process.argv.slice(2).map(snapWidth).filter(Boolean);
    const widths = [...new Set(asked.length ? asked : DEFAULT_WIDTHS)];
    const files = FOLDERS.flatMap(f => walk(path.join(UPLOADS, f))).filter(f => RASTER.test(f));
    console.log(`${files.length} pictures x widths ${widths.join(', ')}`);

    let made = 0;
    let failed = 0;
    let originalBytes = 0;
    let copyBytes = 0;
    const started = Date.now();
    for (const file of files) {
        const rel = path.relative(UPLOADS, file);
        originalBytes += fs.statSync(file).size;
        for (const width of widths) {
            try {
                const out = await ensureVariant(UPLOADS, rel, width);
                if (out?.outStat) {
                    made += 1;
                    copyBytes += Math.min(out.outStat.size, out.srcStat.size);
                }
            } catch (err) {
                failed += 1;
                console.warn(`  ${rel} @${width}: ${err.message}`);
            }
        }
    }
    const mb = (b) => (b / 1024 / 1024).toFixed(1);
    console.log(`${made} copies ready (${failed} failed) in ${((Date.now() - started) / 1000).toFixed(1)} s; ` +
        `originals ${mb(originalBytes)} MB, all copies ${mb(copyBytes)} MB`);
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
