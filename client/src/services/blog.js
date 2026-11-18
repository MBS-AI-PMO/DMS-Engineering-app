import { http } from './http';

/*
 * The public blog (backend/routes/blog.js): live posts only.
 */
export const blogApi = {
    /* params: { page, per_page, q, category, tag, featured }
     * -> { data: [post], page, per_page, total, pages, featured, categories, tags } */
    list: (params = {}, { signal } = {}) => http.getBody('/blog', { query: params, signal }),
    /* -> { data: post, related: [post] } or { data: null, redirect: slug } (an old URL) */
    get: (slug, { signal } = {}) => http.getBody(`/blog/${encodeURIComponent(slug)}`, { signal }),
};
