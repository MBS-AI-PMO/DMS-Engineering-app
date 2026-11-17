import { adminHttp as http } from '../http';

/* Admin > Subscribers (backend/routes/newsletter.js). */
export const subscribersService = {
    list: () => http.get('/newsletter/subscribers'),
    remove: (id) => http.delete(`/newsletter/subscribers/${id}`),
};
