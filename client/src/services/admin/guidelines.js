import { adminHttp as http } from '../http';

/* Admin > Guidelines (backend/routes/guidelines.js). One guidelines record
 * per service; saving creates or replaces it. */
export const guidelinesService = {
    list: () => http.get('/guidelines'),
    /* null when the service has no guidelines yet. */
    get: (serviceId) => http.get(`/guidelines/${serviceId}`).catch((err) => {
        if (err.status === 404) return null;
        throw err;
    }),
    save: (body) => http.post('/guidelines/admin', body),
    /* Every service (hidden ones too), to offer guidelines for the ones without. */
    services: () => http.get('/services', { query: { includeInactive: 'true' } }),
};
