import { adminHttp as http } from '../http';

/* Admin > FAQs and FAQ categories (backend/routes/faqs.js). The lists are
 * the public endpoints the FAQ page reads; writes go to /faqs/admin/*. */
export const faqsService = {
    list: () => http.get('/faqs'),
    create: (body) => http.post('/faqs/admin', body),
    update: (id, body) => http.put(`/faqs/admin/${id}`, body),
    remove: (id) => http.delete(`/faqs/admin/${id}`),
    /* ids in their new order (one category); positions become 1..n. */
    reorder: (ids) => http.put('/faqs/admin/order', { ids }),
};

export const faqCategoriesService = {
    list: () => http.get('/faqs/categories'),
    create: (body) => http.post('/faqs/admin/categories', body),
    update: (id, body) => http.put(`/faqs/admin/categories/${id}`, body),
    remove: (id) => http.delete(`/faqs/admin/categories/${id}`),
    /* ids in their new order; positions become 0..n-1. */
    reorder: (ids) => http.put('/faqs/admin/categories/order', { ids }),
};
