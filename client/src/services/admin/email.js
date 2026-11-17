import { adminHttp as http } from '../http';

/* Admin > Email Config (backend/routes/email.js, mounted at /api/email). */
export const emailService = {
    /* The saved SMTP settings (no password), or null when none. */
    config: () => http.get('/email/config'),
    /* A blank password keeps the saved one. Resolves { success, message }. */
    save: (config) => http.postBody('/email/config', config),
    remove: () => http.request('DELETE', '/email/config'),
    /* Logs in to the mail server; sends nothing. */
    testConnection: () => http.postBody('/email/test'),
    /* Sends a test email to the sending account. */
    sendTest: () => http.postBody('/email/test-send'),
    /* The last order email sent and the last that failed. */
    status: () => http.get('/email/status'),
    templates: () => http.get('/email/templates'),
    preview: (key) => http.get(`/email/preview/${encodeURIComponent(key)}`),
    /* Sends one template, with sample data, to the sending account. */
    sendSample: (key) => http.postBody('/email/send-sample', { template: key }),
};
