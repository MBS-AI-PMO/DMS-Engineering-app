/*
 * Tables for the costing set up in Admin > Costing. Safe to run on every
 * start (IF NOT EXISTS everywhere); called from server.js and the seed.
 *
 *   costing_sheet_sizes       sheets the shop buys; one is the default
 *   costing_sheet_costs       a material family + thickness band ...
 *   costing_sheet_cost_prices ... and its price per sheet size
 *   laser_cut_rates           (existing) cut speed and pierce time by thickness
 *   costing_operations        priced operations (laser, bend, deburr, …) and their values
 *   costing_markups           markups / margins
 *   costing_add_ons           flat fees per line
 *   costing_service_*         which operations, markups and add-ons each service uses
 */
async function ensureCostingSchema(db) {
    await db.query(`
        CREATE TABLE IF NOT EXISTS costing_sheet_sizes (
            id SERIAL PRIMARY KEY,
            name VARCHAR(80) NOT NULL,
            length_in NUMERIC(10,4) NOT NULL CHECK (length_in > 0),
            width_in NUMERIC(10,4) NOT NULL CHECK (width_in > 0),
            is_default BOOLEAN NOT NULL DEFAULT false,
            is_active BOOLEAN NOT NULL DEFAULT true,
            sort_order INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS costing_sheet_sizes_one_default
            ON costing_sheet_sizes ((is_default)) WHERE is_default;

        CREATE TABLE IF NOT EXISTS costing_sheet_costs (
            id SERIAL PRIMARY KEY,
            family VARCHAR(120) NOT NULL,
            metal_id INT REFERENCES metals(id) ON DELETE SET NULL,
            ga VARCHAR(40),
            thickness_in NUMERIC(10,5),
            min_thick NUMERIC(10,5),
            max_thick NUMERIC(10,5),
            sort_order INT NOT NULL DEFAULT 0,
            source VARCHAR(40),
            source_row_id INT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS costing_sheet_cost_prices (
            sheet_cost_id INT NOT NULL REFERENCES costing_sheet_costs(id) ON DELETE CASCADE,
            sheet_size_id INT NOT NULL REFERENCES costing_sheet_sizes(id) ON DELETE CASCADE,
            cost NUMERIC(12,2) NOT NULL CHECK (cost >= 0),
            PRIMARY KEY (sheet_cost_id, sheet_size_id)
        );

        CREATE TABLE IF NOT EXISTS laser_cut_rates (
            id SERIAL PRIMARY KEY,
            material_family VARCHAR(100) NOT NULL DEFAULT 'generic',
            thickness NUMERIC(12,6) NOT NULL,
            cut_rate NUMERIC(12,4) NOT NULL,
            pierce_time NUMERIC(12,4) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
        ALTER TABLE laser_cut_rates ADD COLUMN IF NOT EXISTS metal_id INT REFERENCES metals(id) ON DELETE SET NULL;
        ALTER TABLE laser_cut_rates ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

        CREATE TABLE IF NOT EXISTS costing_operations (
            id SERIAL PRIMARY KEY,
            key VARCHAR(80) NOT NULL UNIQUE,
            name VARCHAR(120) NOT NULL,
            customer_label VARCHAR(120),
            op_type VARCHAR(40) NOT NULL,
            bucket VARCHAR(20) NOT NULL CHECK (bucket IN ('material', 'inside', 'outside', 'purchased')),
            variables JSONB NOT NULL DEFAULT '{}'::jsonb,
            sort_order INT NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            source VARCHAR(40),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS costing_markups (
            id SERIAL PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            calc_type VARCHAR(10) NOT NULL DEFAULT 'markup' CHECK (calc_type IN ('markup', 'margin')),
            base VARCHAR(20) NOT NULL CHECK (base IN ('material', 'inside', 'outside', 'purchased', 'overhead', 'general')),
            percent NUMERIC(8,4) NOT NULL DEFAULT 0 CHECK (percent >= 0 AND percent < 1000),
            sort_order INT NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS costing_add_ons (
            id SERIAL PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
            apply_mode VARCHAR(10) NOT NULL DEFAULT 'optional' CHECK (apply_mode IN ('always', 'optional')),
            sort_order INT NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS costing_service_operations (
            service_id INT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            operation_id INT NOT NULL REFERENCES costing_operations(id) ON DELETE CASCADE,
            PRIMARY KEY (service_id, operation_id)
        );
        CREATE TABLE IF NOT EXISTS costing_service_markups (
            service_id INT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            markup_id INT NOT NULL REFERENCES costing_markups(id) ON DELETE CASCADE,
            PRIMARY KEY (service_id, markup_id)
        );
        CREATE TABLE IF NOT EXISTS costing_service_add_ons (
            service_id INT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            add_on_id INT NOT NULL REFERENCES costing_add_ons(id) ON DELETE CASCADE,
            PRIMARY KEY (service_id, add_on_id)
        );

        ALTER TABLE metals ADD COLUMN IF NOT EXISTS costing_family VARCHAR(120);

        ALTER TABLE order_items ADD COLUMN IF NOT EXISTS quote_snapshot_json JSONB;
        ALTER TABLE order_items ADD COLUMN IF NOT EXISTS line_total NUMERIC(12,2);
        ALTER TABLE order_items ADD COLUMN IF NOT EXISTS client_unit_price NUMERIC(12,4);
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_total_price NUMERIC(12,2);
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS pricing_version VARCHAR(60);

        -- The server's own measurement of an uploaded part, by file content.
        CREATE TABLE IF NOT EXISTS cad_measurements (
            file_hash CHAR(64) PRIMARY KEY,
            kind VARCHAR(10) NOT NULL,
            measurement JSONB NOT NULL,
            version VARCHAR(20) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );

        -- A PayPal payment and the server-priced cart it paid for.
        CREATE TABLE IF NOT EXISTS payment_checkout_sessions (
            id SERIAL PRIMARY KEY,
            provider VARCHAR(20) NOT NULL DEFAULT 'paypal',
            provider_order_id VARCHAR(100) NOT NULL UNIQUE,
            provider_capture_id VARCHAR(100) UNIQUE,
            user_id INT,
            items_hash VARCHAR(64) NOT NULL,
            priced_lines JSONB NOT NULL,
            amount NUMERIC(12,2) NOT NULL,
            currency VARCHAR(3) NOT NULL DEFAULT 'USD',
            status VARCHAR(20) NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'captured', 'used')),
            order_id INT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
    `);
}

module.exports = { ensureCostingSchema };
