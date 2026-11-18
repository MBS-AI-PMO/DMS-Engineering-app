/*
 * Reading and writing faq_placements (see faqs/schema.js). Functions take
 * the db or a transaction client as their first argument.
 *
 *   allPlaced(db)                { page_key: [faq, …] } for every page with placed FAQs,
 *                                each list in position order (the public site loads it once)
 *   forPath(db, path)            FAQs a visitor sees on a path: that exact page
 *                                first, then its "every page of this type" key
 *                                ('/metal/*'), each in position order, no repeats
 *   pagesByFaq(db)               Map faq_id -> its page keys
 *   pageCounts(db)               Map page_key -> number of FAQs
 *   onPage(db, key)              the FAQs placed on one key, in order
 *   setFaqPages(db, id, keys)    the pages of one FAQ (new pages put it last)
 *   setPageFaqs(db, key, ids)    the FAQs of one page, in this order
 */
const { badRequest } = require('../helpers');
const { keysForPath } = require('./pages');

const FAQ_COLUMNS = `f.id, f.question, f.answer, f.category_id, fc.name AS category_name, fc.slug AS category_slug`;

async function allPlaced(db) {
    const result = await db.query(`
        SELECT ${FAQ_COLUMNS}, p.page_key, p.position
        FROM faq_placements p
        JOIN faqs f ON f.id = p.faq_id
        LEFT JOIN faq_categories fc ON fc.id = f.category_id
        ORDER BY p.page_key, p.position, p.id
    `);
    const pages = {};
    result.rows.forEach(row => { (pages[row.page_key] ||= []).push(row); });
    return pages;
}

async function forPath(db, path) {
    const keys = keysForPath(path);
    const result = await db.query(`
        SELECT ${FAQ_COLUMNS}, p.page_key, p.position
        FROM faq_placements p
        JOIN faqs f ON f.id = p.faq_id
        LEFT JOIN faq_categories fc ON fc.id = f.category_id
        WHERE p.page_key = ANY($1::text[])
        ORDER BY array_position($1::text[], p.page_key::text), p.position, p.id
    `, [keys]);
    const seen = new Set();
    return result.rows.filter(row => (seen.has(row.id) ? false : seen.add(row.id)));
}

async function pagesByFaq(db) {
    const result = await db.query('SELECT faq_id, page_key FROM faq_placements ORDER BY page_key, faq_id');
    const map = new Map();
    result.rows.forEach(r => {
        if (!map.has(r.faq_id)) map.set(r.faq_id, []);
        map.get(r.faq_id).push(r.page_key);
    });
    return map;
}

async function pageCounts(db) {
    const result = await db.query('SELECT page_key, COUNT(*)::int AS n FROM faq_placements GROUP BY page_key');
    return new Map(result.rows.map(r => [r.page_key, r.n]));
}

async function onPage(db, key) {
    const result = await db.query(`
        SELECT ${FAQ_COLUMNS}, p.position
        FROM faq_placements p
        JOIN faqs f ON f.id = p.faq_id
        LEFT JOIN faq_categories fc ON fc.id = f.category_id
        WHERE p.page_key = $1
        ORDER BY p.position, p.id
    `, [key]);
    return result.rows;
}

async function keysOfFaq(db, faqId) {
    const result = await db.query('SELECT page_key FROM faq_placements WHERE faq_id = $1', [faqId]);
    return result.rows.map(r => r.page_key);
}

async function setFaqPages(db, faqId, keys) {
    await db.query('DELETE FROM faq_placements WHERE faq_id = $1 AND NOT (page_key = ANY($2::text[]))', [faqId, keys]);
    // A page it is new on gets it at the end of that page's list.
    await db.query(`
        INSERT INTO faq_placements (faq_id, page_key, position)
        SELECT $1, k.key, COALESCE((SELECT MAX(position) FROM faq_placements WHERE page_key = k.key), 0) + 1
        FROM unnest($2::text[]) AS k(key)
        ON CONFLICT (faq_id, page_key) DO NOTHING
    `, [faqId, keys]);
    return [...keys].sort();
}

async function setPageFaqs(db, key, ids) {
    if (ids.length) {
        const found = await db.query('SELECT id FROM faqs WHERE id = ANY($1::int[])', [ids]);
        if (found.rowCount !== ids.length) throw badRequest('Some of those FAQs no longer exist. Reload the page and try again.');
    }
    await db.query('DELETE FROM faq_placements WHERE page_key = $1 AND NOT (faq_id = ANY($2::int[]))', [key, ids]);
    await db.query(`
        INSERT INTO faq_placements (faq_id, page_key, position)
        SELECT o.id, $1, o.ord
        FROM unnest($2::int[]) WITH ORDINALITY AS o(id, ord)
        ON CONFLICT (faq_id, page_key) DO UPDATE SET position = EXCLUDED.position
    `, [key, ids]);
    return onPage(db, key);
}

module.exports = { allPlaced, forPath, pagesByFaq, pageCounts, onPage, keysOfFaq, setFaqPages, setPageFaqs };
