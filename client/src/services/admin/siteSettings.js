import { adminHttp as http, toFormData } from '../http';

/* Site settings (backend/routes/settings.js): one JSON value per key.
 * Used by Admin > Contact and Admin > SEO & Tracking. */
export const siteSettingsService = {
    /* Every public key as { key: value }. */
    all: () => http.get('/settings'),
    /* Admin-only keys (contact_form_recipients, payment secrets). */
    private: () => http.get('/settings/admin/private'),
    /* Saves one key; resolves to the value as stored (some keys are cleaned by the server). */
    save: (key, value) => http.put(`/settings/${encodeURIComponent(key)}`, { value }),
    /* Uploads an image (optimised by the server) and saves its path under key; resolves to that value. */
    uploadImage: (key, file) => http.post('/settings/upload-logo', toFormData({ logo: file, key })),
    /* Metals, for the footer's "top metals" picker. */
    metals: () => http.get('/metals'),
};
