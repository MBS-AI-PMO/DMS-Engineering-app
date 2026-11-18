/*
 * Public order tracking. Mounted at /api/track-order.
 *
 *   POST /lookup          { order, email } -> the order's tracking view
 *   GET  /open/:token     the signed link from an order email: remembers it,
 *                         then redirects to /track-order/:id
 *   GET  /:id             the tracking view, for the signed-in customer who
 *                         owns the order or a browser holding its link
 *
 * Nothing here says whether an order exists: a wrong number and a wrong
 * email get the same answer, and GET /:id answers "enter the email" for
 * any order this browser cannot open. Lookups are limited to 10 per
 * address per 10 minutes (and 600 across the site in that time).
 *
 * A successful lookup or link keeps its signed token (orders/trackLink.js)
 * in an httpOnly cookie that only these routes receive, so reloading the
 * page, or coming back to it from My orders, does not ask again. It ends
 * with the browser session; links from emails expire after 90 days and
 * lookups after 7.
 */
const express = require('express');
const { optionalUser: authOptionalUser } = require('../middleware/auth');
const { route, ok, HttpError, badRequest, validate } = require('../helpers');
const { createRateLimit } = require('../quotes/rateLimit');
const { signTrackToken, readTrackToken, tokenFits } = require('../orders/trackLink');
const { findForLookup, findById, ownsOrder, trackingView } = require('../orders/tracking');

const router = express.Router();

const COOKIE = 'dms_track';
const COOKIE_PATH = '/api/track-order';
const KEEP_TOKENS = 5;
const LOOKUP_DAYS = 7;

const WINDOW_MS = 10 * 60 * 1000;
const limit = createRateLimit({ perSender: 10, windowMs: WINDOW_MS, siteMax: 600, siteWindowMs: WINDOW_MS });

const NOT_FOUND = "We couldn't find an order with that number and email. Check both and try again.";
const NEEDS_EMAIL = 'Enter the email used on this order to see it.';
const TOO_MANY = 'Too many tries. Please wait 10 minutes and try again, or contact us with your order number.';

// ── Who is asking ───────────────────────────────────────────────────────

const PRIVATE_ADDRESS = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|f[cd][0-9a-f]{2}:|fe80:|unknown$)/i;
const plainAddress = (value) => String(value || '').trim().replace(/^::ffff:/i, '');
const isPrivate = (address) => !address || PRIVATE_ADDRESS.test(address);

/* The address to count tries against. Straight from the internet it is the
 * connection's own address. Behind the site's proxy (a private or loopback
 * connection) it is the right-most public X-Forwarded-For entry: the one the
 * proxy added, which a visitor cannot forge (entries to its left are
 * whatever the visitor sent). */
function clientAddress(req) {
    const direct = plainAddress(req.socket?.remoteAddress || req.ip);
    if (!isPrivate(direct)) return direct;
    const hops = String(req.headers['x-forwarded-for'] || '').split(',').map(plainAddress).filter(Boolean);
    for (let i = hops.length - 1; i >= 0; i -= 1) if (!isPrivate(hops[i])) return hops[i];
    return direct || 'unknown';
}

/* A signed-in customer, if the request carries a valid token. */
const optionalUser = (req) => authOptionalUser(req);

// ── The cookie that remembers opened orders ─────────────────────────────

const isHttps = (req) => req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';

const heldTokens = (req) => String(req.cookies?.[COOKIE] || '').split('~').filter(Boolean).slice(0, KEEP_TOKENS);

/* Keeps this order's token first, with up to four other unexpired ones. */
function remember(req, res, token, orderId) {
    const others = heldTokens(req).filter(t => {
        const parsed = readTrackToken(t);
        return parsed && !parsed.expired && parsed.orderId !== orderId;
    });
    res.cookie(COOKIE, [token, ...others].slice(0, KEEP_TOKENS).join('~'), {
        httpOnly: true,
        sameSite: 'lax',
        secure: isHttps(req),
        path: COOKIE_PATH,
    });
}

/* The order behind a held token for this id, if its signature fits. */
function heldTokenFits(req, order) {
    return heldTokens(req).some(t => {
        const parsed = readTrackToken(t);
        return parsed && parsed.orderId === order.id && tokenFits(parsed, order.email);
    });
}

// ── Input ───────────────────────────────────────────────────────────────

/* "1042", "#1042", " 1042 " -> 1042. */
function orderNumber(value) {
    const s = String(value ?? '').trim().replace(/^#\s*/, '');
    if (!s) throw badRequest('Enter your order number.');
    if (!/^\d{1,9}$/.test(s) || Number(s) <= 0) throw badRequest('Enter the order number as digits, for example 1042.');
    return Number(s);
}

const noStore = (res) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex');
};

// ── Routes ──────────────────────────────────────────────────────────────

router.post('/lookup', route('look up the order', async (req, res) => {
    noStore(res);
    const key = clientAddress(req);
    if (!limit.allows(key)) throw new HttpError(429, TOO_MANY);
    const id = orderNumber(req.body?.order);
    const email = validate.email(req.body?.email, 'Email', { required: true });
    limit.record(key);

    const order = await findForLookup(id, email);
    if (!order) throw new HttpError(404, NOT_FOUND);
    remember(req, res, signTrackToken(order.id, order.email, { days: LOOKUP_DAYS }), order.id);
    ok(res, await trackingView(order), { access: 'email' });
}));

router.get('/open/:token', route('open the order link', async (req, res) => {
    noStore(res);
    res.set('Referrer-Policy', 'no-referrer');
    const parsed = readTrackToken(req.params.token);
    if (!parsed) return res.redirect(302, '/track-order?link=invalid');
    const order = parsed.expired ? null : await findById(parsed.orderId);
    if (!order || !tokenFits(parsed, order.email)) {
        return res.redirect(302, `/track-order/${parsed.orderId}?link=${parsed.expired ? 'expired' : 'invalid'}`);
    }
    remember(req, res, req.params.token, order.id);
    res.redirect(302, `/track-order/${order.id}`);
}));

router.get('/:id', route('load the order', async (req, res) => {
    noStore(res);
    const id = orderNumber(req.params.id);
    const order = await findById(id);
    const user = optionalUser(req);
    const access = !order ? null : ownsOrder(user, order) ? 'account' : heldTokenFits(req, order) ? 'link' : null;
    if (!access) throw new HttpError(404, NEEDS_EMAIL, { needsEmail: true });
    ok(res, await trackingView(order), { access });
}));

module.exports = router;
