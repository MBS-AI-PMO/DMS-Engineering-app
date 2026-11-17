import { http } from './http';

/*
 * Quote requests from customers (backend/routes/quoteRequests.js): parts the
 * site could not price instantly, sent to the shop with the uploaded file.
 */
export const quoteRequestsService = {
    /* body: { name, email, phone, company, quantity, message, file_ref, file_name,
     *         configuration, pricing_input, reasons, source }
     * -> { id, reference, status, email } */
    send: (body) => http.post('/quote-requests', body),
    /* The signed-in customer's requests, newest first. */
    mine: () => http.get('/quote-requests/mine'),
};
