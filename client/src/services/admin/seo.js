import { adminHttp as http } from '../http';

/* Admin > SEO & tracking: the page <head> preview (backend/routes/seo.js).
 * The settings themselves (seo_meta, tracking_pixels, head_tags) are saved
 * through siteSettingsService. */
export const seoService = {
    /*
     * The <head> the server would send for path, built from the values given
     * (unsaved form state). path may be '/metal/*', '/service/*' or '/blog/*'
     * (an example page of that kind).
     * -> { path, title, tags: [{ tag, attrs, content?, source: 'site' | 'yours' }], html, replaced: [html] }
     */
    previewHead: ({ path, seoMeta, headTags }, opts) => http.post('/seo/admin/head-preview', {
        path,
        seo_meta: seoMeta,
        head_tags: headTags,
        origin: window.location.origin,
    }, opts),
};
