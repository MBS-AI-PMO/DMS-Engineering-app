import { adminHttp as http, toFormData } from '../http';

/* Admin > Metals (backend/routes/metals.js). Metals are addressed by slug or id. */
export const metalsService = {
    list: () => http.get('/metals'),
    get: (slugOrId) => http.get(`/metals/${encodeURIComponent(slugOrId)}`),
    create: (metal) => http.post('/metals/admin', metal),
    update: (slugOrId, metal) => http.put(`/metals/admin/${encodeURIComponent(slugOrId)}`, metal),
    remove: (slugOrId) => http.delete(`/metals/admin/${encodeURIComponent(slugOrId)}`),
    /* -> "/uploads/metals/….webp" */
    uploadImage: (file) => http.post('/metals/admin/upload-image', toFormData({ image: file })).then(d => d.image_path),
};
