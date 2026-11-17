import { adminHttp as http } from '../http';

/* Admin > Categories: metal categories (backend/routes/categories.js). */
export const categoriesService = {
    /* Each with metal_count. */
    list: () => http.get('/categories'),
    create: (category) => http.post('/categories/admin', category),
    update: (id, category) => http.put(`/categories/admin/${id}`, category),
    remove: (id) => http.delete(`/categories/admin/${id}`),
};
