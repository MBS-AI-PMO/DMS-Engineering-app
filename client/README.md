# DMS Frontend

This is the React/Vite frontend for the DMS manufacturing quoting platform.

## Current Role

The frontend provides:
- Public marketing/content pages for metals, services, FAQ, guidelines, contact, privacy policy, and terms.
- Instant pricing for CAD uploads, material selection, services, finishes, hardware, cart, checkout, and order history.
- Admin screens for site content, pricing rules, discounts, markups, laser rates, sheet costs, services, metals, customers, orders, email, payment, and settings.

## Stack

- React 19
- React Router 7
- Vite 8
- Bootstrap and custom CSS
- Framer Motion
- Three.js, OCCT import, and online-3d-viewer for CAD previews
- PayPal React SDK

## Key Files

- `src/App.jsx`: route map.
- `src/pages/InstantPricing.jsx`: main quote workflow and project breakdown.
- `src/pages/admin/ServiceEdit.jsx`: service pricing/config admin.
- `src/pages/admin/PricingManagement.jsx`: quantity discounts and global discount switch.
- `src/pages/admin/PricingCalculator.jsx`: markup configuration.
- `src/pages/admin/SheetCostRatesAdmin.jsx`: 4x8 sheet cost admin.
- `src/components/viewer/StepModelViewer.jsx`: STEP preview and hardware placement.
- `src/components/viewer/FlatPatternViewer.jsx`: 2D flat/unfold preview.
- `src/components/viewer/HierarchicalProjectViewer.jsx`: configured model preview.
- `src/utils/api.js`: API client.
- `src/context/AuthContext.jsx`: customer auth.
- `src/context/AdminAuthContext.jsx`: admin auth.
- `src/context/CartProvider.jsx`: cart persistence and repricing.

## Important Routes

Public:
- `/`
- `/metals`
- `/metal/:slug`
- `/services`
- `/service/:slug`
- `/get-instant-pricing`
- `/quote`
- `/faq`
- `/guidelines`
- `/contact`
- `/cart`
- `/checkout`
- `/orders`

Admin:
- `/admin`
- `/admin/metals`
- `/admin/services`
- `/admin/services/:id/metals`
- `/admin/pricing`
- `/admin/pricing-calculator`
- `/admin/laser-rates`
- `/admin/sheet-cost-rates`
- `/admin/faqs`
- `/admin/guidelines`
- `/admin/legal`
- `/admin/orders`
- `/admin/customers`

## Current Quote UI Behavior

The Project Breakdown shows extended line prices and total math:
- Material Cost.
- CNC Machining and configured production services.
- Bending.
- Powder Coating and other finishing services.
- Tapping, hardware, and countersinking when selected.
- Gross Total before discounts.
- Discount Applied when a quantity tier matches.
- Discounted Total as the final customer-facing total.

Hidden helper text has been removed from the breakdown:
- No `parts per 4x8 sheet` helper line under Material Cost.
- No `batch / parts per batch` helper line under Powder Coating.

## Current Styling Notes

- FAQ hero is full-width with centered title, subtitle, and search field.
- FAQ mobile category dropdown is hidden on desktop to avoid duplicate category labels.
- Admin service/metals skeleton loading is constrained so it does not stretch across the page.
- Navbar logo has a fallback path if a stored logo URL breaks.

## Environment

Set one of these as needed:
- `VITE_API_BASE_URL`
- `VITE_API_URL`

The app expects the backend API to be available at the configured base URL or the local default used by `src/utils/api.js`.

## Commands

Install:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

Preview production build:

```bash
npm run preview
```

## Development Cautions

- `src/pages/InstantPricing.jsx` is central and large. Keep quote-flow edits narrow.
- Pricing display depends on backend `breakdown` fields from `backend/routes/pricing.js`.
- Service names are used for markup matching, so renaming services can affect pricing behavior.
- CAD preview behavior depends on uploaded file paths, generated preview paths, and Python worker results.
- Do not assume discounts are always active; the admin global discount switch can disable them.
