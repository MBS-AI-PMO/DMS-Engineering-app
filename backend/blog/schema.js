/*
 * The blog's table. Safe to run on every start.
 *
 *   blog_posts   one article. `content` is the editor's JSON document
 *                (TipTap/ProseMirror), cleaned by blog/content.js against a
 *                fixed list of blocks and marks before it is stored; the
 *                site renders it from that JSON, never from HTML.
 *                content_text, lead_text (the opening paragraphs), word_count
 *                and reading_minutes are derived from it on every save
 *                (search, the automatic summary, "5 min read").
 *
 * Status: draft | scheduled | published. A post is public when its status is
 * scheduled or published and published_at has passed, so a scheduled post
 * goes live by itself at its time (no job needed; the public query checks
 * the clock). Times are timestamptz (the database clock is UTC).
 * previous_slugs keeps the old URLs of a post that was renamed after it went
 * live, so old links still find it. version guards against two tabs saving
 * over each other.
 */
async function ensureBlogSchema(db) {
    await db.query(`
        CREATE TABLE IF NOT EXISTS blog_posts (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL DEFAULT '',
            slug VARCHAR(120) NOT NULL,
            excerpt VARCHAR(400),
            cover_image TEXT,
            cover_alt VARCHAR(250),
            content JSONB NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
            content_text TEXT NOT NULL DEFAULT '',
            word_count INT NOT NULL DEFAULT 0,
            reading_minutes INT NOT NULL DEFAULT 1,
            status VARCHAR(12) NOT NULL DEFAULT 'draft',
            published_at TIMESTAMPTZ,
            author_id INT REFERENCES users(id) ON DELETE SET NULL,
            author_name VARCHAR(120),
            category VARCHAR(80),
            tags TEXT[] NOT NULL DEFAULT '{}',
            seo_title VARCHAR(160),
            seo_description VARCHAR(320),
            og_image TEXT,
            previous_slugs TEXT[] NOT NULL DEFAULT '{}',
            version INT NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            search TSVECTOR GENERATED ALWAYS AS (
                setweight(to_tsvector('english', coalesce(title, '')), 'A')
                || setweight(to_tsvector('english', coalesce(excerpt, '')), 'B')
                || setweight(to_tsvector('english', coalesce(content_text, '')), 'C')
            ) STORED,
            CONSTRAINT blog_posts_slug_key UNIQUE (slug),
            CONSTRAINT blog_posts_status_check CHECK (status IN ('draft', 'scheduled', 'published')),
            CONSTRAINT blog_posts_live_date_check CHECK (status = 'draft' OR published_at IS NOT NULL)
        );
        CREATE INDEX IF NOT EXISTS blog_posts_public_idx ON blog_posts (published_at DESC) WHERE status IN ('scheduled', 'published');
        CREATE INDEX IF NOT EXISTS blog_posts_updated_idx ON blog_posts (updated_at DESC);
        CREATE INDEX IF NOT EXISTS blog_posts_tags_idx ON blog_posts USING GIN (tags);
        CREATE INDEX IF NOT EXISTS blog_posts_previous_slugs_idx ON blog_posts USING GIN (previous_slugs);
        CREATE INDEX IF NOT EXISTS blog_posts_search_idx ON blog_posts USING GIN (search);
        CREATE INDEX IF NOT EXISTS blog_posts_category_idx ON blog_posts (LOWER(category));
    `);
    // The opening paragraphs as plain text (the summary when a post has none).
    await db.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS lead_text TEXT NOT NULL DEFAULT ''`);
}

module.exports = { ensureBlogSchema };
