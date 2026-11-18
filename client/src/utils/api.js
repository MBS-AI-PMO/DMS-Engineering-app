/**
 * api.js - Central API utility for the DMS frontend.
 * 
 * Provides methods for all API calls with consistent error handling.
 * Falls back to static data if the API is unavailable.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// ── Token storage (Bearer fallback for environments where cookies aren't sent) ──
const TOKEN_KEY = 'dms_token';
const ADMIN_TOKEN_KEY = 'dms_admin_token';

export const setStoredToken = (token) => {
    try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
};
export const getStoredToken = () => {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
};
export const setStoredAdminToken = (token) => {
    try { token ? localStorage.setItem(ADMIN_TOKEN_KEY, token) : localStorage.removeItem(ADMIN_TOKEN_KEY); } catch { /* ignore */ }
};
export const getStoredAdminToken = () => {
    try { return localStorage.getItem(ADMIN_TOKEN_KEY) || ''; } catch { return ''; }
};

// Admin-scoped endpoints should prefer the admin token.
const isAdminScopedUrl = (url) => /\/admin([-/]|$)/.test(url) || /\/auth\/admin/.test(url);

// Authorization header helpers for raw fetch() calls outside this module.
export const authHeaders = () => {
    const token = getStoredToken() || getStoredAdminToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
};
export const adminAuthHeaders = () => {
    const token = getStoredAdminToken() || getStoredToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
};

async function request(url, options = {}) {
    // Any write may change what the public pages show (a price calculation is not a write).
    const isWrite = String(options.method || 'GET').toUpperCase() !== 'GET' && !url.startsWith('/pricing/calculate');
    if (isWrite) clearPublicDataCache();
    try {
        return await send(url, options);
    } finally {
        if (isWrite) clearPublicDataCache();
    }
}

async function send(url, options) {
    const isFormData = options.body instanceof FormData;
    const baseHeaders = isFormData ? {} : { 'Content-Type': 'application/json' };
    const headers = { ...baseHeaders, ...(options.headers || {}) };

    const token = isAdminScopedUrl(url)
        ? (getStoredAdminToken() || getStoredToken())
        : (getStoredToken() || getStoredAdminToken());
    if (token && !('Authorization' in headers)) {
        headers.Authorization = `Bearer ${token}`;
    }

    const config = {
        credentials: 'include', // Send cookies for JWT (Bearer header is the fallback)
        ...options,
        headers,
    };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
        config.body = JSON.stringify(config.body);
    }

    const response = await fetch(`${API_BASE}${url}`, config);
    // An empty or non-JSON reply (server restarting, proxy error) is not a crash for the visitor.
    const text = await response.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(data.error || (response.status >= 500 ? 'The server did not answer. Please try again in a moment.' : `Request failed (${response.status}).`));
    }
    if (!text) throw new Error('The server did not answer. Please try again in a moment.');
    return data;
}

// ── Public data cache ───────────────────────────────────
// Settings, metals, services and FAQs are read by several parts of one page
// (navbar, footer, SEO tags and hero all read settings) and again on the
// next page. One request serves them all for a minute. Every caller gets
// its own copy, so changing what came back never changes the cache. Admin
// pages always fetch fresh, and any write made through request() empties it.
const PUBLIC_TTL_MS = 60 * 1000;
const publicData = new Map(); // url -> { promise, at }

export function clearPublicDataCache() {
    publicData.clear();
}

