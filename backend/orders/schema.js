/*
 * Tables behind the admin order page. Safe to run on every start.
 *
 *   order_events     what happened to an order: status changes, emails sent
 *                    (and whether they went out), internal notes, tracking
 *                    and photos added. customer_visible rows show on the
 *                    customer's own order page.
 *   order_shipments  carrier + tracking number per package / delivery
 *   order_photos     photos the shop uploads (parts, packing, QC)
 */
async function ensureOrderOpsSchema(db) {
    await db.query(`
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

        CREATE TABLE IF NOT EXISTS order_events (
            id SERIAL PRIMARY KEY,
            order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            kind VARCHAR(30) NOT NULL,
            title VARCHAR(300) NOT NULL,
            body TEXT,
            status_from VARCHAR(30),
            status_to VARCHAR(30),
            email_to TEXT,
            email_subject TEXT,
            email_status VARCHAR(20),
            email_error TEXT,
            customer_visible BOOLEAN NOT NULL DEFAULT false,
            actor_email VARCHAR(200),
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events (order_id, created_at);

        CREATE TABLE IF NOT EXISTS order_shipments (
            id SERIAL PRIMARY KEY,
            order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            carrier VARCHAR(40) NOT NULL,
            carrier_name VARCHAR(120),
            service VARCHAR(120),
            tracking_number VARCHAR(120),
            tracking_url TEXT,
            shipped_at DATE,
            packages INT,
            notes TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS order_shipments_order_idx ON order_shipments (order_id);

        CREATE TABLE IF NOT EXISTS order_photos (
            id SERIAL PRIMARY KEY,
            order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            order_item_id INT REFERENCES order_items(id) ON DELETE SET NULL,
            file_path TEXT NOT NULL,
            thumb_path TEXT,
            original_name VARCHAR(255),
            caption VARCHAR(300),
            width INT,
            height INT,
            size_bytes INT,
            customer_visible BOOLEAN NOT NULL DEFAULT true,
            actor_email VARCHAR(200),
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS order_photos_order_idx ON order_photos (order_id);
    `);
}

module.exports = { ensureOrderOpsSchema };
