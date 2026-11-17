const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

/**
 * Resized WebP copies of uploaded pictures, made on first request and kept
 * on disk.
 *
 *   /uploads/metals/about.png?w=640  ->  uploads/.variants/640/metals/about.png.webp
 *
 * Only raster pictures under uploads/ are handled, at a fixed set of widths
 * (other widths snap up to the next one, so the cache stays small). The
 * original file is never changed or deleted. A copy is remade when the
 * original is newer than it, and is skipped in favour of the original when
 * it would not be smaller. Anything that goes wrong falls through to the
 * plain static file, so a picture never breaks because of this.
 *
 * Uploads always get a new file name (they carry a timestamp), so a changed
 * picture has a new URL and both originals and copies can be cached by the
 * browser for a year.
 */

const WIDTHS = [160, 320, 480, 640, 960, 1280, 1600, 1920];
const RASTER = /\.(png|jpe?g|webp|avif|tiff?)$/i;
const VARIANT_DIR = '.variants';
const QUALITY = 78;
const MAX_PARALLEL = 2;

const snapWidth = (value) => {
    const w = Number.parseInt(value, 10);
    if (!Number.isFinite(w) || w <= 0) return null;
    return WIDTHS.find(x => x >= w) || WIDTHS[WIDTHS.length - 1];
};

// Keep sharp from taking every core while a page full of pictures is first made.
let running = 0;
const waiting = [];
const withSlot = async (fn) => {
    if (running >= MAX_PARALLEL) await new Promise(resolve => waiting.push(resolve)); // slot handed over
    else running += 1;
    try {
        return await fn();
    } finally {
        const next = waiting.shift();
        if (next) next();
        else running -= 1;
    }
};

const inFlight = new Map();

// The cache sits inside uploads/, which is in git; keep it out.
let ignoreFileWritten = false;
const ensureIgnoreFile = async (uploadsRoot) => {
    if (ignoreFileWritten) return;
    const file = path.join(uploadsRoot, VARIANT_DIR, '.gitignore');
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    await fs.promises.writeFile(file, '# Made by backend/utils/imageVariants.js\n*\n', { flag: 'wx' }).catch(() => { });
    ignoreFileWritten = true;
};

const statOrNull = async (file) => {
    try { return await fs.promises.stat(file); } catch { return null; }
};

/** Make (or reuse) the copy of `source` at `width`. Returns its path. */
const ensureVariant = async (uploadsRoot, relPath, width) => {
    const source = path.join(uploadsRoot, relPath);
    const target = path.join(uploadsRoot, VARIANT_DIR, String(width), `${relPath}.webp`);
    const [srcStat, outStat] = await Promise.all([statOrNull(source), statOrNull(target)]);
    if (!srcStat || !srcStat.isFile()) return null;
    if (outStat && outStat.mtimeMs >= srcStat.mtimeMs) return { source, srcStat, target, outStat };

    if (!inFlight.has(target)) {
        const job = withSlot(async () => {
            await ensureIgnoreFile(uploadsRoot);
            await fs.promises.mkdir(path.dirname(target), { recursive: true });
            const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
            try {
                await sharp(source, { failOn: 'none' })
                    .rotate()
                    .resize({ width, withoutEnlargement: true })
                    .webp({ quality: QUALITY, effort: 4 })
                    .toFile(tmp);
                await fs.promises.rename(tmp, target);
            } catch (err) {
                fs.promises.unlink(tmp).catch(() => { });
                throw err;
            }
        }).finally(() => inFlight.delete(target));
        inFlight.set(target, job);
    }
    await inFlight.get(target);
    return { source, srcStat, target, outStat: await statOrNull(target) };
};

/**
 * Express middleware for the uploads mount. Serves `?w=` requests from the
 * variant cache and passes every other request on to express.static.
 */
const imageVariants = (uploadsRoot) => {
    const root = path.resolve(uploadsRoot);
    return async (req, res, next) => {
        if ((req.method !== 'GET' && req.method !== 'HEAD') || req.query.w === undefined) return next();
        const width = snapWidth(req.query.w);
        let relPath;
        try {
            relPath = decodeURIComponent(req.path).replace(/^\/+/, '');
        } catch {
            return next();
        }
        // Raster pictures only, inside uploads/, never the cache itself or dotfiles.
        if (!width || !RASTER.test(relPath) || relPath.split(/[\\/]/).some(part => part.startsWith('.') || part === '')) return next();
        const resolved = path.resolve(root, relPath);
        if (!resolved.startsWith(root + path.sep)) return next();

        try {
            const found = await ensureVariant(root, path.relative(root, resolved), width);
            if (!found || !found.outStat) return next();
            // A copy that came out larger than the original is no use; send the original.
            const file = found.outStat.size < found.srcStat.size ? found.target : found.source;
            res.sendFile(file, { maxAge: '1y', immutable: true, dotfiles: 'allow' }, (err) => {
                if (err && !res.headersSent) next();
            });
        } catch (err) {
            console.warn(`[images] could not make ${width}px copy of ${relPath}: ${err.message}`);
            next();
        }
    };
};

module.exports = { imageVariants, ensureVariant, snapWidth, WIDTHS, RASTER, VARIANT_DIR };
