import { adminHttp as http } from '../http';

/* Admin > Orders (backend/routes/adminOrders.js; trash on routes/orders.js). */
export const ordersService = {
    list: (view) => http.getBody('/admin/orders', { query: { view: view === 'trash' ? 'trash' : undefined } }),
    detail: (id) => http.get(`/admin/orders/${id}`),
    setStatus: (id, body) => http.put(`/admin/orders/${id}/status`, body),
    email: (id, body) => http.post(`/admin/orders/${id}/email`, body),
    addNote: (id, text) => http.post(`/admin/orders/${id}/notes`, { text }),
    deleteNote: (id, eventId) => http.delete(`/admin/orders/${id}/notes/${eventId}`),
    addShipment: (id, body) => http.post(`/admin/orders/${id}/shipments`, body),
    saveShipment: (id, sid, body) => http.put(`/admin/orders/${id}/shipments/${sid}`, body),
    deleteShipment: (id, sid) => http.delete(`/admin/orders/${id}/shipments/${sid}`),
    addPhotos: (id, form) => http.post(`/admin/orders/${id}/photos`, form),
    savePhoto: (id, pid, body) => http.put(`/admin/orders/${id}/photos/${pid}`, body),
    deletePhoto: (id, pid) => http.delete(`/admin/orders/${id}/photos/${pid}`),
    trash: (id) => http.post(`/orders/${id}/admin-soft-delete`),
    restore: (id) => http.post(`/orders/${id}/admin-restore`),
    destroy: (id) => http.delete(`/orders/${id}`),
    downloadZip: (id) => http.download(`/admin/orders/${id}/files.zip`, `Order-${id}-files.zip`),
};
