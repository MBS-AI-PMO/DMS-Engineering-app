/**
 * tracking.js - Admin-managed analytics pixels (setting `tracking_pixels`):
 * Google Analytics 4, Meta (Facebook) Pixel and TikTok Pixel.
 *
 * - Each vendor's official loader runs once, only when enabled and its ID
 *   passes strict validation (IDs are interpolated into script URLs/calls).
 * - Nothing is loaded or sent on /admin routes.
 * - trackPageView() is called by SeoTrackingManager on every route change.
 * - trackEvent(name, params) fans one event out to every enabled pixel.
 *   Events fired before the settings arrive are queued and flushed after.
 */
import { isAdminPath } from './seo';

// Same rules as backend/utils/seoSettings.js.
export const PIXEL_ID_RULES = {
    ga4: /^G-[A-Z0-9]{4,20}$/,
    facebook: /^[0-9]{6,20}$/,
    tiktok: /^[A-Z0-9]{10,30}$/,
};

/** Only enabled vendors with a valid ID survive: { ga4?: id, facebook?: id, tiktok?: id }. */
export function sanitizeTrackingConfig(raw) {
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const out = {};
    Object.entries(PIXEL_ID_RULES).forEach(([vendor, re]) => {
        const entry = src[vendor];
        const id = typeof entry?.id === 'string' ? entry.id.trim() : '';
        if (entry?.enabled === true && re.test(id)) out[vendor] = id;
    });
    return out;
}

// Standard event names per vendor.
const EVENT_MAP = {
    AddToCart: { ga4: 'add_to_cart', facebook: 'AddToCart', tiktok: 'AddToCart' },
    InitiateCheckout: { ga4: 'begin_checkout', facebook: 'InitiateCheckout', tiktok: 'InitiateCheckout' },
    Purchase: { ga4: 'purchase', facebook: 'Purchase', tiktok: 'CompletePayment' },
};

let active = null;          // sanitized config once settings have loaded
let pending = [];           // events fired before settings arrived
let lastPageViewKey = null; // guards StrictMode double effects
let lastEvent = { key: '', at: 0 };
const loaded = { ga4: false, facebook: false, tiktok: false };

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';
const onAdmin = () => isBrowser() && isAdminPath(window.location.pathname);
// A vendor fires only while enabled in the latest settings and its script is loaded.
const on = (vendor) => Boolean(active && active[vendor] && loaded[vendor]);

const loadScript = (src) => {
    const s = document.createElement('script');
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
};

// ── Official vendor loaders (rewritten without eval/innerHTML) ──────────────

function loadGa4(id) {
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') {
        window.gtag = function gtag() { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
    }
    // Page views are sent manually on each SPA route change.
    window.gtag('config', id, { send_page_view: false });
}

function loadFacebook(id) {
    if (!window.fbq) {
        const n = function fbq() {
            if (n.callMethod) n.callMethod.apply(n, arguments);
            else n.queue.push(arguments);
        };
        window.fbq = n;
        if (!window._fbq) window._fbq = n;
        n.push = n;
        n.loaded = true;
        n.version = '2.0';
        n.queue = [];
        loadScript('https://connect.facebook.net/en_US/fbevents.js');
    }
    window.fbq('init', id);
}

function loadTiktok(id) {
    const name = 'ttq';
    window.TiktokAnalyticsObject = name;
    const ttq = (window[name] = window[name] || []);
    ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias',
        'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];
    ttq.setAndDefer = (target, method) => {
        target[method] = function deferred() {
            target.push([method].concat(Array.prototype.slice.call(arguments, 0)));
        };
    };
    ttq.methods.forEach(m => ttq.setAndDefer(ttq, m));
    ttq.instance = (key) => {
        const inst = ttq._i[key] || [];
        ttq.methods.forEach(m => ttq.setAndDefer(inst, m));
        return inst;
    };
    ttq.load = (key, options) => {
        const src = 'https://analytics.tiktok.com/i18n/pixel/events.js';
        ttq._i = ttq._i || {};
        ttq._i[key] = [];
        ttq._i[key]._u = src;
        ttq._t = ttq._t || {};
        ttq._t[key] = +new Date();
        ttq._o = ttq._o || {};
        ttq._o[key] = options || {};
        loadScript(`${src}?sdkid=${encodeURIComponent(key)}&lib=${name}`);
    };
    ttq.load(id);
}

