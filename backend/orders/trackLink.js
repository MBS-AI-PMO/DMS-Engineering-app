/*
 * Signed links to an order's public tracking page (/track-order/:id), so a
 * customer who clicks one in an order email never has to type anything.
 *
 *   token = "<order id>.<expiry, unix seconds in base 36>.<signature>"
 *   signature = HMAC-SHA256(key, "<order id>.<expiry>.<order email, trimmed, lower case>"),
 *               first 18 bytes, base64url (24 characters)
 *
 * The key is derived from the site's JWT secret (middleware/auth.js, set by
 * JWT_SECRET in the environment) for this one purpose, so a tracking
 * signature can never stand in for anything else signed with that secret.
 * The email is in the signature, so changing the order's email voids every
 * link sent before. Links in emails last 90 days; checks are timing-safe.
 *
 * The link itself goes to the backend (trackLinkPath), which checks it,
 * keeps it in an httpOnly cookie and redirects to the page: the token never
 * sits in the page address, where analytics pixels and shared screenshots
 * would pick it up (routes/trackOrder.js).
 */
const crypto = require('crypto');
const { JWT_SECRET } = require('../middleware/auth');

const EMAIL_LINK_DAYS = 90;
const SIG_BYTES = 18;
const SIG_LENGTH = 24; // base64url of SIG_BYTES
const DAY_SECONDS = 24 * 60 * 60;

const KEY = crypto.createHmac('sha256', String(JWT_SECRET)).update('dms:order-tracking-link:v1').digest();

const normalEmail = (email) => String(email || '').trim().toLowerCase();

const signature = (orderId, exp, email) => crypto
    .createHmac('sha256', KEY)
    .update(`${orderId}.${exp}.${normalEmail(email)}`)
    .digest()
    .subarray(0, SIG_BYTES)
    .toString('base64url');

/* A token for this order and the email on it, good for `days`. */
function signTrackToken(orderId, email, { days = EMAIL_LINK_DAYS, now = Date.now() } = {}) {
    const id = Number(orderId);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('signTrackToken: bad order id');
    const exp = Math.floor(now / 1000) + Math.round(days * DAY_SECONDS);
    return `${id}.${exp.toString(36)}.${signature(id, exp, email)}`;
}

const TOKEN_RE = new RegExp(`^([1-9]\\d{0,8})\\.([0-9a-z]{1,10})\\.([A-Za-z0-9_-]{${SIG_LENGTH}})$`);

/* The parts of a well-formed token: { orderId, exp, sig, expired }, or null.
 * Says nothing about the signature yet (tokenFits checks it). */
function readTrackToken(token, now = Date.now()) {
    const m = TOKEN_RE.exec(String(token || ''));
    if (!m) return null;
    const exp = Number.parseInt(m[2], 36);
    if (!Number.isSafeInteger(exp)) return null;
    return { orderId: Number(m[1]), exp, sig: m[3], expired: exp * 1000 <= now };
}

/* True when a read token is unexpired and was signed for this order's email. */
function tokenFits(parsed, email, now = Date.now()) {
    if (!parsed || parsed.exp * 1000 <= now) return false;
    const expected = Buffer.from(signature(parsed.orderId, parsed.exp, email));
    const given = Buffer.from(String(parsed.sig));
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/* Path (on the site) of the link that opens this order's tracking page. */
const trackLinkPath = (orderId, email, opts) => `/api/track-order/open/${signTrackToken(orderId, email, opts)}`;

module.exports = { signTrackToken, readTrackToken, tokenFits, trackLinkPath, EMAIL_LINK_DAYS };
