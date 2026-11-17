import { adminHttp as http } from '../http';

/*
 * Admin > Discounts: quantity discount tiers (backend/routes/pricing.js) and
 * the site-wide on/off switch (site setting `discounts_enabled`, routes/settings.js).
 */

/* The setting may be stored as a boolean, a number or text ("off", "false"…). */
export function settingIsOn(value, fallback = true) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const text = String(value).trim().toLowerCase();
    if (['false', '0', 'no', 'off', 'disabled'].includes(text)) return false;
    if (['true', '1', 'yes', 'on', 'enabled'].includes(text)) return true;
    return fallback;
}

export const discountsService = {
    list: () => http.get('/pricing/admin/discounts'),
    /* tier: { id?, quantities: number[], discount_percent, is_active } */
    save: (tier) => http.post('/pricing/admin/discounts/upsert', tier),
    remove: (id) => http.delete(`/pricing/admin/discounts/${id}`),
    /* Whether quantity discounts apply on the site (default on when never set). */
    isEnabled: async () => settingIsOn((await http.get('/settings'))?.discounts_enabled, true),
    setEnabled: (on) => http.put('/settings/discounts_enabled', { value: Boolean(on) }),
};