const copyOf = (value) => (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
const onAdminPage = () => typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

function cachedGet(url) {
    if (onAdminPage()) {
        clearPublicDataCache();
        return request(url);
    }
    const hit = publicData.get(url);
    if (hit && Date.now() - hit.at < PUBLIC_TTL_MS) return hit.promise.then(copyOf);
    const entry = { promise: request(url), at: Date.now() };
    publicData.set(url, entry);
    entry.promise.catch(() => {
        if (publicData.get(url) === entry) publicData.delete(url);
    });
    return entry.promise.then(copyOf);
}

// ── Metals ──────────────────────────────────────────────

export async function fetchMetals(category) {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    const { data } = await cachedGet(`/metals${params}`);
    return data;
}

/** Metals for a list: id, slug, name, thickness, description, image_path, category_name/slug only. */
export async function fetchMetalList() {
    const { data } = await cachedGet('/metals?view=list');
    return data;
}

export async function fetchMetalBySlug(slug) {
    const { data } = await cachedGet(`/metals/${slug}`);
    return data;
}

// ── Categories ──────────────────────────────────────────

export async function fetchCategories() {
    const { data } = await cachedGet('/categories');
    return data;
}

// ── FAQs ────────────────────────────────────────────────

export async function fetchFaqs(category) {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    const { data } = await cachedGet(`/faqs${params}`);
    return data;
}

export async function fetchFaqCategories() {
    const { data } = await cachedGet(`/faqs/categories`);
    return data;
}

// ── Auth ────────────────────────────────────────────────

export async function login(email, password) {
    const res = await request('/auth/login', {
        method: 'POST',
        body: { email, password },
    });
    if (res?.token) setStoredToken(res.token);
    return res;
}

export async function logout() {
    try {
        return await request('/auth/logout', { method: 'POST' });
    } finally {
        setStoredToken(null);
    }
}

export async function getMe() {
    return request('/auth/me');
}

// ── Admin Auth ──────────────────────────────────────────

export async function adminLogin(email, password) {
    const res = await request('/auth/admin/login', {
        method: 'POST',
        body: { email, password },
    });
    if (res?.token) setStoredAdminToken(res.token);
    return res;
}

export async function adminLogout() {
    try {
        return await request('/auth/admin/logout', { method: 'POST' });
    } finally {
        setStoredAdminToken(null);
    }
}

export async function getAdminMe() {
    return request('/auth/admin/me');
}

// ── Admin: Metals ───────────────────────────────────────

export async function createMetal(metalData) {
    return request('/metals/admin', { method: 'POST', body: metalData });
}

export async function updateMetal(id, metalData) {
    return request(`/metals/admin/${id}`, { method: 'PUT', body: metalData });
}

export async function deleteMetal(id) {
    return request(`/metals/admin/${id}`, { method: 'DELETE' });
}

export async function uploadMetalImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch(`${API_BASE}/metals/admin/upload-image`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...adminAuthHeaders() },
        body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Upload failed');
    return data;
}

// ── Admin: Categories ───────────────────────────────────

export async function createCategory(data) {
    return request('/categories/admin', { method: 'POST', body: data });
}

export async function updateCategory(id, data) {
    return request(`/categories/admin/${id}`, { method: 'PUT', body: data });
}

export async function deleteCategory(id) {
    return request(`/categories/admin/${id}`, { method: 'DELETE' });
}

// ── Admin: FAQs ─────────────────────────────────────────

export async function createFaq(data) {
    return request('/faqs/admin', { method: 'POST', body: data });
}

export async function updateFaq(id, data) {
    return request(`/faqs/admin/${id}`, { method: 'PUT', body: data });
}

export async function deleteFaq(id) {
    return request(`/faqs/admin/${id}`, { method: 'DELETE' });
}

// ── Admin: FAQ Categories ───────────────────────────────

export async function createFaqCategory(data) {
    return request('/faqs/admin/categories', { method: 'POST', body: data });
}

export async function updateFaqCategory(id, data) {
    return request(`/faqs/admin/categories/${id}`, { method: 'PUT', body: data });
}

export async function deleteFaqCategory(id) {
    return request(`/faqs/admin/categories/${id}`, { method: 'DELETE' });
}

// ── Services ───────────────────────────────────────────

export async function fetchServices(options = {}) {
    const includeInactive = typeof options === 'boolean' ? options : options.includeInactive;
    const params = includeInactive ? '?includeInactive=true' : '';
    const { data } = await cachedGet(`/services${params}`);
    return data;
}

export async function fetchServicesWithUsage(options = {}) {
    const includeInactive = typeof options === 'boolean' ? options : options.includeInactive;
    const params = includeInactive ? '?includeInactive=true' : '';
    const { data } = await request(`/services/usage${params}`);
    return data;
}

export async function fetchServiceBySlug(slug) {
    const { data } = await cachedGet(`/services/slug/${slug}`);
    return data;
}

/** `{ list: true }` returns only the columns a list of metals shows. */
export async function fetchMetalsByServiceId(serviceId, { list = false } = {}) {
    const { data } = await cachedGet(`/services/${serviceId}/metals${list ? '?view=list' : ''}`);
    return data;
}

export async function fetchMetalServices(slug) {
    const { data } = await cachedGet(`/metals/${slug}/services`);
    return data;
}

