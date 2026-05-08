# DMS Project Handoff

Last updated: 2026-05-08
Workspace: `D:\Frontend\DMS`

## Purpose

This document describes the current position of the DMS manufacturing quoting site after the latest pricing, viewer, FAQ, and admin updates. It is meant to be the first reference for future work on the app.

## Current Product Shape

DMS is a manufacturing quote, checkout, and admin platform. It is not only a marketing site.

Core areas:
- Public site for metals, services, guidelines, FAQ, contact, privacy policy, and terms.
- Instant pricing workflow for CAD uploads, material selection, production services, add-on services, hardware, finish color, cart, checkout, and order history.
- Admin panel for metals, categories, FAQs, services, pricing rules, discounts, markups, laser rates, sheet costs, guidelines, legal content, orders, customers, email, payment methods, and site/contact settings.
- Backend CAD pipeline for STEP/DXF analysis, sheet-metal unfold, hole detection, configured previews, and pricing payload calculation.

Important public routes:
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

Important admin routes:
- `/admin`
- `/admin/metals`
- `/admin/categories`
- `/admin/faqs`
- `/admin/faq-categories`
- `/admin/services`
- `/admin/services/:id/metals`
- `/admin/pricing`
- `/admin/pricing-calculator`
- `/admin/laser-rates`
- `/admin/sheet-cost-rates`
- `/admin/guidelines`
- `/admin/legal`
- `/admin/orders`
- `/admin/customers`
- `/admin/email`
- `/admin/payment`
- `/admin/subscribers`
- `/admin/contact`
- `/admin/admins`

## Architecture

Top-level structure:
- `client/`: Vite + React frontend.
- `backend/`: Express API, PostgreSQL access, upload handling, and Python CAD worker integration.
- `docs/`: project handoff and implementation notes.
- `db_backup.sql`: database backup present in the repository root.

Runtime flow:
1. React frontend calls `/api/...`.
2. Express handles auth, uploads, database reads/writes, pricing, orders, and asset serving.
3. Python CAD worker handles STEP analysis, unfold jobs, hole detection, and preview geometry work.
4. PostgreSQL stores content, configuration, pricing tables, users, orders, hardware, discounts, and site settings.
5. Uploaded/generated files live under backend `uploads/` and `temp_uploads/`.

Key frontend files:
- `client/src/App.jsx`
- `client/src/pages/InstantPricing.jsx`
- `client/src/pages/admin/ServiceEdit.jsx`
- `client/src/pages/admin/PricingManagement.jsx`
- `client/src/pages/admin/SheetCostRatesAdmin.jsx`
- `client/src/components/viewer/StepModelViewer.jsx`
- `client/src/components/viewer/FlatPatternViewer.jsx`
- `client/src/components/viewer/HierarchicalProjectViewer.jsx`
- `client/src/utils/api.js`

Key backend files:
- `backend/server.js`
- `backend/routes/pricing.js`
- `backend/routes/orders.js`
- `backend/main.py`
- `backend/unfold.py`
- `backend/unfold_lib.py`
- `backend/process_configured.py`

## Current Pricing Position

The main pricing contract is `POST /api/pricing/calculate` in `backend/routes/pricing.js`.

Current total model:
1. Calculate unit material cost.
2. Calculate unit production cost.
3. Calculate unit add-on service costs.
4. Apply configured material/labor markups to the selected cost families.
5. Multiply the marked-up unit subtotal by quantity.
6. Apply the matched quantity discount globally to the gross total.
7. Return `subtotal_before_discount`, `discount_amount`, `total_price`, `final_unit_price`, and display breakdown data.

### Material Sheet Cost

Material cost uses only the standard 4x8 sheet.

Current behavior:
- Sheet size is `96 x 48 in`.
- The engine checks horizontal and vertical part orientation.
- The orientation with the most parts per sheet wins.
- Ties choose the lower unit material cost.
- Unit material cost is `sheet_cost_4x8 / best_parts_per_sheet`.
- Edge buffer, part buffer, and kerf width are configurable from service pricing config, with current defaults of `0.15`, `0.15`, and `0.005`.
- Public quote breakdown no longer shows the helper text like `10 parts per 4x8 sheet`; it only shows the Material Cost line.

Admin source:
- `client/src/pages/admin/SheetCostRatesAdmin.jsx`
- `sheet_cost_rates`

Backend output:
- `breakdown.material_cost`
- `breakdown.material_cost_with_markup`
- `breakdown.material_nesting`

### CNC Machining

CNC remains a configurable five-operation model.

Operations:
- `saw`
- `lathe`
- `mill`
- `deburr`
- `inspect`

