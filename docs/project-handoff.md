# DMS Project Handoff (CNC Phase 4 + Project Scan)

Last updated: 2026-05-01
Workspace: `D:\Frontend\DMS`

## Purpose

This document combines the CNC Phase 4 handoff and the broader project scan into a single reference for ongoing work.

## 1. CNC Phase 4 Summary

### Current CNC State

Completed phases:
- Phase 1: configurable 5-operation CNC engine
- Phase 2: smart admin-configurable rules engine
- Phase 3: STEP topology-driven CNC feature extraction

The CNC quote flow supports:
- Operations: `Saw`, `Lathe`, `Mill`, `Deburr`, `Inspect`
- Modes: `manual` and `smart`
- Admin-controlled enable rules, runtime factors, setup multipliers, setup-count rules, and risk surcharges
- Quote warnings, setup context, risk breakdown, and per-operation breakdown in the UI

### Key Files (CNC)

Primary pricing engine:
- `backend/routes/pricing.js`

STEP/CAD analysis:
- `backend/unfold_lib.py`
- `backend/main.py`

Frontend quote flow:
- `client/src/pages/InstantPricing.jsx`
- `client/src/components/pricing/PricingSidebar.jsx`

Admin CNC configuration:
- `client/src/pages/admin/ServiceEdit.jsx`

### CAD-Derived CNC Signals

The STEP analysis returns `cncFeatures` with:
- `pocketCount`
- `slotCount`
- `recessedFaceCount`
- `deepPocketCount`
- `pocketDepthMmMax`
- `throughHoleCount`
- `blindHoleCount`
- `machiningDirectionCount`
- `setupCountEstimate`
- `verticalWallFaceCount`
- `cylindricalFaceCount`
- `planarFaceCount`
- `cylindricalAreaRatio`
- `rotationalCandidate`

These are fed into:
- smart operation enable rules
- smart runtime calculation
- smart setup count floor logic
- smart risk/warning logic

### Phase 4 Definition

Phase 4 is calibration, not architecture.

Goal:
- tune the CNC engine against real jobs so quotes match shop reality

Calibration targets:
- setup-count rules
- per-operation runtime factors
- shop rates
- risk surcharge thresholds
- warning thresholds
- lathe vs mill activation rules

### Recommended Phase 4 Work Order

1. Build a calibration dataset from real quotes/orders
   - part id / file
   - material
   - quantity
   - detected CNC metrics
   - operation breakdown
   - quoted unit price
   - actual or expected shop cost

2. Add a calibration snapshot to each quote/order
   - save exact pricing inputs and derived CNC metrics
   - save exact operation breakdown used at quote time
   - make later comparison possible even if admin settings change

3. Add admin visibility for calibration
   - inspect quote inputs
   - inspect CNC metrics
   - inspect operation/risk/setup breakdown
   - compare quoted vs target/actual

4. Tune coefficients iteratively
   - adjust one rule family at a time
   - validate on a batch of representative jobs

### Practical Next Step (CNC)

Persist a CNC calibration snapshot with orders/quotes so every real job becomes tuning data.

Snapshot should include:
- `pricingTechnicalData`
- returned `cnc_derived_metrics`
- returned `cnc_setup_context`
- returned `cnc_risk_breakdown`
- returned `cnc_operation_breakdown`
- final unit/total price

### Known Boundary

The system is a topology-aware quoting engine, but it is not a CAM simulator. It does not generate real toolpaths, actual cycle time, or machine-specific tool strategy.

## 2. Project Scan Summary

### What this project is

This repository is a manufacturing quoting platform, not just a marketing site.

Core product areas:
- Public marketing website for services, metals, FAQs, guidelines, legal pages, and contact
- Instant pricing workflow for CAD uploads with STEP/DXF support
- Customer auth, cart, checkout, and order history
- Admin panel for managing metals, services, FAQs, guidelines, legal content, pricing, orders, customers, payment settings, and contact/site settings
- Backend CAD analysis pipeline that uses Node + Python to detect holes, unfold sheet-metal parts, and generate configured previews

