/*
 * Admin > Blog. Mounted at /api/admin/blog (admins only). Every write here
 * empties the public cache (utils/publicCache), so the site shows it on the
 * next page load.
 *
 *   GET    /                  every post (no documents), newest change first,
 *                             with counts { all, draft, scheduled, published }
 *   GET    /topics            categories, tags and authors already used (suggestions)
 *   GET    /slug-check        ?slug=&id= -> { slug, available, suggestion }
 *   GET    /:id               one post with its editor document
 *   POST   /                  new draft (any fields) -> the post
 *   PUT    /:id               save fields (only those sent); autosave uses it.
 *                             Send `version` (from the last load/save): if the post
 *                             changed since, 409 instead of overwriting it.
 *   POST   /:id/publish       (fields…) save, then live now
 *   POST   /:id/schedule      { published_at, fields… } save, then live at that time
 *   POST   /:id/unpublish     back to draft (off the site)
 *   POST   /:id/duplicate     a draft copy -> the new post
 *   DELETE /:id               the post, and its pictures no other post uses
 *   POST   /images            multipart `image` -> { url, path, width, height }
 *                             (covers and pictures in posts; uploads/blog/, WebP)
 *
 * Post fields: title, slug, excerpt, cover_image, cover_alt, content (editor
 * JSON, checked by blog/content.js), category, tags, author_name, seo_title,
 * seo_description, og_image. Status: draft | scheduled | published; `state`
 * in answers is what the site shows now (a scheduled post past its time is
 * published).
 */
const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
    route, ok, created, badRequest, conflict, notFound, validate: v, imageUpload, handleUpload, saveImage,
} = require('../helpers');
const {
    STATE_SQL, LIST_COLUMNS, slugify, uniqueSlug, readFields, publishProblem, adminView, findPost,
    blogUploadsOf, removeBlogImageIfUnused,
} = require('../blog/service');
const { EMPTY_DOC } = require('../blog/content');

const router = express.Router();
router.use(authenticate, requireAdmin);

const COLUMNS = ['title', 'slug', 'excerpt', 'cover_image', 'cover_alt', 'content', 'content_text', 'lead_text', 'word_count', 'reading_minutes',
    'category', 'tags', 'author_name', 'seo_title', 'seo_description', 'og_image'];

const MAX_UPLOAD_MB = 15;
const upload = handleUpload(imageUpload({ maxMb: MAX_UPLOAD_MB, maxFiles: 1 }).single('image'), { maxMb: MAX_UPLOAD_MB, maxFiles: 1 });

const isSlugClash = (err) => err && err.code === '23505' && /slug/.test(err.constraint || '');

async function adminName(req) {
    const res = await db.query('SELECT name, email FROM users WHERE id = $1', [req.user?.id]);
    const row = res.rows[0];
    return (row?.name || '').trim() || (row?.email || req.user?.email || '').split('@')[0] || null;
}

async function requirePost(id) {
    const row = await findPost(id);
    if (!row) throw notFound('Post');
    return row;
}

/*
 * Saves the fields in `body` and, optionally, a status change, in one
 * UPDATE guarded by the version the admin last saw.
 *   change: { status, publishedAt: Date | 'now-or-kept' }
 */
