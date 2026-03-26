const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dms-engineering-secret-key-change-in-production';
const JWT_EXPIRES = '7d';

/**
 * Middleware: Verify JWT token from httpOnly cookie or Authorization header.
 * Attaches `req.user` = { id, email, role } on success.
 */
function authenticate(req, res, next) {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    
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
 */
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    next();
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