Business domain inferred from the code:
- Laser cutting
- CNC machining
- Bending / flat pattern handling
- Tapping
- Countersinking
- Hardware insertion
- Finishes such as anodizing, plating, powder coating, tumbling, deburring

### High-level architecture

Top-level structure:
- `client/`: Vite + React frontend
- `backend/`: Express API + PostgreSQL access + Python CAD worker integration
- `db_backup.sql`: database dump present in repo root

Runtime architecture:
1. React frontend talks to `/api/...`.
2. Express backend serves JSON APIs, uploads, auth cookies, and proxies CAD work to Python.
3. Python service performs STEP analysis/unfold operations.
4. PostgreSQL stores application state and configuration.
5. Uploaded/generated files are stored under backend `uploads/` and `temp_uploads/`.

### Frontend scan

Frontend stack:
- React 19
- React Router 7
- Vite 8
- Bootstrap + custom CSS
- Framer Motion
- Three.js + online-3d-viewer + OCCT import
- PayPal React SDK

Important frontend files:
- `client/src/App.jsx`: route map
- `client/src/pages/InstantPricing.jsx`: main pricing workflow
- `client/src/utils/api.js`: API client
- `client/src/context/AuthContext.jsx`: customer auth
- `client/src/context/AdminAuthContext.jsx`: admin auth
- `client/src/context/CartProvider.jsx`: cart persistence and repricing

Public routes:
- `/`
- `/metals`
- `/metal/:slug`
- `/metal-by-id/:id`
- `/services`
- `/service/:slug`
- `/get-instant-pricing`
- `/quote`
- `/contact`
- `/faq`
- `/guidelines`
- `/privacy-policy`
- `/terms-of-service`
- `/login`
- `/signup`
- `/settings`
- `/cart`
- `/checkout`
- `/orders`

Admin routes:
- `/admin/login`
- `/admin`
- `/admin/metals`
- `/admin/categories`
- `/admin/faqs`
- `/admin/faq-categories`
- `/admin/services`
- `/admin/admins`
- `/admin/email`
- `/admin/payment`
- `/admin/subscribers`
- `/admin/contact`
- `/admin/guidelines`
- `/admin/customers`
- `/admin/pricing`
- `/admin/pricing-calculator`
- `/admin/laser-rates`
- `/admin/sheet-cost-rates`
- `/admin/legal`
- `/admin/orders`

Frontend subsystems:
- Viewer stack under `client/src/components/viewer/`
- Cart and order pricing persistence
- Dynamic site settings for logos/contact/footer/socials
- Admin CMS/editor flows for metals, services, legal docs, and guidelines
- PayPal checkout integration

Frontend state/persistence:
- Auth uses cookie-backed API sessions via `credentials: 'include'`
- Cart persists in `localStorage` key `dms_cart`
- Some UI state also uses local storage:
  - navbar/footer logos
  - viewer mode

Frontend complexity hotspots:
- `client/src/pages/InstantPricing.jsx`
- `client/src/components/viewer/StepModelViewer.jsx`
- `client/src/components/viewer/ProjectViewer.jsx`
- `client/src/pages/admin/ServiceEdit.jsx`
- `client/src/pages/admin/PricingManagement.jsx`
- `client/src/pages/admin/OrdersList.jsx`

### Backend scan

Backend stack:
- Express 5
- PostgreSQL via `pg`
- JWT auth in cookies
- Multer uploads
- Sharp image optimization
- Python subprocess / HTTP worker integration for CAD tasks

Main backend entrypoints:
- `backend/server.js`: Express app and route mounting
- `backend/db.js`: PostgreSQL pool setup
- `backend/main.py`: Python HTTP server for unfold and hole-detection jobs

Mounted API groups:
- `/api/auth`
- `/api/metals`
- `/api/categories`
- `/api/faqs`
- `/api/quote`
- `/api/services`
- `/api/users`
- `/api/email`
- `/api/newsletter`
- `/api/settings`
- `/api/guidelines`
- `/api/configurations`
- `/api/pricing`
- `/api/orders`
- `/api/hardware`
- `/api/payment`
- `/api/legal`

