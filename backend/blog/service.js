/*
 * Blog posts: reading request fields, slugs, what the admin and the public
 * site get back, and the files a post uses. Routes: routes/blog.js (public)
 * and routes/adminBlog.js (admin).
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { badRequest, validate: v, removeUpload, UPLOADS_DIR } = require('../helpers');
const { cleanDoc, autoExcerpt, safeImageSrc } = require('./content');
const { VARIANT_DIR, WIDTHS } = require('../utils/imageVariants');

const STATUSES = ['draft', 'scheduled', 'published'];

/* Live now: published, or scheduled with its time passed. */
const PUBLIC_WHERE = `p.status IN ('scheduled', 'published') AND p.published_at <= NOW()`;

/* What the admin sees: a scheduled post whose time has come is published. */
const STATE_SQL = `CASE WHEN p.status = 'draft' THEN 'draft'
                        WHEN p.published_at <= NOW() THEN 'published'
                        ELSE 'scheduled' END`;

/* "How to prepare a STEP file" -> "how-to-prepare-a-step-file". */
function slugify(value, max = 100) {
    const s = String(value || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/&/g, ' and ')
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    if (s.length <= max) return s;
    const cut = s.slice(0, max);
    const at = cut.lastIndexOf('-');
    return (at > max * 0.5 ? cut.slice(0, at) : cut).replace(/-+$/g, '');
}

/* base, or base-2, base-3… whichever no other post uses. */
async function uniqueSlug(base, excludeId = null, client = db) {
    const root = slugify(base) || 'untitled';
    const res = await client.query(
        `SELECT slug FROM blog_posts WHERE (slug = $1 OR slug ~ ('^' || $2 || '-[0-9]+$')) AND ($3::int IS NULL OR id <> $3)`,
        [root, root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), excludeId],
    );
    const taken = new Set(res.rows.map(r => r.slug));
    if (!taken.has(root)) return root;
    for (let n = 2; n < 10000; n += 1) {
        const candidate = `${root.slice(0, 110)}-${n}`;
        if (!taken.has(candidate)) return candidate;
    }
    return `${root.slice(0, 100)}-${Date.now()}`;
}

/* Tags: a list of short words, no duplicates (ignoring case). */
function cleanTags(value) {
    const raw = typeof value === 'string' && !value.trim().startsWith('[') ? value.split(',') : v.list(value, 'Tags', { max: 50 });
    const seen = new Set();
    const out = [];
    for (const item of raw) {
        const tag = v.text(typeof item === 'string' ? item.replace(/\s+/g, ' ') : item, 'Each tag', { max: 40 });
        if (!tag) continue;
        const key = tag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(tag);
    }
    if (out.length > 12) throw badRequest('Use at most 12 tags.');
    return out;
}

function imageField(value, label) {
    if (v.blank(value)) return null;
    const src = safeImageSrc(String(value));
    if (!src) throw badRequest(`${label} must be an uploaded picture or an https:// address.`);
    return src;
}

/*
 * The post fields present in a request body, cleaned. Only the keys that
 * were sent come back, so a request can change one field. content also
 * brings its derived columns (content_text, word_count, reading_minutes).
 */
function readFields(body = {}) {
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
    const out = {};
    if (has('title')) out.title = v.text(body.title, 'Title', { max: 200 }) || '';
    if (has('slug')) out.slug = v.blank(body.slug) ? null : slugify(v.text(body.slug, 'URL', { max: 200 }));
    if (has('excerpt')) out.excerpt = v.text(body.excerpt, 'Excerpt', { max: 400 });
    if (has('cover_image')) out.cover_image = imageField(body.cover_image, 'Cover image');
    if (has('cover_alt')) out.cover_alt = v.text(body.cover_alt, 'Cover image description', { max: 250 });
    if (has('category')) out.category = v.text(body.category, 'Category', { max: 80 });
    if (has('tags')) out.tags = cleanTags(body.tags);
    if (has('author_name')) out.author_name = v.text(body.author_name, 'Author', { max: 120 });
    if (has('seo_title')) out.seo_title = v.text(body.seo_title, 'SEO title', { max: 160 });
    if (has('seo_description')) out.seo_description = v.text(body.seo_description, 'SEO description', { max: 320 });
    if (has('og_image')) out.og_image = imageField(body.og_image, 'Share image');
    if (has('content')) {
        const clean = cleanDoc(body.content);
        out.content = clean.doc;
        out.content_text = clean.text;
        out.lead_text = clean.lead;
        out.word_count = clean.words;
        out.reading_minutes = clean.readingMinutes;
        out.__dropped = clean.dropped;
    }
    return out;
}

