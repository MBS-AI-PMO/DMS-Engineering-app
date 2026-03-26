const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../db');

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || 'dms-email-enc-key-change-in-prod!'; // Must be 32 chars

function getKey() {
    const key = ENCRYPTION_KEY;
    // Pad or hash to exactly 32 bytes
    return crypto.createHash('sha256').update(key).digest();
}

function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
    const [ivHex, encrypted] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

async function getEmailConfig() {
    const result = await db.query('SELECT * FROM email_config ORDER BY id LIMIT 1');
    if (result.rows.length === 0) return null;
    const config = result.rows[0];
    return {
        ...config,
        password_decrypted: decrypt(config.password_encrypted),
    };
}

function classifyEmailError(err) {
    const code = err.code || '';
    const msg = err.message || '';

    if (code === 'ECONNREFUSED') return 'Connection refused. Check SMTP host and port.';
    if (code === 'ECONNRESET') return 'Connection reset. The SMTP server closed the connection.';
    if (code === 'ETIMEDOUT' || code === 'ESOCKET') return 'Connection timed out. Check SMTP host, port, and firewall settings.';
    if (code === 'ENOTFOUND') return 'SMTP host not found. Check the hostname is correct.';
    if (code === 'EAUTH' || msg.includes('Invalid login') || msg.includes('authentication')) {
        return 'Authentication failed. Check email and password (use App Password for Gmail/Outlook).';
    }
    if (msg.includes('self signed certificate')) return 'SSL certificate issue. Try using TLS instead of SSL.';
    if (msg.includes('wrong version number')) return 'Protocol mismatch. Port 465 requires SSL; port 587 requires TLS.';
    if (msg.includes('certificate')) return 'SSL/TLS certificate error. Check encryption type and port.';
    return `Email error: ${msg}`;
}

function createTransporter(config) {
    const secure = config.encryption_type === 'SSL';
    return nodemailer.createTransport({
        host: config.smtp_host,
        port: config.smtp_port,
        secure,
        auth: {
            user: config.email,
            pass: config.password_decrypted || decrypt(config.password_encrypted),
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        tls: config.encryption_type === 'TLS' ? { rejectUnauthorized: false } : undefined,
    });
}

async function sendEmail({ to, subject, html }) {
    const config = await getEmailConfig();
    if (!config) throw new Error('Email not configured. Go to Admin > Email Config to set up SMTP.');

    const transporter = createTransporter(config);

    try {
        const info = await transporter.sendMail({
            from: `"${config.sender_name || 'DMS Engineering'}" <${config.email}>`,
            to,
            subject,
            html,
        });
        console.log(`[Email] Sent to ${to} | subject: "${subject}" | messageId: ${info.messageId}`);
        return info;
    } catch (err) {
        const detail = classifyEmailError(err);
        console.error(`[Email] FAILED to ${to} | code: ${err.code || 'unknown'} | ${err.message}`);
        throw new Error(detail);
    }
}

async function testConnection() {
    const config = await getEmailConfig();
    if (!config) throw new Error('Email not configured');

    const transporter = createTransporter(config);

    try {
        await transporter.verify();
        console.log('[Email] SMTP connection test successful');
        return { success: true };
    } catch (err) {
        const detail = classifyEmailError(err);
        console.error(`[Email Test] FAILED | code: ${err.code || 'unknown'} | ${err.message}`);
        throw new Error(detail);
    }
}

module.exports = { encrypt, decrypt, getEmailConfig, createTransporter, sendEmail, testConnection };