Standalone backend endpoints in `server.js`:
- `GET /health`
- `GET /api/health`
- `POST /api/upload-asset`
- `GET /api/db-check`
- `POST /api/detect-holes-by-temp`
- `POST /api/detect-holes`
- `POST /api/unfold`
- `POST /api/unfold-job/start`
- `GET /api/unfold-job/:jobId`

Auth model:
- JWT secret comes from `JWT_SECRET` with an insecure fallback default in code
- Middleware checks `token`, then `admin_token`, then bearer auth
- Admin routes use `requireAdmin`, which retries with `admin_token` if needed
- Customer and admin auth are maintained separately in the frontend

File storage behavior:
- Permanent assets under backend `uploads/`
- Temporary CAD assets under backend `temp_uploads/`
- Order files finalized into `uploads/orders/`
- Static serving:
  - `/uploads`
  - `/temp_uploads`
  - `/api/temp_uploads`

Image upload areas:
- metals
- services
- hardware
- logos / hero assets

### CAD and pricing pipeline

Observed flow:
1. User uploads CAD file from `InstantPricing.jsx`.
2. Frontend sends file to `POST /api/upload-asset`.
3. Node stores temp file and returns `tempPath`.
4. Frontend can call hole detection or unfold endpoints.
5. Node forwards STEP work to Python service running on `PYTHON_PORT` (default `8000`).
6. Python analyzes geometry, handles async job state, and returns dimensions / bends / flat-pattern data.
7. Frontend combines geometry data, selected services, hardware, finishes, and quantity into a pricing payload.
8. Backend pricing routes calculate totals and optional configured previews.
9. Cart stores a serialized configuration for later checkout and order submission.

Important implementation files:
- `backend/main.py`
- `backend/unfold.py`
- `backend/unfold_lib.py`
- `backend/process_configured.py`
- `backend/routes/pricing.js`
- `backend/routes/orders.js`
- `client/src/pages/InstantPricing.jsx`

Notable CAD features inferred from code:
- STEP/STP support
- DXF workflow
- hole detection
- sheet-metal unfold
- async unfold jobs with polling
- configured preview generation
- hardware insertion config
- tapping / countersinking config
- bend tree / flat pattern visualization

Caching / job control present:
- Node-side hole detection cache
- Node-side configured preview cache
- Python-side unfold job registry and result cache
- queue limiting and worker timeout controls in Python

### Data model scan

Base tables from migrations / bootstrapping:
- `users`
- `metal_categories`
- `metals`
- `faq_categories`
- `faqs`
- `services`
- `email_config`
- `newsletter_subscribers`
- `service_configs`
- `metal_configs`
- `service_metal_assignments`
- `orders`
- `order_items`
- `site_settings`
- `pricing_rules`
- `quantity_discounts`
- `laser_cut_rates`
- `sheet_cost_rates`
- `hardware_types`
- `hardware_items`
- `service_guidelines`
- `legal_documents`
- `service_relationships`

Important data patterns:
- `metals` stores many rich content sections in JSONB
- `order_items.configuration_json` stores serialized quote/order configuration
- `site_settings` is a generic key/value JSONB table
- pricing relies on multiple tables:
  - `pricing_rules`
  - `quantity_discounts`
  - `laser_cut_rates`
  - `sheet_cost_rates`
- service/metal eligibility is driven by assignment/config tables rather than hardcoded logic alone

### Environment and runtime expectations

Frontend env vars referenced:
- `VITE_API_BASE_URL`
- `VITE_API_URL`

Backend env vars referenced:
- `PORT`
- `DB_USER`
- `DB_HOST`
- `DB_NAME`
- `DB_PASSWORD`
- `DB_PORT`
- `JWT_SECRET`
- `EMAIL_ENCRYPTION_KEY`
- `PUBLIC_IP`
- `CORS_ORIGINS`
- `CORS_ALLOW_ALL`
- `PYTHON_PORT`
- `PYTHON_REQUEST_TIMEOUT_MS`
- `PYTHON_SYNC_UNFOLD_TIMEOUT_MS`
- `PYTHON_STATUS_TIMEOUT_MS`
- `PYTHON_PATH`

