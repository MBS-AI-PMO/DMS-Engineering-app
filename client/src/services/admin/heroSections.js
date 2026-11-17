import { adminHttp as http, toFormData } from '../http';

/* Admin > Hero Sections: the picture at the top of each service page (backend/routes/heroSections.js). */
export const heroSectionsService = {
    /* Every service: { service_id, title, slug, display_order, hero_image, updated_at } */
    list: () => http.get('/hero-sections/admin'),
    /* -> { avif, webp, jpg, src } to pass to save() */
    upload: (file) => http.post('/hero-sections/admin/upload', toFormData({ image: file })),
    save: (serviceId, heroImage) => http.put(`/hero-sections/admin/${serviceId}`, { hero_image: heroImage }),
    remove: (serviceId) => http.delete(`/hero-sections/admin/${serviceId}`),
};
