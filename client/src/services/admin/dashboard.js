import { adminHttp as http } from '../http';

/*
 * Admin › Dashboard: the reads the home screen sums up (counts of what is
 * in the catalog and content, site settings, the email setup). Orders,
 * quotes, customers, subscribers and admins come from their own services.
 * Each list call resolves to the rows; the page counts them.
 */
export const dashboardService = {
    metals: () => http.get('/metals'),
    categories: () => http.get('/categories'),
    services: () => http.get('/services', { query: { includeInactive: true } }),
    heroSections: () => http.get('/hero-sections/admin'),
    faqs: () => http.get('/faqs'),
    faqCategories: () => http.get('/faqs/categories'),
    guidelines: () => http.get('/guidelines'),
    /* Public site settings (payment switches live here). */
    settings: () => http.get('/settings'),
    /* The saved SMTP setup (password masked) or null when none. */
    emailConfig: () => http.get('/email/config'),
    /* Logs in to the mail server to check the setup. Sends no email. -> { success, message } */
    testEmailConnection: () => http.postBody('/email/test'),
};