const LOADERS = { ga4: loadGa4, facebook: loadFacebook, tiktok: loadTiktok };

/**
 * Called with the raw `tracking_pixels` setting once settings load (and only
 * on public routes). Loads each enabled vendor once and flushes queued events.
 */
export function initTracking(rawConfig) {
    if (!isBrowser() || onAdmin()) return;
    active = sanitizeTrackingConfig(rawConfig);
    Object.entries(active).forEach(([vendor, id]) => {
        if (loaded[vendor]) return;
        try {
            LOADERS[vendor](id);
            loaded[vendor] = true;
        } catch (err) {
            console.warn(`[tracking] ${vendor} failed to load`, err);
        }
    });
    const queued = pending;
    pending = [];
    queued.forEach(([name, params]) => trackEvent(name, params));
}

/** Settings could not be loaded: drop anything queued. */
export function disableTracking() {
    active = {};
    pending = [];
}

/** Send one page view to every loaded pixel. `key` dedupes repeated calls for the same navigation. */
export function trackPageView(path, title, key = path) {
    if (!active || onAdmin() || key === lastPageViewKey) return;
    lastPageViewKey = key;
    try {
        if (on('ga4') && window.gtag) {
            window.gtag('event', 'page_view', {
                page_path: path,
                page_location: window.location.href,
                page_title: title || document.title,
                send_to: active.ga4,
            });
        }
        if (on('facebook') && window.fbq) window.fbq('track', 'PageView');
        if (on('tiktok') && window.ttq) window.ttq.page();
    } catch (err) {
        console.warn('[tracking] page view failed', err);
    }
}

const money = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
};

/** Value/currency params for cart items ({ pricing: { total }, quantity }). */
export function cartEventParams(items = []) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [items].filter(Boolean);
    return {
        value: money(list.reduce((sum, item) => sum + (Number(item.pricing?.total) || 0) * (Number(item.quantity) || 1), 0)),
        currency: 'USD',
        num_items: list.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0),
    };
}

/**
 * Fan an event out to the enabled pixels.
 * name: 'AddToCart' | 'InitiateCheckout' | 'Purchase' (others pass through as custom events)
 * params: { value, currency = 'USD', num_items, order_id }
 */
export function trackEvent(name, params = {}) {
    if (!isBrowser() || onAdmin() || !name) return;
    if (!active) {
        if (pending.length < 20) pending.push([name, params]);
        return;
    }
    if (!Object.keys(active).length) return;

    // Ignore an identical event fired twice within a second (StrictMode, double clicks).
    const key = `${name}:${JSON.stringify(params)}`;
    const now = Date.now();
    if (lastEvent.key === key && now - lastEvent.at < 1000) return;
    lastEvent = { key, at: now };

    const value = money(params.value);
    const currency = typeof params.currency === 'string' && /^[A-Z]{3}$/.test(params.currency) ? params.currency : 'USD';
    const orderId = params.order_id != null ? String(params.order_id) : '';
    const numItems = Number.isFinite(Number(params.num_items)) ? Number(params.num_items) : undefined;
    const names = EVENT_MAP[name] || { ga4: String(name).replace(/[^A-Za-z0-9_]/g, '_').toLowerCase(), facebook: name, tiktok: name, custom: true };

    try {
        if (on('ga4') && window.gtag) {
            const ga = { currency, value, send_to: active.ga4 };
            if (orderId) ga.transaction_id = orderId;
            window.gtag('event', names.ga4, ga);
        }
        if (on('facebook') && window.fbq) {
            const fb = { currency, value };
            if (numItems !== undefined) fb.num_items = numItems;
            if (names.custom) window.fbq('trackCustom', names.facebook, fb);
            else if (orderId) window.fbq('track', names.facebook, fb, { eventID: `order_${orderId}` });
            else window.fbq('track', names.facebook, fb);
        }
        if (on('tiktok') && window.ttq) {
            const tt = { currency, value, content_type: 'product' };
            if (orderId) tt.order_id = orderId;
            if (orderId) window.ttq.track(names.tiktok, tt, { event_id: `order_${orderId}` });
            else window.ttq.track(names.tiktok, tt);
        }
    } catch (err) {
        console.warn(`[tracking] ${name} failed`, err);
    }
}
