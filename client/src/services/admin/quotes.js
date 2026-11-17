import { adminHttp as http } from '../http';

/* Admin > Quotes (backend/routes/adminQuotes.js). */
export const quotesService = {
    /* -> { data: [...], counts: { all, new, quoted, … }, statuses } */
    list: () => http.getBody('/admin/quotes'),
    /* -> { quote, file, account, events, statuses } */
    detail: (id) => http.get(`/admin/quotes/${id}`),
    setStatus: (id, body) => http.put(`/admin/quotes/${id}/status`, body),
    /* body: { unit_price, quantity, lead_time, message, notify } -> detail + { email } */
    reply: (id, body) => http.post(`/admin/quotes/${id}/reply`, body),
    addNote: (id, text) => http.post(`/admin/quotes/${id}/notes`, { text }),
    deleteNote: (id, eventId) => http.delete(`/admin/quotes/${id}/notes/${eventId}`),
    remove: (id) => http.delete(`/admin/quotes/${id}`),
    downloadFile: (id, fileName) => http.download(`/admin/quotes/${id}/file`, fileName),
};
