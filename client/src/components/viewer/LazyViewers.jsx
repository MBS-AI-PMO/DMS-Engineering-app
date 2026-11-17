import React, { lazy, Suspense } from 'react';

/**
 * The CAD viewers for the instant pricing page, loaded on demand. They pull
 * in three.js and online-3d-viewer (about 400 KB compressed), which the page
 * does not need to show itself; with these wrappers it paints first and the
 * viewers follow. They are fetched in the background as soon as the browser
 * is idle, so they are normally ready before a file is dropped.
 */

const loadStep = () => import('./StepModelViewer');
const loadDxf = () => import('./DxfModelViewer');
const loadFlat = () => import('./CadFlatPatternViewer');

const StepModelViewerLazy = lazy(loadStep);
const DxfModelViewerLazy = lazy(loadDxf);
const CadFlatPatternViewerLazy = lazy(loadFlat);

const ViewerLoading = () => (
    <div className="cad-viewer-empty ipw-pending" role="status" aria-live="polite">
        <div>
            <span className="ipw-spinner" aria-hidden="true" />
            <p>Loading the viewer…</p>
        </div>
    </div>
);

export const StepModelViewer = (props) => (
    <Suspense fallback={<ViewerLoading />}><StepModelViewerLazy {...props} /></Suspense>
);
export const DxfModelViewer = (props) => (
    <Suspense fallback={<ViewerLoading />}><DxfModelViewerLazy {...props} /></Suspense>
);
export const CadFlatPatternViewer = (props) => (
    <Suspense fallback={<ViewerLoading />}><CadFlatPatternViewerLazy {...props} /></Suspense>
);

let preloaded = false;
function preloadViewers() {
    if (preloaded) return;
    preloaded = true;
    Promise.all([loadStep(), loadDxf(), loadFlat()]).catch(() => { preloaded = false; });
}

// Start fetching once the page has loaded and the browser has a quiet moment.
if (typeof window !== 'undefined') {
    const whenIdle = () => (window.requestIdleCallback
        ? window.requestIdleCallback(preloadViewers, { timeout: 4000 })
        : window.setTimeout(preloadViewers, 1500));
    if (document.readyState === 'complete') whenIdle();
    else window.addEventListener('load', whenIdle, { once: true });
}
