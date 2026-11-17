/*
 * Tables behind quote requests: parts the site could not price instantly,
 * sent to the shop with the customer's file. Safe to run on every start.
 *
 *   quote_requests        one request: who asked, the part (file copied to
 *                         uploads/quotes/<id>/, what they chose, the pricing
 *                         request and why it had no instant price) and the
 *                         shop's answer (price, lead time, message).
 *   quote_request_events  what happened to it: emails (and whether they went
 *                         out), status changes, the reply, internal notes.
 */
async function ensureQuoteSchema(db) {
    await db.query(`
        CREATE TABLE IF NOT EXISTS quote_requests (
            id SERIAL PRIMARY KEY,
            status VARCHAR(20) NOT NULL DEFAULT 'new',
            user_id INT REFERENCES users(id) ON DELETE SET NULL,
            name VARCHAR(200) NOT NULL,
            email VARCHAR(254) NOT NULL,
            phone VARCHAR(50),
            company VARCHAR(200),
            message TEXT,
            quantity INT NOT NULL DEFAULT 1,
            file_name VARCHAR(255),
            file_path TEXT,
            file_size BIGINT,
            source VARCHAR(20),
            configuration_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            pricing_input JSONB,
            reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
            quoted_unit_price NUMERIC(15,2),
            quoted_quantity INT,
            quoted_total NUMERIC(15,2),
            lead_time VARCHAR(120),
            reply_message TEXT,
            quoted_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT quote_requests_status_check CHECK (status IN ('new', 'quoted', 'accepted', 'declined', 'closed'))
        );
        CREATE INDEX IF NOT EXISTS quote_requests_created_idx ON quote_requests (created_at DESC);
        CREATE INDEX IF NOT EXISTS quote_requests_user_idx ON quote_requests (user_id);
        CREATE INDEX IF NOT EXISTS quote_requests_email_idx ON quote_requests (LOWER(email));

        CREATE TABLE IF NOT EXISTS quote_request_events (
            id SERIAL PRIMARY KEY,
            quote_request_id INT NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
            kind VARCHAR(30) NOT NULL,
            title VARCHAR(300) NOT NULL,
            body TEXT,
            status_from VARCHAR(20),
            status_to VARCHAR(20),
            email_to TEXT,
            email_subject TEXT,
            email_status VARCHAR(20),
            email_error TEXT,
            actor_email VARCHAR(200),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS quote_request_events_quote_idx ON quote_request_events (quote_request_id, created_at);
    `);
    // The first version stored plain TIMESTAMPs (read back in the server's
    // local zone, hours off); they were written in the session zone, which
    // is what a plain conversion assumes.
    await db.query(`
        DO $$
        DECLARE col RECORD;
        BEGIN
            FOR col IN
                SELECT table_name, column_name FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name IN ('quote_requests', 'quote_request_events')
                  AND column_name IN ('created_at', 'updated_at', 'quoted_at')
                  AND data_type = 'timestamp without time zone'
            LOOP
                EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE TIMESTAMPTZ', col.table_name, col.column_name);
            END LOOP;
        END $$;
    `);
}

module.exports = { ensureQuoteSchema };