export async function createService(data) {
    return request('/services/admin', { method: 'POST', body: data });
}

export async function updateService(id, data) {
    return request(`/services/admin/${id}`, { method: 'PUT', body: data });
}

export async function updateServiceStatus(id, isActive) {
    return request(`/services/admin/${id}/status`, {
        method: 'PATCH',
        body: { is_active: isActive }
    });
}

export async function deleteService(id) {
    return request(`/services/admin/${id}`, { method: 'DELETE' });
}

export async function updateServiceMetals(serviceId, assignments) {
    return request(`/services/admin/${serviceId}/metals`, {
        method: 'PUT',
        body: { assignments }
    });
}

export async function uploadServiceImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    return request('/services/admin/upload', {
        method: 'POST',
        body: formData,
        headers: {} // Let fetch set the boundary
    });
}

// ── Admin: Hero Sections ───────────────────────────────

export async function fetchHeroSections() {
    const { data } = await request('/hero-sections/admin');
    return data;
}

export async function uploadHeroSectionImage(file) {
    const formData = new FormData();
    formData.append('image', file);

    return request('/hero-sections/admin/upload', {
        method: 'POST',
        body: formData,
        headers: {}
    });
}

export async function updateHeroSection(serviceId, heroImage) {
    return request(`/hero-sections/admin/${serviceId}`, {
        method: 'PUT',
        body: { hero_image: heroImage }
    });
}

export async function deleteHeroSection(serviceId) {
    return request(`/hero-sections/admin/${serviceId}`, {
        method: 'DELETE'
    });
}

// ── Hardware Insertion ──────────────────────────────────

export async function fetchHardwareTypes() {
    return request('/hardware/types');
}

export async function fetchAllHardwareWithItems() {
    const { data } = await request('/hardware/all');
    return data;
}

export async function fetchHardwareItemsByType(typeId) {
    const { data } = await request(`/hardware/types/${typeId}/items`);
    return data;
}

export async function uploadHardwareTypeImage(typeId, file) {
    const formData = new FormData();
    formData.append('image', file);
    return request(`/hardware/admin/types/${typeId}/image`, { method: 'POST', body: formData, headers: {} });
}

export async function createHardwareItem(data) {
    return request('/hardware/admin/items', { method: 'POST', body: data });
}

export async function updateHardwareItem(id, data) {
    return request(`/hardware/admin/items/${id}`, { method: 'PUT', body: data });
}

export async function deleteHardwareItem(id) {
    return request(`/hardware/admin/items/${id}`, { method: 'DELETE' });
}

export async function uploadHardwareItemImage(itemId, file) {
    const formData = new FormData();
    formData.append('image', file);
    return request(`/hardware/admin/items/${itemId}/image`, { method: 'POST', body: formData, headers: {} });
}

// ── User Registration & Profile ─────────────────────────

export async function registerUser(data) {
    return request('/users/register', { method: 'POST', body: data });
}

export async function getUserProfile() {
    const { data } = await request('/users/profile');
    return data;
}

export async function updateUserProfile(data) {
    return request('/users/profile', { method: 'PUT', body: data });
}

export async function updateUserPassword(data) {
    return request('/users/password', { method: 'PUT', body: data });
}

export async function fetchCustomers() {
    const { data } = await request('/users/customers');
    return data;
}

// ── Admin Users ────────────────────────────────────────

export async function fetchAdminUsers() {
    const { data } = await request('/users/admin');
    return data;
}

export async function createAdminUser(data) {
    return request('/users/admin', { method: 'POST', body: data });
}

export async function updateAdminUser(id, data) {
    return request(`/users/admin/${id}`, { method: 'PUT', body: data });
}

export async function deleteAdminUser(id) {
    return request(`/users/admin/${id}`, { method: 'DELETE' });
}

// ── Email Configuration ────────────────────────────────

export async function fetchEmailConfig() {
    const { data } = await request('/email/config');
    return data;
}

export async function saveEmailConfig(data) {
    return request('/email/config', { method: 'POST', body: data });
}

export async function testEmailConfig() {
    return request('/email/test', { method: 'POST' });
}

export async function deleteEmailConfig() {
    return request('/email/config', { method: 'DELETE' });
}

export async function sendTestEmail() {
    return request('/email/test-send', { method: 'POST' });
}

export async function fetchEmailTemplates() {
    const { data } = await request('/email/templates');
    return data;
}

