/*
 * Where FAQs show besides the FAQ page. Safe to run on every start.
 *
 *   faqs.show_on_faq_page  true (every FAQ so far): listed on the FAQ page
 *                   under its category. false: a page-only FAQ, written for
 *                   the pages it is placed on and left off the FAQ page.
 *
 *   faq_placements  one FAQ on one page of the public site. page_key is the
 *                   page's path ('/about', '/metal/6061-t6-aluminum') or a
 *                   whole type of page ('/metal/*', '/service/*'). position
 *                   orders the FAQs of one page (lowest first). Deleting the
 *                   FAQ removes its placements.
 */
async function ensureFaqPlacementSchema(db) {
    await db.query(`
        -- false: a page-only FAQ, shown only on the pages it is placed on and
        -- never on the FAQ page (nor counted in its categories).
        ALTER TABLE faqs ADD COLUMN IF NOT EXISTS show_on_faq_page BOOLEAN NOT NULL DEFAULT TRUE;

        CREATE TABLE IF NOT EXISTS faq_placements (
            id SERIAL PRIMARY KEY,
            faq_id INT NOT NULL REFERENCES faqs(id) ON DELETE CASCADE,
            page_key VARCHAR(300) NOT NULL,
            position INT NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT faq_placements_faq_page_unique UNIQUE (faq_id, page_key)
        );
        CREATE INDEX IF NOT EXISTS faq_placements_page_idx ON faq_placements (page_key, position);
    `);
}

module.exports = { ensureFaqPlacementSchema };
