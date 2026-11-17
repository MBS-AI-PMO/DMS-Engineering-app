import { adminHttp as http } from '../http';

/* Admin > Payment Methods (backend/routes/payment.js). */
export const paymentsService = {
    /* { cod_enabled, paypal_enabled, paypal_mode, sandbox_client_id, sandbox_secret, live_client_id, live_secret } */
    settings: () => http.get('/payment/admin/settings'),
    /* Saves all of them at once; resolves the saved settings. */
    save: (settings) => http.put('/payment/admin/settings', settings),
    /* Asks PayPal for a token with these keys. Resolves { success, message }. */
    testPaypal: ({ mode, client_id, secret }) => http.postBody('/payment/test-paypal', { mode, client_id, secret }),
};
