const express = require('express');
const cors = require('cors');
const compression = require('compression');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const db = require('./db');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const metalsRoutes = require('./routes/metals');
const categoriesRoutes = require('./routes/categories');
const faqsRoutes = require('./routes/faqs');
const quoteRoutes = require('./routes/quote');
const servicesRoutes = require('./routes/services');
const usersRoutes = require('./routes/users');
const emailRoutes = require('./routes/email');
const newsletterRoutes = require('./routes/newsletter');
const settingsRoutes = require('./routes/settings');
const guidelinesRoutes = require('./routes/guidelines');
const configurationsRoutes = require('./routes/configurations');
const pricingRoutes = require('./routes/pricing');
const orderRoutes = require('./routes/orders');
const hardwareRoutes = require('./routes/hardware');
const paymentRoutes = require('./routes/payment');
const legalRoutes = require('./routes/legal');

const app = express();
const port = process.env.PORT || 5000;

// FIX 1: Allow your public IP in CORS so the frontend can talk to the backend
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', `http://${process.env.PUBLIC_IP || '18.117.111.36'}`],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
app.use(compression()); // Enable Gzip compression for all responses

// Serve static images with aggressive 1-year caching
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    maxAge: '1y',
    immutable: true
}));

// Serve temporary CAD assets for cart persistence établissement
app.use('/temp_uploads', express.static(path.join(__dirname, 'temp_uploads')));

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/metals', metalsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/faqs', faqsRoutes);
app.use('/api/quote', quoteRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/guidelines', guidelinesRoutes);
app.use('/api/configurations', configurationsRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/hardware', hardwareRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/legal', legalRoutes);

// Global Error Handler for Multer errors
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, error: 'File too large. Max limit is 25MB.' });
        }
        return res.status(400).json({ success: false, error: err.code || err.message });
    }
    next(err);
});

// Setup multer for file uploads
const uploadDir = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname)
});

const upload = multer({ storage });

// FIX 2: Added a root health check so http://IP:5000/health actually works
app.get('/health', (req, res) => {
    res.json({ status: 'ok', engine: 'Node.js', message: 'DMS Backend is Live' });
});

// Health Check (Under API prefix)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', engine: 'Node.js' });
});

// File upload endpoint for CAD assets Establishment établissement
app.post('/api/upload-asset', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    // Return the relative path for world-class persistence établissements
    res.json({
        success: true,
        filename: req.file.filename,
        tempPath: `temp_uploads/${req.file.filename}`
    });
});

// Database Connectivity Check établissement
app.get('/api/db-check', async (req, res) => {
    try {
        const start = Date.now();
        const result = await db.query('SELECT NOW()');
        const end = Date.now();
        res.json({
            success: true,
            timestamp: result.rows[0].now,
            latency: `${end - start}ms`,
            message: 'PostgreSQL connection successful'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
            message: 'PostgreSQL connection failed'
        });
    }
});

// Ported Unfold Logic (STEP/STP)
// Common Python Helper
const PYTHON_PORT = process.env.PYTHON_PORT || 8000;
const PYTHON_BASE_URL = `http://localhost:${PYTHON_PORT}`;

const callPython = async (subpath, formData) => {
    const pyRes = await fetch(`${PYTHON_BASE_URL}${subpath}`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(120_000),
    });
    if (!pyRes.ok) {
        const errText = await pyRes.text().catch(() => '');
        throw new Error(`Python error (${pyRes.status}): ${errText}`);
    }
    return pyRes.json();
};

// --- Fast Analysis (Holes/Dimensions) ---
app.post('/api/detect-holes', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    const filename = (req.file.originalname || '').toLowerCase();
    if (!filename.endsWith('.step') && !filename.endsWith('.stp')) {
        fs.unlink(req.file.path, () => { });
        return res.status(400).json({ success: false, error: 'Only STEP/STP files supported' });
    }

    try {
        const fileBuffer = fs.readFileSync(req.file.path);
        const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');

        const cacheDir = path.join(__dirname, 'cache');
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);
        const cachePath = path.join(cacheDir, `${hash}_holes.json`);
        // New: Check if the FULL unfold cache already exists (it contains hole data too)
        const fullCachePath = path.join(cacheDir, `${hash}.json`);

        if (fs.existsSync(fullCachePath)) {
            console.log(`[CAD-CACHE] Serving holes from full cache for ${hash}`);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('X-CAD-Cache', 'hit-full');
            return fs.createReadStream(fullCachePath).pipe(res);
        }

        if (fs.existsSync(cachePath)) {
            console.log(`[CAD-CACHE] Streaming cached holes for ${hash}`);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('X-CAD-Cache', 'hit');
            return fs.createReadStream(cachePath).pipe(res);
        }

        const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
        const form = new FormData();
        form.append('file', blob, req.file.originalname || 'model.step');

        // Always call '/unfold' even for holes to populate the full cache in one go
        console.log(`[CAD-BIO] Triggering unified processing for ${hash}...`);
        const data = await callPython('/unfold', form);

        // Save to BOTH caches
        fs.writeFileSync(fullCachePath, JSON.stringify(data));
        fs.writeFileSync(cachePath, JSON.stringify({
            success: true,
            holes: data.detectedHoles || [],
            faceMeshes: data.faceMeshes || {},
            bendTree: data.bendTree || null,
            thickness: data.thickness || 2.0
        }));

        return res.json({ success: true, ...data });
    } catch (err) {
        console.error('[CAD-ERROR]', err);
        return res.status(500).json({ success: false, error: err.message });
    } finally {
        fs.unlink(req.file.path, () => { });
    }
});

