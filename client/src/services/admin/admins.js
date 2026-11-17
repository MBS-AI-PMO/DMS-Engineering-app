import { adminHttp as http } from '../http';

/* Admin > Admins (backend/routes/users.js, /users/admin). Each call returns the row. */
export const adminsService = {
    list: () => http.get('/users/admin'),
    create: (body) => http.post('/users/admin', body),
    update: (id, body) => http.put(`/users/admin/${id}`, body),
    remove: (id) => http.delete(`/users/admin/${id}`),
};