Python/CAD env vars referenced:
- `UNFOLD_RESULT_CACHE_TTL_SECONDS`
- `UNFOLD_RESULT_CACHE_MAX`
- `UNFOLD_ANALYSIS_VERSION`
- `GEOMETRY_LOCK_WAIT_TIMEOUT_SECONDS`
- `FREECAD_WORKER_TIMEOUT_SECONDS`
- `FREECAD_KILL_GRACE_SECONDS`
- `MAX_PARALLEL_FREECAD_WORKERS`
- `CAD_JOB_QUEUE_LIMIT`
- `ENABLE_LEGACY_UNFOLD_FALLBACK`
- `FREECAD_PATH`

Runtime assumptions found in code:
- PostgreSQL must be available for backend startup to be fully useful
- Python CAD service is expected locally and is part of backend dev workflow
- The backend `dev` script hardcodes a Windows Conda Python path

### Verification snapshot (2026-04-28)

Checks run during scan:
- frontend `npm.cmd run build`
- frontend `npm.cmd run lint`
- backend syntax check: `node --check`
- python syntax check: `python -m py_compile`

Results:
- Frontend build did not complete due to Vite config loading hitting a sandbox/process permission error: `spawn EPERM`
- Frontend lint is failing
- Backend JS syntax checks passed for sampled critical files:
  - `backend/server.js`
  - `backend/routes/pricing.js`
  - `backend/routes/orders.js`
- Python syntax compilation passed for:
  - `backend/main.py`
  - `backend/unfold.py`
  - `backend/process_configured.py`
  - `backend/unfold_lib.py`

Frontend lint findings observed:
- Minified vendor file `client/public/ov-libs-v1/three.min.js` is being linted and creates many errors
- Several unused imports/variables exist in app source files
- React hook rule violations exist in `client/src/components/QuoteFlow.jsx`
- Fast-refresh rule violations exist in the auth/toast context files
- `client/src/data/reindex.js` uses `require` under a config that expects ESM/browser globals

### Risks and likely future friction

High-probability friction areas:
- `InstantPricing.jsx` is very large and likely difficult to change safely without targeted refactoring
- Pricing logic is distributed across frontend payload assembly, backend route calculation, DB rate tables, and Python/CAD-derived geometry
- Upload/temp/permanent file path handling is critical and spread across several places
- Backend startup does schema mutation in `server.js`, which can blur boot/runtime responsibilities
- Hardcoded Windows Python path in backend dev script reduces portability
- JWT secret fallback and other fallback secrets should be treated as production risk if still in use
- Lint noise from vendored/minified assets will hide real issues until excluded

Performance / repo health observations:
- Large image assets are present directly in `client/src/assets`, including many multi-megabyte files
- Scratch/debug files exist in `backend/scratch/`
- The repo includes both generated/static assets and application code, so tooling may be noisier/slower than necessary

### Good starting points for future work

If we work on:
- Pricing bugs: start with `client/src/pages/InstantPricing.jsx`, `client/src/context/CartProvider.jsx`, `backend/routes/pricing.js`, and pricing tables
- Order bugs: start with `backend/routes/orders.js`, `client/src/pages/Checkout.jsx`, `client/src/pages/Orders.jsx`
- Content/admin issues: start with `client/src/pages/admin/*`, `backend/routes/settings.js`, `backend/routes/services.js`, `backend/routes/metals.js`, `backend/routes/legal.js`
- CAD/unfold issues: start with `backend/server.js`, `backend/main.py`, `backend/unfold.py`, `backend/unfold_lib.py`, and viewer components
- Auth/session issues: start with `backend/routes/auth.js`, `backend/middleware/auth.js`, `client/src/context/AuthContext.jsx`, `client/src/context/AdminAuthContext.jsx`

## 3. Summary

This codebase is a full quoting/order platform with a CAD engine. The center of gravity is `InstantPricing.jsx` + `backend/routes/pricing.js` + `backend/routes/orders.js` + `backend/main.py`. Phase 4 work is calibration against real jobs rather than architectural changes.
