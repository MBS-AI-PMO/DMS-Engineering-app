import { useEffect, useState } from 'react';
import { ordersService } from '../../../services/admin/orders';
import { quotesService } from '../../../services/admin/quotes';
import { customersService } from '../../../services/admin/customers';
import { subscribersService } from '../../../services/admin/subscribers';
import { adminsService } from '../../../services/admin/admins';
import { dashboardService } from '../../../services/admin/dashboard';

// Everything the dashboard reads. Each loads on its own, so a slow or
// failing one never holds up (or breaks) the rest of the page.
const SOURCES = {
    orders: () => ordersService.list(), // { data, counts }
    quotes: () => quotesService.list(), // { data, counts: { new, … } }
    customers: () => customersService.list(),
    subscribers: () => subscribersService.list(),
    admins: () => adminsService.list(),
    metals: dashboardService.metals,
    categories: dashboardService.categories,
    services: dashboardService.services,
    heroSections: dashboardService.heroSections,
    faqs: dashboardService.faqs,
    faqCategories: dashboardService.faqCategories,
    guidelines: dashboardService.guidelines,
    settings: dashboardService.settings,
    emailConfig: dashboardService.emailConfig,
};

/**
 * { key: undefined (loading) | { value } | { error } } for every source,
 * filled in as each one answers.
 */
export function useDashboard() {
    const [results, setResults] = useState({});
    useEffect(() => {
        let alive = true;
        Object.entries(SOURCES).forEach(([key, load]) => {
            load()
                .then(value => ({ value }), error => ({ error }))
                .then(result => { if (alive) setResults(r => ({ ...r, [key]: result })); });
        });
        return () => { alive = false; };
    }, []);
    return results;
}

/** A list source's length: undefined while loading, null when it failed. */
export const countOf = (result) => {
    if (!result) return undefined;
    if (result.error) return null;
    return Array.isArray(result.value) ? result.value.length : null;
};
