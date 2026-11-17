const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const db = require('../db');

/*
 * Everything an email shows about the company, read fresh from what admin
 * has set, so a change there shows in the next email sent:
 * - name: Admin > Email Configuration "Sender Display Name";
 * - logo: the navbar logo (made for the dark bar the emails also use),
 *   else the site logo, else the one bundled here;
 * - phone, address and public email: Admin > Contact (footer_contact);
 * - staff inbox for order alerts and website messages: Admin > Contact
 *   "Send website messages to", else the public email, else the sending
 *   account itself.
 * Links point at PUBLIC_SITE_URL (default https://dmscuts.com).
 */

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;
const BACKEND_ROOT = path.resolve(__dirname, '..');
const BUNDLED_LOGO = path.join(__dirname, 'logo.png');
const LOGO_CID = 'brand-logo@dms';
// The logo is shown at most this size; it is stored at twice that for sharp screens.
const LOGO_BOX = { width: 200, height: 76 };
const HEADER_BG = '#0b0c0f';

const siteUrl = () =>
    String(process.env.PUBLIC_SITE_URL || 'https://dmscuts.com').trim().replace(/\/+$/, '');

const parseSetting = (value) => {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
};

const emailList = (value) => String(value || '')
    .split(/[,;\s]+/).map(s => s.trim()).filter(e => EMAIL_RE.test(e));

// An uploaded file's path ("/uploads/logos/x.webp") on disk, if it is there.
const uploadedFile = (value) => {
    const rel = String(value || '').replace(/^\/+(api\/)?/, '');
    if (!rel.startsWith('uploads/')) return null;
    const full = path.resolve(BACKEND_ROOT, rel);
    if (!full.startsWith(BACKEND_ROOT + path.sep) || !fs.existsSync(full)) return null;
    return full;
};

/* The logo as a PNG on the header colour (WebP and transparency are not
 * safe in every mail reader), sized to fit LOGO_BOX. Kept in memory per
 * file and change time. */
const logoCache = new Map();
async function prepareLogo(file) {
    const key = `${file}:${fs.statSync(file).mtimeMs}`;
    if (logoCache.has(key)) return logoCache.get(key);

    const meta = await sharp(file).metadata();
    if (!meta.width || !meta.height) return null;
    const scale = Math.min(LOGO_BOX.width / meta.width, LOGO_BOX.height / meta.height, 1);
    const width = Math.round(meta.width * scale);
    const height = Math.round(meta.height * scale);
    const content = await sharp(file)
        .resize({ width: width * 2, height: height * 2, fit: 'fill', kernel: 'lanczos3' })
        .flatten({ background: HEADER_BG })
        .sharpen({ sigma: 0.6 })
        .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
        .toBuffer();

    const logo = { cid: LOGO_CID, content, width, height };
    logoCache.clear();
    logoCache.set(key, logo);
    return logo;
}

async function loadLogo(settings) {
    const candidates = [uploadedFile(settings.navbar_logo), uploadedFile(settings.site_logo), BUNDLED_LOGO]
        .filter(file => file && fs.existsSync(file));
    for (const file of candidates) {
        try {
            const logo = await prepareLogo(file);
            if (logo) return logo;
        } catch (err) {
            console.error(`[Email] Logo ${path.basename(file)} could not be used:`, err.message);
        }
    }
    return null;
}

async function getBrand() {
    const [configRes, settingsRes] = await Promise.all([
        db.query('SELECT sender_name, email FROM email_config ORDER BY id LIMIT 1'),
        db.query(
            "SELECT key, value FROM site_settings WHERE key IN ('navbar_logo', 'site_logo', 'footer_contact', 'contact_form_recipients')"
        ),
    ]);
    const config = configRes.rows[0] || {};
    const settings = {};
    settingsRes.rows.forEach(row => { settings[row.key] = parseSetting(row.value); });

    const contact = settings.footer_contact && typeof settings.footer_contact === 'object' ? settings.footer_contact : {};
    const contactEmail = EMAIL_RE.test(String(contact.email || '').trim()) ? String(contact.email).trim() : '';
    const senderEmail = EMAIL_RE.test(String(config.email || '')) ? config.email : '';

    let staffInbox = emailList(settings.contact_form_recipients).slice(0, 5);
    if (!staffInbox.length && contactEmail) staffInbox = [contactEmail];
    if (!staffInbox.length && senderEmail) staffInbox = [senderEmail];

    return {
        name: String(config.sender_name || '').trim() || 'DMS',
        senderEmail,
        contactEmail,
        phone: String(contact.phone || '').trim(),
        address: String(contact.address || '').trim(),
        siteUrl: siteUrl(),
        staffInbox,
        logo: await loadLogo(settings),
    };
}

module.exports = { getBrand, EMAIL_RE };