/* Why a post can't go live yet, or null. */
function publishProblem(row) {
    if (!String(row.title || '').trim()) return 'Add a title before publishing.';
    if (String(row.title).trim().length < 3) return 'The title is too short to publish.';
    const clean = cleanDoc(row.content);
    if (clean.isEmpty) return 'Write something in the post before publishing.';
    return null;
}

const iso = (d) => (d ? new Date(d).toISOString() : null);

/* One post for the admin screens. withContent: the editor document too. */
function adminView(row, { withContent = false } = {}) {
    const view = {
        id: row.id,
        title: row.title,
        slug: row.slug,
        url: `/blog/${row.slug}`,
        excerpt: row.excerpt,
        auto_excerpt: autoExcerpt(row.lead_text || row.content_text),
        cover_image: row.cover_image,
        cover_alt: row.cover_alt,
        status: row.status,
        state: row.state || (row.status === 'draft' ? 'draft' : new Date(row.published_at) <= new Date() ? 'published' : 'scheduled'),
        published_at: iso(row.published_at),
        author_id: row.author_id,
        author_name: row.author_name,
        category: row.category,
        tags: row.tags || [],
        seo_title: row.seo_title,
        seo_description: row.seo_description,
        og_image: row.og_image,
        word_count: row.word_count,
        reading_minutes: row.reading_minutes,
        previous_slugs: row.previous_slugs || [],
        version: row.version,
        created_at: iso(row.created_at),
        updated_at: iso(row.updated_at),
    };
    if (withContent) view.content = row.content;
    return view;
}

/* One post for the public site. full: with the document (the post page). */
function publicView(row, { full = false } = {}) {
    const view = {
        slug: row.slug,
        title: row.title,
        excerpt: row.excerpt || autoExcerpt(row.lead_text || row.content_text),
        cover_image: row.cover_image,
        cover_alt: row.cover_alt,
        published_at: iso(row.published_at),
        updated_at: iso(row.updated_at),
        author_name: row.author_name,
        category: row.category,
        tags: row.tags || [],
        reading_minutes: row.reading_minutes,
    };
    if (full) {
        Object.assign(view, {
            word_count: row.word_count,
            seo_title: row.seo_title,
            seo_description: row.seo_description,
            og_image: row.og_image,
            content: row.content,
        });
    }
    return view;
}

/* The columns a list needs (not the document). */
const LIST_COLUMNS = `p.id, p.title, p.slug, p.excerpt, p.cover_image, p.cover_alt, p.status, p.published_at,
    p.author_id, p.author_name, p.category, p.tags, p.seo_title, p.seo_description, p.og_image,
    p.word_count, p.reading_minutes, p.previous_slugs, p.version, p.created_at, p.updated_at,
    left(p.content_text, 600) AS content_text, p.lead_text, ${STATE_SQL} AS state`;

async function findPost(id, client = db) {
    // was_live: on the site now or at some point (by the database clock).
    const res = await client.query(`SELECT p.*, ${STATE_SQL} AS state, (p.published_at IS NOT NULL AND p.published_at <= NOW()) AS was_live
                                    FROM blog_posts p WHERE p.id = $1`, [id]);
    return res.rows[0] || null;
}

/* Pictures under uploads/blog that a post uses (cover, share image, in the text). */
function blogUploadsOf(row) {
    const doc = cleanDoc(row.content);
    return [row.cover_image, row.og_image, ...doc.images]
        .filter(src => typeof src === 'string' && /^\/(?:api\/)?uploads\/blog\//.test(src))
        .map(src => src.replace(/^\/(?:api\/)?/, ''));
}

/* Deletes an uploads/blog picture and its resized copies, unless another post still uses it. */
async function removeBlogImageIfUnused(relPath) {
    const url = `/${relPath}`;
    const like = `%${url.replace(/[\\%_]/g, '\\$&')}%`;
    const used = await db.query(
        `SELECT 1 FROM blog_posts WHERE cover_image IN ($1, $2) OR og_image IN ($1, $2) OR content::text LIKE $3 LIMIT 1`,
        [url, `/api${url}`, like],
    );
    if (used.rowCount) return false;
    await removeUpload(relPath);
    const inside = relPath.replace(/^uploads\//, '');
    await Promise.all(WIDTHS.map(w => fs.promises.rm(path.join(UPLOADS_DIR, VARIANT_DIR, String(w), `${inside}.webp`), { force: true }).catch(() => {})));
    return true;
}

module.exports = {
    STATUSES, PUBLIC_WHERE, STATE_SQL, LIST_COLUMNS,
    slugify, uniqueSlug, cleanTags, readFields, publishProblem, adminView, publicView, findPost,
    blogUploadsOf, removeBlogImageIfUnused,
};
