/**
 * api.js - Central API utility for the DMS frontend.
 * 
 * Provides methods for all API calls with consistent error handling.
 * Falls back to static data if the API is unavailable.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(url, options = {}) {
    const config = {
        headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
        credentials: 'include', // Send cookies for JWT
        ...options,
    };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
        config.body = JSON.stringify(config.body);
    }

    const response = await fetch(`${API_BASE}${url}`, config);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `API error: ${response.status}`);
    }
    return data;
}

// ── Metals ──────────────────────────────────────────────

export async function fetchMetals(category) {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    const { data } = await request(`/metals${params}`);
    return data;
}

export async function fetchMetalBySlug(slug) {
    const { data } = await request(`/metals/${slug}`);
    return data;
}

// ── Categories ──────────────────────────────────────────

export async function fetchCategories() {
    const { data } = await request('/categories');
    return data;
}

// ── FAQs ────────────────────────────────────────────────

export async function fetchFaqs(category) {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    const { data } = await request(`/faqs${params}`);
    return data;
}

export async function fetchFaqCategories() {
    const { data } = await request(`/faqs/categories`);
    return data;
}

// ── Auth ────────────────────────────────────────────────

export async function login(email, password) {
    return request('/auth/login', {
        method: 'POST',
        body: { email, password },
    });
}

export async function logout() {
    return request('/auth/logout', { method: 'POST' });
}

export async function getMe() {
    return request('/auth/me');
}

// ── Admin: Metals ───────────────────────────────────────

export async function createMetal(metalData) {
    return request('/metals/admin', { method: 'POST', body: metalData });
}

export async function updateMetal(slug, metalData) {
    return request(`/metals/admin/${slug}`, { method: 'PUT', body: metalData });
}

export async function deleteMetal(slug) {
    return request(`/metals/admin/${slug}`, { method: 'DELETE' });
}

export async function uploadMetalImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch(`${API_BASE}/metals/admin/upload-image`, {
        method: 'POST',
        credentials: 'include',
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

export async function fetchServices() {
    const { data } = await request('/services');
    return data;
}

export async function fetchServicesWithUsage() {
    const { data } = await request('/services/usage');
    return data;
}

export async function fetchMetalServices(slug) {
    const { data } = await request(`/metals/${slug}/services`);
    return data;
}

export async function createService(data) {
    return request('/services/admin', { method: 'POST', body: data });
}

export async function updateService(id, data) {
    return request(`/services/admin/${id}`, { method: 'PUT', body: data });
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

// ── Newsletter ─────────────────────────────────────────

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

export async function fetchSettings() {
    const { data } = await request('/settings');
    return data;
}

export async function updateSetting(key, value) {
    return request(`/settings/${key}`, { method: 'PUT', body: { value } });
}

// ── Guidelines ─────────────────────────────────────────

export async function fetchGuidelines() {
    const { data } = await request('/guidelines');
    return data;
}

export async function fetchGuideline(serviceId) {
    const { data } = await request(`/guidelines/${serviceId}`);
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

export async function fetchPricingRules(metalId, serviceId) {
    return request(`/pricing/admin/rules/${metalId}/${serviceId}`);
}

export async function savePricingRules(payload) {
    return request('/pricing/admin/upsert', {
        method: 'POST',
        body: payload
    });
}

// ── Discounts ───────────────────────────────────────────

export async function fetchAdminDiscounts() {
    return request('/pricing/admin/discounts');
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
    // This can be the same as admin if no sensitivity, 
    // but we'll use the admin one for now as it's a small internal tool.
    return request('/pricing/admin/discounts');
}

export async function calculatePrice(payload) {
    // payload should now include 'quantity'
    return request('/pricing/calculate', {
        method: 'POST',
        body: payload
    });
}
