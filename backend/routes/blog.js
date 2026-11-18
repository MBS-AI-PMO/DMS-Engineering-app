/*
 * The public blog. Mounted at /api/blog; cached by utils/publicCache (a
 * minute at most, emptied when an admin saves), so a scheduled post shows
 * up within a minute of its time.
 *
 *   GET /        live posts, newest first.
 *                ?page=1&per_page=9&q=<search>&category=<name>&tag=<name>&featured=1
 *                -> { data: [post], page, per_page, total, pages,
 *                     featured: post | null, categories: [{ name, count }], tags: [{ name, count }] }
 *                featured=1 (no search or filter): the newest post comes back on its
 *                own as `featured` and the list starts after it.
 *   GET /:slug   one live post with its document, and up to 3 related posts.
 *                -> { data: post, related: [post] }; an old URL of a renamed
 *                post -> { data: null, redirect: '<current slug>' }; else 404.
 *
 * Only posts that are live (published, or scheduled and their time has
 * passed) are ever returned. Admin screens use routes/adminBlog.js.
 */
const express = require('express');
const db = require('../db');
const { route, ok, notFound, validate: v } = require('../helpers');
const { PUBLIC_WHERE, publicView, slugify } = require('../blog/service');

const router = express.Router();

const PUBLIC_COLUMNS = `p.id, p.slug, p.title, p.excerpt, p.cover_image, p.cover_alt, p.published_at, p.updated_at,
    p.author_name, p.category, p.tags, p.reading_minutes, left(p.content_text, 600) AS content_text, p.lead_text`;

const likePattern = (s) => `%${s.replace(/[\\%_]/g, '\\$&')}%`;

router.get('/', route('load the blog', async (req, res) => {
    const page = v.integer(req.query.page, 'Page', { min: 1, max: 1000 }) || 1;
    const perPage = v.integer(req.query.per_page, 'Posts per page', { min: 1, max: 24 }) || 9;
    const q = v.text(req.query.q, 'Search', { max: 100 });
    const category = v.text(req.query.category, 'Category', { max: 80 });
    const tag = v.text(req.query.tag, 'Tag', { max: 40 });
    const wantFeatured = v.bool(req.query.featured) && !q && !category && !tag;

    const featuredRow = wantFeatured
        ? (await db.query(`SELECT ${PUBLIC_COLUMNS} FROM blog_posts p WHERE ${PUBLIC_WHERE} ORDER BY p.published_at DESC, p.id DESC LIMIT 1`)).rows[0] || null
        : null;

    const params = [category, tag, q, q ? likePattern(q) : null, featuredRow ? featuredRow.id : null, perPage, (page - 1) * perPage];
    const where = `${PUBLIC_WHERE}
        AND ($1::text IS NULL OR LOWER(p.category) = LOWER($1))
        AND ($2::text IS NULL OR EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE LOWER(t) = LOWER($2)))
        AND ($3::text IS NULL OR p.search @@ websearch_to_tsquery('english', $3) OR p.title ILIKE $4
             OR p.category ILIKE $4 OR EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE t ILIKE $4))
        AND ($5::int IS NULL OR p.id <> $5)`;
    const order = q
        ? `ts_rank(p.search, websearch_to_tsquery('english', $3)) DESC, p.published_at DESC, p.id DESC`
        : 'p.published_at DESC, p.id DESC';

    const [list, categories, tags] = await Promise.all([
        db.query(`SELECT ${PUBLIC_COLUMNS}, count(*) OVER()::int AS total FROM blog_posts p WHERE ${where} ORDER BY ${order} LIMIT $6 OFFSET $7`, params),
        db.query(`SELECT MIN(p.category) AS name, count(*)::int AS count FROM blog_posts p
                  WHERE ${PUBLIC_WHERE} AND p.category IS NOT NULL AND p.category <> ''
                  GROUP BY LOWER(p.category) ORDER BY count DESC, name LIMIT 30`),
        db.query(`SELECT MIN(t) AS name, count(*)::int AS count FROM blog_posts p, unnest(p.tags) t
                  WHERE ${PUBLIC_WHERE} GROUP BY LOWER(t) ORDER BY count DESC, name LIMIT 40`),
    ]);

    // A page past the end still says how many there are.
    let total = list.rows[0]?.total;
    if (total === undefined) {
        const counted = await db.query(`SELECT count(*)::int AS total FROM blog_posts p WHERE ${where}`, params.slice(0, 5));
        total = counted.rows[0].total;
    }
    ok(res, list.rows.map(row => publicView(row)), {
        page,
        per_page: perPage,
        total,
        pages: Math.max(1, Math.ceil(total / perPage)),
        featured: featuredRow ? publicView(featuredRow) : null,
        categories: categories.rows,
        tags: tags.rows,
    });
}));

router.get('/:slug', route('load the post', async (req, res) => {
    const slug = slugify(v.text(req.params.slug, 'Post', { max: 200 }) || '', 200);
    if (!slug) throw notFound('Post');

    const found = await db.query(`SELECT p.* FROM blog_posts p WHERE p.slug = $1 AND ${PUBLIC_WHERE}`, [slug]);
    const post = found.rows[0];
    if (!post) {
        const renamed = await db.query(`SELECT p.slug FROM blog_posts p WHERE $1 = ANY(p.previous_slugs) AND ${PUBLIC_WHERE} ORDER BY p.published_at DESC LIMIT 1`, [slug]);
        if (renamed.rowCount) return ok(res, null, { redirect: renamed.rows[0].slug });
        throw notFound('Post');
    }

    // Same category or a shared tag first, then the newest of the rest.
    const related = await db.query(`
        SELECT ${PUBLIC_COLUMNS},
               (CASE WHEN $2::text IS NOT NULL AND LOWER(p.category) = LOWER($2) THEN 2 ELSE 0 END
                + (SELECT count(*) FROM unnest(p.tags) t WHERE LOWER(t) = ANY($3::text[]))) AS score
        FROM blog_posts p
        WHERE ${PUBLIC_WHERE} AND p.id <> $1
        ORDER BY score DESC, p.published_at DESC
        LIMIT 3
    `, [post.id, post.category || null, (post.tags || []).map(t => t.toLowerCase())]);

    ok(res, publicView(post, { full: true }), { related: related.rows.map(row => publicView(row)) });
}));

module.exports = router;
