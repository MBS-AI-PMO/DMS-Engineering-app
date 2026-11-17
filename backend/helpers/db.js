/*
 * Database helpers.
 *
 *   const row = await withTransaction(async (client) => { … return value; });
 *
 * Runs fn on one pooled connection inside BEGIN/COMMIT; any throw rolls back
 * and is re-thrown. Use client.query inside, never db.query (that would run
 * outside the transaction).
 */
const db = require('../db');

async function withTransaction(fn) {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

/* Reads a site_settings value (stored as JSON text) or the fallback. */
async function readSetting(key, fallback = undefined, client = db) {
    const res = await client.query('SELECT value FROM site_settings WHERE key = $1', [key]);
    if (!res.rows.length) return fallback;
    const raw = res.rows[0].value;
    if (typeof raw !== 'string') return raw;
    try { return JSON.parse(raw); } catch { return raw; }
}

async function writeSetting(key, value, client = db) {
    await client.query(
        `INSERT INTO site_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
        [key, JSON.stringify(value)]
    );
}

module.exports = { db, withTransaction, readSetting, writeSetting };
