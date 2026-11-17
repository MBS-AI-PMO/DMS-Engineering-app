import { adminHttp as http, toFormData } from '../http';

/*
 * Admin > Services: the catalog of services (backend/routes/services.js) and
 * the hardware catalog edited from the Hardware service (routes/hardware.js).
 * Pricing is not here: it lives in Admin > Costing.
 */
export const servicesService = {
    /* Every service, hidden ones too, with parent_ids. */
    list: () => http.get('/services', { query: { includeInactive: 'true' } }),
    /* Same, plus metal_count. */
    listWithUsage: () => http.get('/services/usage', { query: { includeInactive: 'true' } }),
    create: (service) => http.post('/services/admin', service),
    update: (id, service) => http.put(`/services/admin/${id}`, service),
    setActive: (id, isActive) => http.patch(`/services/admin/${id}/status`, { is_active: isActive }),
    remove: (id) => http.delete(`/services/admin/${id}`),
    /* -> "/uploads/services/….webp" */
    uploadImage: (file) => http.post('/services/admin/upload', toFormData({ image: file })).then(d => d.path),
    /* assignments: [{ id: metalId, assigned, thicknesses: [value, …] }] */
    saveMetalAssignments: (id, assignments) => http.put(`/services/admin/${id}/metals`, { assignments }),
};

export const hardwareService = {
    /* Each type with item_count. */
    types: () => http.get('/hardware/types'),
    items: (typeId) => http.get(`/hardware/types/${typeId}/items`),
    /* -> "/uploads/hardware/….webp" */
    uploadTypeImage: (typeId, file) => http.post(`/hardware/admin/types/${typeId}/image`, toFormData({ image: file })).then(d => d.path),
    createItem: (item) => http.post('/hardware/admin/items', item),
    updateItem: (id, item) => http.put(`/hardware/admin/items/${id}`, item),
    deleteItem: (id) => http.delete(`/hardware/admin/items/${id}`),
};