// --- Full Unfold (Bends/Flat Pattern) ---
app.post('/api/unfold', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    const filename = (req.file.originalname || '').toLowerCase();
    if (!filename.endsWith('.step') && !filename.endsWith('.stp')) {
        fs.unlink(req.file.path, () => { });
        return res.status(400).json({ success: false, error: 'Only STEP/STP files supported' });
    }

    try {
        const fileBuffer = fs.readFileSync(req.file.path);
        const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');

        const cacheDir = path.join(__dirname, 'cache');
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);
        const cachePath = path.join(cacheDir, `${hash}.json`);

        if (fs.existsSync(cachePath)) {
            console.log(`[CAD-CACHE] Streaming cached unfold for ${hash}`);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('X-CAD-Cache', 'hit');
            return fs.createReadStream(cachePath).pipe(res);
        }

        const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
        const form = new FormData();
        form.append('file', blob, req.file.originalname || 'model.step');

        const data = await callPython('/unfold', form);
        fs.writeFileSync(cachePath, JSON.stringify(data));
        return res.json({ success: true, ...data });
    } catch (err) {
        console.error('[CAD-ERROR]', err);
        return res.status(500).json({ success: false, error: err.message });
    } finally {
        fs.unlink(req.file.path, () => { });
    }
});

app.listen(port, async () => {
    console.log(`\x1b[43m\x1b[30m Server running at http://localhost:${port} \x1b[0m`);
    try {
        await db.query('SELECT NOW()');
        console.log(`\x1b[45m\x1b[30m Database Integrated & Connected Successfully \x1b[0m`);
        // Ensure customer profile columns exist
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);`);
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;`);
        // Ensure configuration tables exist
        await db.query(`
            CREATE TABLE IF NOT EXISTS service_configs (
                id SERIAL PRIMARY KEY,
                service_type VARCHAR(50) UNIQUE NOT NULL
                    CHECK (service_type IN ('cnc_machining', 'sheet_cutting')),
                min_x NUMERIC(12,4) DEFAULT 0, max_x NUMERIC(12,4),
                min_y NUMERIC(12,4) DEFAULT 0, max_y NUMERIC(12,4),
                min_z NUMERIC(12,4) DEFAULT 0, max_z NUMERIC(12,4),
                created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.query(`INSERT INTO service_configs (service_type) VALUES ('cnc_machining') ON CONFLICT DO NOTHING;`);
        await db.query(`INSERT INTO service_configs (service_type) VALUES ('sheet_cutting') ON CONFLICT DO NOTHING;`);
        await db.query(`
            CREATE TABLE IF NOT EXISTS metal_configs (
                id SERIAL PRIMARY KEY,
                metal_id INTEGER UNIQUE NOT NULL REFERENCES metals(id) ON DELETE CASCADE,
                min_x NUMERIC(12,4), max_x NUMERIC(12,4),
                min_y NUMERIC(12,4), max_y NUMERIC(12,4),
                min_z NUMERIC(12,4), max_z NUMERIC(12,4),
                available_thicknesses JSONB DEFAULT '[]',
                is_sheet_cuttable BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS service_metal_assignments (
                id SERIAL PRIMARY KEY,
                service_type VARCHAR(50) NOT NULL
                    CHECK (service_type IN ('cnc_machining', 'sheet_cutting')),
                metal_id INTEGER NOT NULL REFERENCES metals(id) ON DELETE CASCADE,
                UNIQUE(service_type, metal_id)
            );
        `);

        // Order Management Tables
        await db.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                email VARCHAR(255) NOT NULL,
                full_name VARCHAR(255),
                phone VARCHAR(50),
                address TEXT,
                city VARCHAR(100),
                zip_code VARCHAR(20),
                total_price NUMERIC(15,2) NOT NULL,
                payment_method VARCHAR(50) DEFAULT 'COD',
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS order_items (
                id SERIAL PRIMARY KEY,
                order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                file_name VARCHAR(255) NOT NULL,
                original_file_path TEXT NOT NULL,
                configured_file_path TEXT,
                flat_file_path TEXT,
                configuration_json JSONB NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1,
                unit_price NUMERIC(15,2) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        // Ensure all columns exist for world-class persistence
        await db.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS flat_file_path TEXT;`);
        await db.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS configured_file_path TEXT;`);

        // Hardware Item Specification Migration
        await db.query(`ALTER TABLE hardware_items ADD COLUMN IF NOT EXISTS length NUMERIC(12,4);`);
        await db.query(`ALTER TABLE hardware_items ADD COLUMN IF NOT EXISTS min_edge_distance NUMERIC(12,4);`);
        await db.query(`ALTER TABLE hardware_items ADD COLUMN IF NOT EXISTS tooling_diameter NUMERIC(12,4);`);
        await db.query(`ALTER TABLE hardware_items ADD COLUMN IF NOT EXISTS base_width NUMERIC(12,4);`);
        await db.query(`ALTER TABLE hardware_items ADD COLUMN IF NOT EXISTS shank NUMERIC(12,4);`);
        await db.query(`ALTER TABLE hardware_items ADD COLUMN IF NOT EXISTS major_dia NUMERIC(12,4);`);
        await db.query(`ALTER TABLE hardware_items ADD COLUMN IF NOT EXISTS minor_dia NUMERIC(12,4);`);
        await db.query(`ALTER TABLE hardware_items ADD COLUMN IF NOT EXISTS angle NUMERIC(8,2);`);
        await db.query(`ALTER TABLE hardware_items ADD COLUMN IF NOT EXISTS max_hole_diameter NUMERIC(12,4);`);
    } catch (err) {
        console.log(`\x1b[41m\x1b[37m Database Connection Failed: ${err.message} \x1b[0m`);
    }
});