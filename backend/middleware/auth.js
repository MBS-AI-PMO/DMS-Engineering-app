const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dms-engineering-secret-key-change-in-production';
const JWT_EXPIRES = '7d';

/**
 * Middleware: Verify JWT token from httpOnly cookie or Authorization header.
 * Checks both 'admin_token' and 'token' cookies for maximum compatibility.
 * Attaches `req.user` = { id, email, role } on success.
 */
function authenticate(req, res, next) {
    // Always try the regular user token first.
    // Admin routes are handled by requireAdmin's auto-retry logic.
    const token = req.cookies?.['token']
        || req.cookies?.['admin_token']
        || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
}

/**
 * Middleware: Require admin role. Must be used after `authenticate`.
 * If the wrong token was picked up, auto-retry with admin_token cookie.
 */
function requireAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        return next();
    }

    // The user token was picked up instead of admin_token. Retry.
    const adminToken = req.cookies?.['admin_token'];
    if (adminToken) {
        try {
            const decoded = jwt.verify(adminToken, JWT_SECRET);
            if (decoded.role === 'admin') {
                req.user = decoded;
                return next();
            }
        } catch (_) { /* fall through to 403 */ }
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

module.exports = { authenticate, requireAdmin, generateToken, JWT_SECRET };