Current behavior:
- Each operation has setup, runtime, rate, and display unit fields.
- Setup/runtime units can be hours, minutes, or seconds.
- CNC cost is calculated as a per-part unit cost from the configured operations.
- The global pricing model multiplies CNC unit cost by quantity, so CNC increases correctly when quantity increases.

Key files:
- `backend/routes/pricing.js`
- `client/src/pages/admin/ServiceEdit.jsx`

### Bending

Current behavior:
- Bending eligibility is checked against metal/service support and selected thickness support.
- Unsupported bending is removed/blocked and returns warnings instead of charging.
- Bending cost uses the configured setup/runtime/rate structure.
- The current approved behavior is setup labor plus quantity-scaled bend/runtime cost.
- The Project Breakdown row shows the real extended price after quantity and markup, while discounts apply later to the total.

Key files:
- `backend/routes/pricing.js`
- `client/src/pages/InstantPricing.jsx`
- `client/src/pages/admin/ServiceEdit.jsx`

### Powder Coating

Powder coating is independent of sheet nesting. It is treated as a configured service cost in the quote breakdown, not as a material-sheet coating optimization.

Current behavior:
- Admin supports oven width/length, dimension unit, setup time, setup time unit, shop rate, batch cost, part gap, and rack clearance.
- The backend still computes batch capacity metadata using two orientations for reference.
- Approved visible pricing behavior is service unit cost multiplied by quantity by the global quote math.
- The Project Breakdown no longer shows the helper line like `1 batch / 15 parts per batch`.

Key files:
- `backend/routes/pricing.js`
- `client/src/pages/InstantPricing.jsx`
- `client/src/pages/admin/ServiceEdit.jsx`

### Tapping, Hardware, And Countersinking

Current behavior:
- Tapping, hardware, and countersinking are selected from detected holes and configured admin options.
- Their manual/selected prices are summarized into the service breakdown.
- Hardware placement in the 3D viewer uses detected hole depth/face placement so inserted hardware touches the model more reliably instead of floating above or below it.

Key files:
- `client/src/pages/InstantPricing.jsx`
- `client/src/components/viewer/StepModelViewer.jsx`
- `client/src/components/viewer/HierarchicalProjectViewer.jsx`
- `backend/process_configured.py`

### Markups

Current behavior:
- Markup settings are stored in `site_settings`.
- Supported settings include `general_markup`, `inside_labor_markup`, `material_markup`, `overhead_markup`, and `markup_enabled_services`.
- Material markup applies to material.
- Labor/overhead/general markup applies only to services selected in `markup_enabled_services`.
- The quote breakdown shows service rows after markup so the customer sees real line prices.

Admin source:
- `/admin/pricing-calculator`
- `client/src/pages/admin/PricingCalculator.jsx`

### Quantity Discounts

Current behavior:
- Discounts are configured in `/admin/pricing`.
- The admin page has a global on/off switch for all discounts.
- Public `/api/pricing/discounts` returns no discount tiers when `discounts_enabled` is false.
- Quote calculation also respects `discounts_enabled`.
- Discounts apply globally after the gross total is formed, not individually per service.
- The quote UI shows Gross Total, Discount Applied, and Discounted Total when a discount is active.

Example:
- Bending extended price: `$100`
- Material extended price: `$100`
- Gross total: `$200`
- Discount applies to `$200`

Key files:
- `backend/routes/pricing.js`
- `client/src/pages/InstantPricing.jsx`
- `client/src/pages/admin/PricingManagement.jsx`

## Instant Pricing UI

Current visible behavior:
- Project Breakdown shows real extended prices per row.
- Material, CNC, bending, powder coating, tapping, hardware, and countersinking rows are displayed when present.
- Gross Total is shown before discounts.
- Discount Applied is shown as a separate negative row.
- Discounted Total is shown as the final customer-facing total.
- Removed helper notes under Material Cost and Powder Coating.
- Loading skeletons in admin service/metals configuration have been tightened so they do not stretch awkwardly across the page.

Important implementation note:
- `InstantPricing.jsx` is large and central. Keep future edits narrow and verify both the frontend display and backend breakdown payload before changing formulas.

## FAQ Page Position

Current behavior:
- The FAQ hero uses a full-width background image.
- Hero content is centered.
- The duplicate desktop `Categories` label was removed by hiding the mobile category header on desktop.
- The FAQ content section is separated below the hero with a light background.
- Logo fallback now removes a broken stored logo and falls back to `/logo.webp`.

Key files:
- `client/src/pages/FAQPage.jsx`
- `client/src/components/Navbar.jsx`
- `client/src/index.css`

## CAD And Viewer Position

