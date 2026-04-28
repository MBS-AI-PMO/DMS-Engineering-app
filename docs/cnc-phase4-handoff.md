# CNC Phase 4 Handoff

Last updated: 2026-04-28
Workspace: `D:\Frontend\DMS`

## Current CNC State

Completed phases:
- Phase 1: configurable 5-operation CNC engine
- Phase 2: smart admin-configurable rules engine
- Phase 3: STEP topology-driven CNC feature extraction

The CNC quote flow now supports:
- Operations: `Saw`, `Lathe`, `Mill`, `Deburr`, `Inspect`
- Modes: `manual` and `smart`
- Admin-controlled enable rules, runtime factors, setup multipliers, setup-count rules, and risk surcharges
- Quote warnings, setup context, risk breakdown, and per-operation breakdown in the UI

## Key Files

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

## Current CAD-Derived CNC Signals

The STEP analysis now returns `cncFeatures` with:
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

These are now fed into:
- smart operation enable rules
- smart runtime calculation
- smart setup count floor logic
- smart risk/warning logic

## What Phase 4 Means

Phase 4 is calibration, not architecture.

Goal:
- tune the CNC engine against real jobs so quotes match shop reality

Main calibration targets:
- setup-count rules
- per-operation runtime factors
- shop rates
- risk surcharge thresholds
- warning thresholds
- lathe vs mill activation rules

## Recommended Phase 4 Work Order

1. Build a calibration dataset from real quotes/orders
- part id / file
- material
- quantity
- detected CNC metrics
- operation breakdown
- quoted unit price
- actual or expected shop cost

2. Add a calibration snapshot to each quote/order
- save the exact pricing inputs and derived CNC metrics
- save the exact operation breakdown used at quote time
- make later comparison possible even if admin settings change

3. Add admin visibility for calibration
- inspect quote inputs
- inspect CNC metrics
- inspect operation/risk/setup breakdown
- compare quoted vs target/actual

4. Tune coefficients iteratively
- adjust one rule family at a time
- validate on a batch of representative jobs

## Practical Next Step

Best next implementation:
- persist a CNC calibration snapshot with orders/quotes so every real job becomes tuning data

That snapshot should include:
- `pricingTechnicalData`
- returned `cnc_derived_metrics`
- returned `cnc_setup_context`
- returned `cnc_risk_breakdown`
- returned `cnc_operation_breakdown`
- final unit/total price

## Known Boundary

The system is now a strong topology-aware quoting engine, but it is still not a CAM simulator.
It does not generate real toolpaths, actual cycle time, or machine-specific tool strategy.
