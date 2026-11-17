import { adminHttp as http } from '../http';

/* Admin > Customers (backend/routes/users.js). Orders come from ordersService. */
export const customersService = {
    list: () => http.get('/users/customers'),
};
