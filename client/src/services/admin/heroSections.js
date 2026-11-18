import { adminHttp as http, toFormData } from '../http';

/* Admin > Hero Sections: the picture at the top of each public page (backend/routes/heroSections.js). */
export const heroSectionsService = {
    /* Every service: { service_id, title, slug, display_order, hero_image, updated_at } */
    list: () => http.get('/hero-sections/admin'),
    /* { pages: [{ key, label, path, size: [w, h], phone: [w, h], position, note?, image, updated_at }], service: { size, phone, position } } */
    pages: () => http.get('/hero-sections/admin/pages'),
    /* -> { avif, webp, jpg, src } to pass to save() / savePage(key, src) */
    upload: (file) => http.post('/hero-sections/admin/upload', toFormData({ image: file })),
    save: (serviceId, heroImage) => http.put(`/hero-sections/admin/${serviceId}`, { hero_image: heroImage }),
    remove: (serviceId) => http.delete(`/hero-sections/admin/${serviceId}`),
    savePage: (key, image) => http.put(`/hero-sections/admin/pages/${encodeURIComponent(key)}`, { image }),
    removePage: (key) => http.delete(`/hero-sections/admin/pages/${encodeURIComponent(key)}`),
};
