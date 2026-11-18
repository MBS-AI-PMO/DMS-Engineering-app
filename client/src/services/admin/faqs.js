import { adminHttp as http } from '../http';
import { clearPageFaqsCache } from '../pageFaqs';

/* Admin > FAQs and FAQ categories (backend/routes/faqs.js). The category
 * list is the public endpoint the FAQ page reads; writes go to /faqs/admin/*. */

/* Any change may move FAQs on the public pages this tab already loaded. */
const fresh = (promise) => promise.finally(clearPageFaqsCache);

export const faqsService = {
    /* Every FAQ (as the FAQ page reads them) plus `pages`: the page keys it shows on. */
    list: () => http.get('/faqs/admin'),
    /* body may include `pages` (page keys); the saved row then has `pages` too. */
    create: (body) => fresh(http.post('/faqs/admin', body)),
    update: (id, body) => fresh(http.put(`/faqs/admin/${id}`, body)),
    remove: (id) => fresh(http.delete(`/faqs/admin/${id}`)),
    /* ids in their new order (one category); positions become 1..n. */
    reorder: (ids) => http.put('/faqs/admin/order', { ids }),
    /* -> { id, pages } */
    setPages: (id, pages) => fresh(http.put(`/faqs/admin/${id}/pages`, { pages })),
};

/* Which FAQs show on which page of the public site (besides the FAQ page). */
export const faqPagesService = {
    /* [{ key, label, group: main|metal|service|other, wildcard?, hidden?, missing?, faq_count }] */
    list: () => http.get('/faqs/admin/pages'),
    /* The FAQs placed on one page key, in order. */
    faqsOn: (key) => http.get('/faqs/admin/page', { query: { key } }),
    /* Exactly these FAQs on that page, in this order -> the new list. */
    setFaqs: (key, faqIds) => fresh(http.put('/faqs/admin/page', { key, faq_ids: faqIds })),
};

export const faqCategoriesService = {
    list: () => http.get('/faqs/categories'),
    create: (body) => http.post('/faqs/admin/categories', body),
    update: (id, body) => http.put(`/faqs/admin/categories/${id}`, body),
    remove: (id) => http.delete(`/faqs/admin/categories/${id}`),
    /* ids in their new order; positions become 0..n-1. */
    reorder: (ids) => http.put('/faqs/admin/categories/order', { ids }),
};
