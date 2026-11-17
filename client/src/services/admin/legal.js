import { adminHttp as http } from '../http';

/* Admin > Terms & Policy (backend/routes/legal.js). type: 'privacy' | 'terms'. */
export const legalService = {
    list: (type) => http.get(`/legal/admin/${type}`),
    /* Creates when section.id is empty, updates otherwise. */
    save: (section) => http.post('/legal/admin', section),
    remove: (id) => http.delete(`/legal/admin/${id}`),
};