async function savePost(id, body, change = null) {
    const current = await requirePost(id);
    if (body.version !== undefined && body.version !== null && Number(body.version) !== current.version) {
        throw conflict('This post was changed somewhere else (another tab or another admin). Reload it to get the latest version.', {
            code: 'version_conflict', current_version: current.version, updated_at: current.updated_at,
        });
    }

    const fields = readFields(body);
    const dropped = fields.__dropped || 0;
    delete fields.__dropped;

    // The URL: the one asked for (or from the title when cleared), made unique.
    if ('slug' in fields) {
        const wanted = fields.slug || slugify(fields.title ?? current.title) || 'untitled';
        fields.slug = await uniqueSlug(wanted, id);
    }
    const sets = [];
    const params = [id, current.version];
    const set = (column, value, cast = '') => { params.push(value); sets.push(`${column} = $${params.length}${cast}`); };
    for (const column of COLUMNS) {
        if (!(column in fields)) continue;
        if (column === 'content') set(column, JSON.stringify(fields.content), '::jsonb');
        else if (column === 'tags') set(column, fields.tags, '::text[]');
        else set(column, fields[column]);
    }
    // A post that has been on the site keeps its old URL so links to it still work.
    if (fields.slug && fields.slug !== current.slug && current.was_live) {
        const previous = [...new Set([current.slug, ...(current.previous_slugs || [])])].filter(s => s !== fields.slug).slice(0, 20);
        set('previous_slugs', previous, '::text[]');
    }

    let status = current.status;
    if (change) {
        status = change.status;
        set('status', status);
        if (change.publishedAt === 'now-or-kept') {
            sets.push('published_at = CASE WHEN published_at IS NOT NULL AND published_at <= NOW() THEN published_at ELSE NOW() END');
        } else if (change.publishedAt instanceof Date) {
            set('published_at', change.publishedAt.toISOString(), '::timestamptz');
        }
    }
    if (status !== 'draft') {
        const problem = publishProblem({ ...current, ...fields });
        if (problem) throw badRequest(change ? problem : `${problem.replace(' before publishing', '')} This post is ${current.state === 'scheduled' ? 'scheduled' : 'on the site'}; unpublish it first to save it without one.`);
    }

    let result;
    try {
        result = await db.query(`
            UPDATE blog_posts p SET ${[...sets, 'version = version + 1', 'updated_at = NOW()'].join(', ')}
            WHERE p.id = $1 AND p.version = $2
            RETURNING p.*, ${STATE_SQL} AS state
        `, params);
    } catch (err) {
        if (isSlugClash(err)) throw conflict('Another post just took this URL. Save again to get a free one.');
        throw err;
    }
    if (!result.rowCount) {
        throw conflict('This post was changed somewhere else (another tab or another admin). Reload it to get the latest version.', { code: 'version_conflict' });
    }
    // A replaced cover or share picture is no longer needed (unless another post uses it).
    // Pictures inside the text are kept: the editor's undo can bring them back.
    for (const column of ['cover_image', 'og_image']) {
        const old = current[column];
        if (column in fields && old && old !== fields[column] && /^\/(?:api\/)?uploads\/blog\//.test(old)) {
            removeBlogImageIfUnused(old.replace(/^\/(?:api\/)?/, '')).catch(() => {});
        }
    }
    return { row: result.rows[0], dropped };
}

const answer = (res, { row, dropped }, withContent = false) => ok(res, adminView(row, { withContent }), dropped ? { dropped } : {});

// ── Lists ──────────────────────────────────────────────────────────────

router.get('/', route('load the posts', async (req, res) => {
    const result = await db.query(`SELECT ${LIST_COLUMNS} FROM blog_posts p ORDER BY p.updated_at DESC, p.id DESC`);
    const posts = result.rows.map(row => adminView(row));
    const counts = { all: posts.length, draft: 0, scheduled: 0, published: 0 };
    posts.forEach(p => { counts[p.state] += 1; });
    ok(res, posts, { counts });
}));

router.get('/topics', route('load the categories and tags', async (req, res) => {
    const [categories, tags, authors] = await Promise.all([
        db.query(`SELECT MIN(category) AS name, count(*)::int AS count FROM blog_posts WHERE category IS NOT NULL AND category <> '' GROUP BY LOWER(category) ORDER BY count DESC, name LIMIT 100`),
        db.query(`SELECT MIN(t) AS name, count(*)::int AS count FROM blog_posts, unnest(tags) t GROUP BY LOWER(t) ORDER BY count DESC, name LIMIT 200`),
        db.query(`SELECT name FROM (SELECT DISTINCT ON (LOWER(author_name)) author_name AS name, updated_at FROM blog_posts WHERE author_name IS NOT NULL AND author_name <> '' ORDER BY LOWER(author_name), updated_at DESC) a ORDER BY updated_at DESC LIMIT 20`),
    ]);
    ok(res, { categories: categories.rows, tags: tags.rows, authors: authors.rows.map(r => r.name), me: await adminName(req) });
}));

router.get('/slug-check', route('check the URL', async (req, res) => {
    const slug = slugify(v.text(req.query.slug, 'URL', { max: 200 }) || '');
    const id = v.blank(req.query.id) ? null : v.id(req.query.id, 'Post');
    if (!slug) return ok(res, { slug: '', available: false, suggestion: null });
    const suggestion = await uniqueSlug(slug, id);
    ok(res, { slug, available: suggestion === slug, suggestion });
}));

// ── Pictures ──────────────────────────────────────────────────────────

router.post('/images', upload, route('upload the picture', async (req, res) => {
    const img = await saveImage(req.file, { folder: 'blog', maxWidth: 2400, thumbWidth: 0, quality: 84 });
    created(res, { url: img.url, path: img.path, width: img.width, height: img.height, size: img.size });
}));

// ── One post ───────────────────────────────────────────────────────────

