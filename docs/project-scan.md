# DMS Project Scan

Last scanned: 2026-04-28
Workspace: `d:\Frontend\DMS`
Worktree state: clean

## 1. What this project is

This repository is a manufacturing quoting platform, not just a marketing site.

Core product areas:
- Public marketing website for services, metals, FAQs, guidelines, legal pages, and contact.
- Instant pricing workflow for CAD uploads with STEP/DXF support.
- Customer auth, cart, checkout, and order history.
- Admin panel for managing metals, services, FAQs, guidelines, legal content, pricing, orders, customers, payment settings, and contact/site settings.
- Backend CAD analysis pipeline that uses Node + Python to detect holes, unfold sheet-metal parts, and generate configured previews.

Business domain inferred from the code:
- Laser cutting
- CNC machining
- Bending / flat pattern handling
- Tapping
- Countersinking
- Hardware insertion
- Finishes such as anodizing, plating, powder coating, tumbling, deburring

## 2. High-level architecture

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

## 3. Frontend scan

Frontend stack:
- React 19
- React Router 7
- Vite 8
- Bootstrap + custom CSS
- Framer Motion
- Three.js + online-3d-viewer + OCCT import
- PayPal React SDK

Important frontend files:
- `client/src/App.jsx`: route map for public pages, auth pages, cart/checkout/orders, and admin pages.
- `client/src/pages/InstantPricing.jsx`: the largest and most important frontend feature file; drives upload, analysis, service selection, pricing, hardware/finish options, and cart handoff.
- `client/src/utils/api.js`: central API client for nearly all server calls.
- `client/src/context/AuthContext.jsx`: customer auth state.
- `client/src/context/AdminAuthContext.jsx`: admin auth state.
- `client/src/context/CartProvider.jsx`: local cart persistence and quantity repricing.

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
- Auth uses cookie-backed API sessions via `credentials: 'include'`.
- Cart persists in `localStorage` key `dms_cart`.
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

## 4. Backend scan

Backend stack:
- Express 5
- PostgreSQL via `pg`
- JWT auth in cookies
- Multer uploads
- Sharp image optimization
- Python subprocess / HTTP worker integration for CAD tasks

Main backend entrypoints:
- `backend/server.js`: Express app, route mounting, upload endpoints, CAD bridge endpoints, basic schema bootstrapping.
- `backend/db.js`: PostgreSQL pool setup from env vars.
- `backend/main.py`: Python HTTP server for unfold and hole-detection jobs.

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
- JWT secret comes from `JWT_SECRET` with an insecure fallback default in code.
- Middleware checks `token`, then `admin_token`, then bearer auth.
- Admin routes use `requireAdmin`, which retries with `admin_token` if needed.
- Customer and admin auth are maintained separately in the frontend.

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

## 5. CAD and pricing pipeline

This is the most specialized part of the codebase.

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

## 6. Data model scan

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
- `metals` stores many rich content sections in JSONB.
- `order_items.configuration_json` stores serialized quote/order configuration.
- `site_settings` is a generic key/value JSONB table.
- pricing relies on multiple tables:
  - `pricing_rules`
  - `quantity_discounts`
  - `laser_cut_rates`
  - `sheet_cost_rates`
- service/metal eligibility is driven by assignment/config tables rather than hardcoded logic alone.

## 7. Environment and runtime expectations

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
- PostgreSQL must be available for backend startup to be fully useful.
- Python CAD service is expected locally and is part of backend dev workflow.
- The backend `dev` script hardcodes a Windows Conda Python path.

## 8. Verification snapshot

Checks run during scan:
- frontend `npm.cmd run build`
- frontend `npm.cmd run lint`
- backend syntax check: `node --check`
- python syntax check: `python -m py_compile`

Results:
- Frontend build did not complete in this environment because Vite config loading hit a sandbox/process permission error: `spawn EPERM`.
- Frontend lint is currently failing.
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
- Minified vendor file `client/public/ov-libs-v1/three.min.js` is being linted and creates many errors.
- Several unused imports/variables exist in app source files.
- React hook rule violations exist in `client/src/components/QuoteFlow.jsx`.
- Fast-refresh rule violations exist in the auth/toast context files.
- `client/src/data/reindex.js` uses `require` under a config that expects ESM/browser globals.

## 9. Risks and likely future friction

High-probability friction areas:
- `InstantPricing.jsx` is very large and likely difficult to change safely without targeted refactoring.
- Pricing logic is distributed across frontend payload assembly, backend route calculation, DB rate tables, and Python/CAD-derived geometry.
- Upload/temp/permanent file path handling is critical and spread across several places.
- Backend startup does schema mutation in `server.js`, which can blur boot/runtime responsibilities.
- Hardcoded Windows Python path in backend dev script reduces portability.
- JWT secret fallback and other fallback secrets should be treated as production risk if still in use.
- Lint noise from vendored/minified assets will hide real issues until excluded.

Performance / repo health observations:
- Large image assets are present directly in `client/src/assets`, including many multi-megabyte files.
- Scratch/debug files exist in `backend/scratch/`.
- The repo includes both generated/static assets and application code, so tooling may be noisier/slower than necessary.

## 10. Good starting points for future work

If we work on:
- Pricing bugs: start with `client/src/pages/InstantPricing.jsx`, `client/src/context/CartProvider.jsx`, `backend/routes/pricing.js`, and pricing tables.
- Order bugs: start with `backend/routes/orders.js`, `client/src/pages/Checkout.jsx`, `client/src/pages/Orders.jsx`.
- Content/admin issues: start with `client/src/pages/admin/*`, `backend/routes/settings.js`, `backend/routes/services.js`, `backend/routes/metals.js`, `backend/routes/legal.js`.
- CAD/unfold issues: start with `backend/server.js`, `backend/main.py`, `backend/unfold.py`, `backend/unfold_lib.py`, and viewer components.
- Auth/session issues: start with `backend/routes/auth.js`, `backend/middleware/auth.js`, `client/src/context/AuthContext.jsx`, `client/src/context/AdminAuthContext.jsx`.

## 11. Summary

This codebase is a custom manufacturing web app with a serious amount of business logic already embedded in it. The highest-value areas for careful work are instant pricing, CAD processing, order persistence, and admin-managed pricing/configuration.

The most important stored takeaway:
- treat this as a full quoting/order platform with a CAD engine, not as a simple frontend site
- the center of gravity is `InstantPricing.jsx` + `backend/routes/pricing.js` + `backend/routes/orders.js` + `backend/main.py`
