const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dms-engineering-secret-key-change-in-production';
const JWT_EXPIRES = '7d';

const bearerOf = (req) => String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();

/* The sign-ins a request carries, in order: customer cookie, admin cookie, Authorization header. */
function tokensOf(req, { adminCookie = true } = {}) {
    const list = [
        { from: 'token', value: req.cookies?.token },
        ...(adminCookie ? [{ from: 'admin_token', value: req.cookies?.admin_token }] : []),
        { from: 'header', value: bearerOf(req) },
    ].filter(t => t.value);
    return list.filter((t, i) => list.findIndex(o => o.value === t.value) === i);
}

const verify = (token) => {
    try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
};

/*
 * The first sign-in that is still valid. One that no longer verifies (expired,
 * or signed with an older JWT_SECRET) never hides a valid one behind it, and
 * such a stale cookie is cleared so the browser stops sending it.
 */
function firstValid(req, res, { adminCookie = true, accept = () => true } = {}) {
    for (const t of tokensOf(req, { adminCookie })) {
        const decoded = verify(t.value);
        if (decoded && accept(decoded)) return decoded;
        if (!decoded && res && t.from !== 'header') res.clearCookie(t.from);
    }
    return null;
}

/** A signed-in customer's token payload, or null (optional sign-in: checkout, quotes, tracking). */
const optionalUser = (req) => firstValid(req, null, { adminCookie: false });

/**
 * Middleware: a valid sign-in from the cookies or the Authorization header.
 * Attaches `req.user` = { id, email, role } on success.
 */
function authenticate(req, res, next) {
    if (!tokensOf(req).length) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    const decoded = firstValid(req, res);
    if (!decoded) return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    req.user = decoded;
    next();
}

/**
 * Middleware: Require admin role. Must be used after `authenticate`.
 * If the wrong token was picked up, auto-retry with admin_token cookie.
 */
function requireAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        return next();
    }

    // A customer sign-in was picked up first: use the request's admin sign-in, if any.
    const admin = firstValid(req, null, { accept: d => d.role === 'admin' });
    if (admin) {
        req.user = admin;
        return next();
    }

    return res.status(403).json({ success: false, error: 'Admin access required' });
}

/**
 * Generate a JWT token for a user.
 */
function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
    );
}

module.exports = { authenticate, requireAdmin, generateToken, optionalUser, JWT_SECRET };