router.get('/:id', route('load the post', async (req, res) => {
    const row = await requirePost(v.id(req.params.id, 'Post'));
    ok(res, adminView(row, { withContent: true }));
}));

router.post('/', route('create the post', async (req, res) => {
    const body = req.body || {};
    const fields = readFields(body);
    delete fields.__dropped;
    if (!('content' in fields)) Object.assign(fields, readFields({ content: EMPTY_DOC }));
    delete fields.__dropped;
    fields.slug = await uniqueSlug(fields.slug || slugify(fields.title) || 'untitled');
    if (!fields.author_name) fields.author_name = await adminName(req); // the admin writing it
    if (!('title' in fields)) fields.title = '';

    const columns = Object.keys(fields).filter(c => COLUMNS.includes(c));
    const params = columns.map(c => (c === 'content' ? JSON.stringify(fields.content) : fields[c]));
    const casts = columns.map(c => (c === 'content' ? '::jsonb' : c === 'tags' ? '::text[]' : ''));
    params.push(req.user?.id || null);
    let result;
    try {
        result = await db.query(`
            INSERT INTO blog_posts (${columns.join(', ')}, author_id, status)
            VALUES (${columns.map((c, i) => `$${i + 1}${casts[i]}`).join(', ')}, $${params.length}, 'draft')
            RETURNING *, 'draft' AS state
        `, params);
    } catch (err) {
        if (isSlugClash(err)) throw conflict('Another post just took this URL. Try again.');
        throw err;
    }
    created(res, adminView(result.rows[0], { withContent: true }));
}));

router.put('/:id', route('save the post', async (req, res) => {
    answer(res, await savePost(v.id(req.params.id, 'Post'), req.body || {}));
}));

router.post('/:id/publish', route('publish the post', async (req, res) => {
    answer(res, await savePost(v.id(req.params.id, 'Post'), req.body || {}, { status: 'published', publishedAt: 'now-or-kept' }));
}));

router.post('/:id/schedule', route('schedule the post', async (req, res) => {
    const body = req.body || {};
    const when = new Date(v.text(body.published_at, 'Publish time', { required: true, max: 40 }));
    if (Number.isNaN(when.getTime())) throw badRequest('Pick a date and time to publish.');
    // By the database clock, which decides when the post goes live.
    const now = (await db.query('SELECT NOW() AS now')).rows[0].now.getTime();
    if (when.getTime() < now + 60 * 1000) throw badRequest('Pick a time in the future (at least a minute from now), or publish now.');
    if (when.getTime() > now + 2 * 365 * 24 * 3600 * 1000) throw badRequest('Pick a time within the next two years.');
    const { published_at: _ignored, ...fields } = body;
    answer(res, await savePost(v.id(req.params.id, 'Post'), fields, { status: 'scheduled', publishedAt: when }));
}));

router.post('/:id/unpublish', route('unpublish the post', async (req, res) => {
    answer(res, await savePost(v.id(req.params.id, 'Post'), req.body || {}, { status: 'draft' }));
}));

router.post('/:id/duplicate', route('duplicate the post', async (req, res) => {
    const source = await requirePost(v.id(req.params.id, 'Post'));
    const title = `${source.title || 'Untitled'} (copy)`.slice(0, 200);
    const slug = await uniqueSlug(`${source.slug}-copy`);
    const result = await db.query(`
        INSERT INTO blog_posts (title, slug, excerpt, cover_image, cover_alt, content, content_text, lead_text, word_count, reading_minutes,
                                author_id, author_name, category, tags, seo_title, seo_description, og_image, status)
        SELECT $2, $3, excerpt, cover_image, cover_alt, content, content_text, lead_text, word_count, reading_minutes,
               $4, author_name, category, tags, seo_title, seo_description, og_image, 'draft'
        FROM blog_posts WHERE id = $1
        RETURNING *, 'draft' AS state
    `, [source.id, title, slug, req.user?.id || null]);
    created(res, adminView(result.rows[0], { withContent: true }));
}));

router.delete('/:id', route('delete the post', async (req, res) => {
    const row = await requirePost(v.id(req.params.id, 'Post'));
    await db.query('DELETE FROM blog_posts WHERE id = $1', [row.id]);
    // Its pictures go too, unless another post (a copy) still shows them.
    const files = [...new Set(blogUploadsOf(row))];
    let removed = 0;
    for (const file of files) {
        if (await removeBlogImageIfUnused(file).catch(() => false)) removed += 1;
    }
    ok(res, { id: row.id, removed_images: removed });
}));

module.exports = router;