export async function fetchEmailPreview(template) {
    const { data } = await request(`/email/preview/${encodeURIComponent(template)}`);
    return data;
}

export async function sendSampleEmail(template) {
    return request('/email/send-sample', { method: 'POST', body: { template } });
}

// ── Newsletter ─────────────────────────────────────────

export async function sendContactMessage(message) {
    return request('/contact', { method: 'POST', body: message });
}

export async function subscribeNewsletter(email) {
    return request('/newsletter/subscribe', { method: 'POST', body: { email } });
}

export async function fetchSubscribers() {
    const { data } = await request('/newsletter/subscribers');
    return data;
}

export async function deleteSubscriber(id) {
    return request(`/newsletter/subscribers/${id}`, { method: 'DELETE' });
}

// ── Site Settings ───────────────────────────────────────

let lastSettings = null;

export async function fetchSettings() {
    const { data } = await cachedGet('/settings');
    lastSettings = data;
    return data;
}

/** The settings from the last fetchSettings() (null before the first), read-only.
 *  Lets a page that opens after another draw its hero picture straight away. */
export const peekSettings = () => lastSettings;

export async function fetchPrivateSettings() {
    const { data } = await request('/settings/admin/private');
    return data;
}

export async function updateSetting(key, value) {
    return request(`/settings/${key}`, { method: 'PUT', body: { value } });
}

export async function uploadSettingLogo(key, file) {
    const formData = new FormData();
    formData.append('logo', file);
    formData.append('key', key);
    const { data } = await request('/settings/upload-logo', {
        method: 'POST',
        body: formData
    });
    return data;
}

// ── Guidelines ─────────────────────────────────────────

export async function fetchGuidelines() {
    const { data } = await cachedGet('/guidelines');
    return data;
}

export async function fetchGuideline(serviceId) {
    const { data } = await cachedGet(`/guidelines/${serviceId}`);
    return data;
}

export async function saveGuideline(data) {
    return request('/guidelines/admin', { method: 'POST', body: data });
}

// ── Configurations ──────────────────────────────────────

export async function fetchPricingSheetMetals() {
    const { data } = await request('/configurations/pricing/sheet-cutting-metals');
    return data;
}
export async function fetchPricingCncMetals() {
    const { data } = await request('/configurations/pricing/cnc-metals');
    return data;
}
export async function fetchCncPricingConfig() {
    const { data } = await request('/configurations/pricing/cnc-config');
    return data;
}

// ── Pricing ───────────────────────────────────────────

export async function fetchPricingMetadata() {
    return request('/pricing/admin/metadata');
}

// ── Payment ───────────────────────────────────────────

export async function fetchPaymentConfig() {
    const { data } = await request('/payment/config');
    return data;
}

export async function testPaypalKeys({ mode, client_id, secret }) {
    return request('/payment/test-paypal', { method: 'POST', body: { mode, client_id, secret } });
}

/* Starts a PayPal payment for the cart. The server prices the items itself;
 * a 409 carries `code` (PRICE_CHANGED / QUOTE_REQUIRED) and `items` on the
 * thrown error so checkout can update the cart. */
export async function createPaypalOrder(items) {
    const response = await fetch(`${API_BASE}/payment/paypal/create-order`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ items }),
    });
    let data = {};
    try { data = await response.json(); } catch { /* no body */ }
    if (!response.ok || !data.success) {
        const err = new Error(data.error || 'Could not start the PayPal payment');
        err.code = data.code;
        err.items = data.items;
        throw err;
    }
    return data.orderID;
}

export async function capturePaypalOrder(orderID) {
    return request('/payment/paypal/capture-order', { method: 'POST', body: { orderID } });
}

// ── Discounts ───────────────────────────────────────────

export async function fetchAdminDiscounts() {
    const { data } = await request('/pricing/admin/discounts');
    return data;
}

export async function saveDiscountTier(data) {
    return request('/pricing/admin/discounts/upsert', {
        method: 'POST',
        body: data
    });
}

export async function deleteDiscountTier(id) {
    return request(`/pricing/admin/discounts/${id}`, {
        method: 'DELETE'
    });
}

export async function fetchPublicDiscounts() {
    const { data } = await cachedGet('/pricing/discounts');
    return data;
}

export async function calculatePrice(payload) {
    // payload should now include 'quantity'
    return request('/pricing/calculate', {
        method: 'POST',
        body: payload
    });
}