Current capabilities:
- STEP/STP and DXF upload workflows.
- STEP model viewing with online-3d-viewer/OCCT/Three.js stack.
- 2D flat/unfold view for sheet-metal parts.
- Hole detection for tapping, hardware, and countersinking selection.
- Configured preview generation after selected operations.
- Hardware placement accounts for detected hole face/depth so components sit on the model surface.

Unfold notes:
- `backend/unfold_lib.py` contains sheet-metal root/flat-pattern logic.
- `backend/main.py` owns Python worker endpoints, job state, cache, and analysis versioning.
- If unfold behavior changes, bump `UNFOLD_ANALYSIS_VERSION` or otherwise invalidate stale analysis cache.

## Admin Position

Main admin areas:
- Metals and metal categories.
- Services and per-service configuration.
- Service-to-metal/thickness availability.
- Discounts with global enable/disable.
- Markups.
- Laser rates.
- Sheet cost rates for 4x8 sheets.
- FAQ and FAQ categories.
- Guidelines and legal content.
- Orders, customers, admins, email, contact/site settings, subscribers, and payment methods.

Service edit now covers:
- General service fields and production toggle.
- Powder coating units and batch fields.
- Bending thresholds, setup/runtime unit display, and rate configuration.
- CNC five-operation setup/runtime/rate configuration.
- Tap and countersink option configuration.
- Hardware type/item configuration with active status and dimensional fields.

## Data Tables To Know

Core tables:
- `users`
- `metal_categories`
- `metals`
- `metal_configs`
- `services`
- `service_configs`
- `service_metal_assignments`
- `faq_categories`
- `faqs`
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

Pricing tables/settings:
- `sheet_cost_rates`: 4x8 material sheet pricing by family/thickness.
- `laser_cut_rates`: material/thickness cut and pierce rates.
- `quantity_discounts`: quantity tiers and percentages.
- `site_settings.discounts_enabled`: global discount switch.
- `site_settings.markup_enabled_services`: service names that receive labor/overhead/general markup.

## Environment

Frontend env vars:
- `VITE_API_BASE_URL`
- `VITE_API_URL`

Backend env vars:
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

Python/CAD env vars:
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

## Local Commands

Frontend:
- `cd client`
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run lint`

Backend:
- `cd backend`
- `npm install`
- `npm run dev`
- `npm run dev:node`
- `npm run dev:python`
- `npm run migrate`
- `npm run create:admin`

Note:
- The backend `dev` and `dev:python` scripts currently reference a Windows Conda Python path. Update those scripts or `PYTHON_PATH` if the environment changes.

## Verification Snapshot

Latest doc refresh did not run a build because the user requested not to build.

Recent lightweight verification used during this session:
- `git diff --check` passed for touched frontend files.
- Earlier targeted syntax/lint checks were used for pricing/viewer files when needed.

Known historical issue:
- Full frontend build has previously hit `spawn EPERM` in this sandboxed environment. Treat that as an environment/process limitation until confirmed outside the sandbox.

## Current Risks And Friction

High-risk files:
- `client/src/pages/InstantPricing.jsx`
- `backend/routes/pricing.js`
- `client/src/pages/admin/ServiceEdit.jsx`
- `backend/main.py`
- `backend/unfold_lib.py`

Known friction:
- Pricing behavior spans frontend payload assembly, backend calculation, database settings, and CAD-derived geometry.
- `InstantPricing.jsx` is very large and should be changed carefully.
- Some pricing comments in code may lag behind business-approved behavior after calibration changes; prefer the actual calculation and this doc over stale comments.
- Backend startup and schema/runtime responsibilities are mixed in places.
- The development Python path is machine-specific.
- Vendored/minified frontend assets can create noisy lint output if not excluded.

## Recommended Next Work

Best next improvements:
- Add focused tests or fixtures for material nesting, discounts, CNC quantity scaling, bending, and powder coating.
- Persist pricing snapshots on quote/order creation so future Paperless Parts comparisons have exact historical inputs.
- Split `InstantPricing.jsx` into smaller quote-flow, viewer, service-selection, and breakdown components.
- Add admin-facing pricing preview examples for common quantities.
- Review stale inline comments in `backend/routes/pricing.js` after final pricing calibration.

## Summary

The current system is a CAD-aware quoting and order platform. The active center of gravity is still `InstantPricing.jsx`, `backend/routes/pricing.js`, `ServiceEdit.jsx`, the viewer components, and the CAD Python worker. The current business-critical behavior is 4x8-only material nesting, quantity-scaled CNC/services, global post-subtotal discounts, visible gross/discounted totals, and Paperless Parts-style pricing presentation.
