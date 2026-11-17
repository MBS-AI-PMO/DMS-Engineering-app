/*
 * Files under backend/uploads: safe paths, public URLs, deleting, and image
 * uploads (multer in memory, then sharp: upright, capped size, no metadata,
 * plus a small WebP thumbnail).
 *
 *   router.post('/x/image', imageUpload().single('image'), route('save the image', async (req, res) => {
 *       const img = await saveImage(req.file, { folder: 'metals' });   // { path, url, thumbPath, thumbUrl, width, height, size }
 *   }));
 */
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const { badRequest } = require('./http');

const BACKEND_DIR = path.join(__dirname, '..');
const UPLOADS_DIR = path.join(BACKEND_DIR, 'uploads');

/* "uploads/metals/a.webp" -> absolute path, or null if it points outside uploads/. */
function resolveUpload(relPath) {
    if (!relPath) return null;
    const clean = String(relPath).replace(/\\/g, '/').replace(/^\/+/, '').replace(/^api\//, '');
    const abs = path.resolve(BACKEND_DIR, clean);
    return abs.startsWith(UPLOADS_DIR + path.sep) ? abs : null;
}

/* Absolute path -> "uploads/…" as stored in the database. */
const toRelative = (abs) => path.relative(BACKEND_DIR, abs).split(path.sep).join('/');

/* What the browser requests: "/uploads/…". */
const publicUrl = (relPath) => (relPath ? `/${String(relPath).replace(/\\/g, '/').replace(/^\/+/, '')}` : null);

async function removeUpload(relPath) {
    const abs = resolveUpload(relPath);
    if (abs) await fs.promises.rm(abs, { force: true }).catch(() => {});
}

async function fileStat(relPath) {
    const abs = resolveUpload(relPath);
    if (!abs) return null;
    return fs.promises.stat(abs).catch(() => null);
}

/* multer for images kept in memory (saveImage writes them). */
function imageUpload({ maxMb = 20, maxFiles = 12 } = {}) {
    return multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: maxMb * 1024 * 1024, files: maxFiles },
        fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype) || /\.(heic|heif)$/i.test(file.originalname)),
    });
}

/* Runs a multer middleware and turns its errors into friendly 400s. */
const handleUpload = (middleware, { maxMb = 20, maxFiles = 12 } = {}) => (req, res, next) => {
    middleware(req, res, (err) => {
        if (!err) return next();
        const message = err.code === 'LIMIT_FILE_SIZE' ? `Each file must be under ${maxMb} MB.`
            : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? `Upload at most ${maxFiles} files at a time.`
                : 'Upload failed.';
        res.status(400).json({ success: false, error: message });
    });
};

/* Saves an uploaded image under uploads/<folder>/. format: 'webp' (site
 * images) or 'jpeg' (photos that may go out by email). */
async function saveImage(file, { folder, maxWidth = 2400, thumbWidth = 640, format = 'webp', quality = 82 } = {}) {
    if (!file?.buffer) throw badRequest('Choose an image.');
    const dir = path.join(UPLOADS_DIR, folder);
    await fs.promises.mkdir(dir, { recursive: true });
    const stem = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ext = format === 'jpeg' ? 'jpg' : 'webp';
    const fullAbs = path.join(dir, `${stem}.${ext}`);
    const thumbAbs = thumbWidth ? path.join(dir, `${stem}-thumb.webp`) : null;
    try {
        let pipeline = sharp(file.buffer, { failOn: 'none' }).rotate()
            .resize({ width: maxWidth, height: maxWidth, fit: 'inside', withoutEnlargement: true });
        pipeline = format === 'jpeg' ? pipeline.jpeg({ quality, mozjpeg: true }) : pipeline.webp({ quality });
        const info = await pipeline.toFile(fullAbs);
        if (thumbAbs) {
            await sharp(fullAbs).resize({ width: thumbWidth, height: thumbWidth, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toFile(thumbAbs);
        }
        const rel = toRelative(fullAbs);
        const thumbRel = thumbAbs ? toRelative(thumbAbs) : null;
        return { path: rel, url: publicUrl(rel), thumbPath: thumbRel, thumbUrl: publicUrl(thumbRel), width: info.width, height: info.height, size: info.size, originalName: file.originalname };
    } catch (err) {
        await fs.promises.rm(fullAbs, { force: true }).catch(() => {});
        if (thumbAbs) await fs.promises.rm(thumbAbs, { force: true }).catch(() => {});
        throw badRequest(/unsupported image format|heif/i.test(err.message)
            ? `${file.originalname || 'This image'} could not be read. Save it as JPG or PNG.`
            : `${file.originalname || 'This image'} could not be read.`);
    }
}

module.exports = { BACKEND_DIR, UPLOADS_DIR, resolveUpload, toRelative, publicUrl, removeUpload, fileStat, imageUpload, handleUpload, saveImage };
