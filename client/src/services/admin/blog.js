import { adminHttp as http, toFormData } from '../http';

/*
 * Admin > Blog (backend/routes/adminBlog.js). Posts are saved with the
 * editor's JSON document; `version` (from the last load or save) makes a
 * save fail with status 409 instead of overwriting a newer change.
 *
 * Post fields: title, slug, excerpt, cover_image, cover_alt, content,
 * category, tags, author_name, seo_title, seo_description, og_image.
 */
export const blogService = {
    /* -> { data: [post], counts: { all, draft, scheduled, published } } */
    list: () => http.getBody('/admin/blog'),
    /* -> { categories: [{ name, count }], tags: [{ name, count }], authors: [name], me } */
    topics: () => http.get('/admin/blog/topics'),
    /* -> { slug, available, suggestion } */
    checkSlug: (slug, id) => http.get('/admin/blog/slug-check', { query: { slug, id } }),
    get: (id) => http.get(`/admin/blog/${id}`),
    create: (fields = {}) => http.post('/admin/blog', fields),
    /* -> the whole answer: { data: post, dropped? } (dropped: unsafe links/pictures removed) */
    save: (id, fields) => http.putBody(`/admin/blog/${id}`, fields),
    publish: (id, fields = {}) => http.postBody(`/admin/blog/${id}/publish`, fields),
    schedule: (id, publishedAt, fields = {}) => http.postBody(`/admin/blog/${id}/schedule`, { ...fields, published_at: publishedAt }),
    unpublish: (id, fields = {}) => http.postBody(`/admin/blog/${id}/unpublish`, fields),
    duplicate: (id) => http.post(`/admin/blog/${id}/duplicate`),
    remove: (id) => http.delete(`/admin/blog/${id}`),
    /* A cover or a picture for the text -> { url, path, width, height } */
    uploadImage: (file) => http.post('/admin/blog/images', toFormData({ image: file })),
};
