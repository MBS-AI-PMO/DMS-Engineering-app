const db = require('../db');
const { sendEmail } = require('../utils/email');
const { getBrand, EMAIL_RE } = require('./brand');
const { renderLayout, htmlToText } = require('./layout');
const { TEMPLATES, toEmailOrder } = require('./templates');

/*
 * Rendering and sending the site's emails (templates.js) through the SMTP
 * account set in Admin > Email Configuration (utils/email.js).
 *
 * The notify* functions are for routes: they return at once and send in
 * the background, so a slow or unset mail server never holds up an order
 * or a sign-up. Failures are logged, not thrown.
 */

/* The finished email. With preview the logo is inlined as a data URL so a
 * browser can show it; otherwise it points at the attached copy (cid:). */
function renderTemplate(name, data, brand, { preview = false } = {}) {
    const template = TEMPLATES[name];
    if (!template) throw new Error(`Unknown email template "${name}"`);
    const parts = template.render(data, brand);
    const { logo } = brand;
    const logoSrc = !logo ? '' : preview
        ? `data:image/png;base64,${logo.content.toString('base64')}`
        : `cid:${logo.cid}`;
    const html = renderLayout({ brand, ...parts, logo, logoSrc });
    return { subject: parts.subject, html, text: htmlToText(html) };
}

async function sendTemplate(name, data, { to, replyTo, brand, attachments = [] } = {}) {
    const resolvedBrand = brand || await getBrand();
    const { subject, html, text } = renderTemplate(name, data, resolvedBrand);
    const { logo } = resolvedBrand;
    return sendEmail({
        to,
        subject,
        html,
        text,
        replyTo,
        attachments: [
            ...(logo ? [{ filename: 'logo.png', content: logo.content, cid: logo.cid, contentType: 'image/png', contentDisposition: 'inline' }] : []),
            ...attachments,
        ],
    });
}

// ── Background notifications ──────────────────────────────────────────────

const inBackground = (label, task) => {
    setImmediate(() => {
        Promise.resolve()
            .then(task)
            .catch(err => console.error(`[Email] ${label} not sent: ${err.message}`));
    });
};

const cleanName = (name) => String(name || '').replace(/["\\\r\n]/g, '').trim();

// Replies to customer emails go to the public contact address when there is one.
const companyReplyTo = (brand) => brand.contactEmail || undefined;

async function loadOrder(orderId) {
    const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (!orderRes.rows.length) return null;
    const itemsRes = await db.query(
        'SELECT file_name, quantity, unit_price, line_total, configuration_json FROM order_items WHERE order_id = $1 ORDER BY id',
        [orderId]
    );
    const shipmentsRes = await db.query('SELECT * FROM order_shipments WHERE order_id = $1 ORDER BY shipped_at NULLS LAST, id', [orderId])
        .catch(() => ({ rows: [] }));
    return toEmailOrder(orderRes.rows[0], itemsRes.rows, shipmentsRes.rows);
}

/* An email about an order, sent now; for the admin order page, which logs
 * whether it went out. Resolves to { to, subject, sending } where sending
 * is the promise of the send itself. data is merged into the template data
 * ({ note }, { subject, message, photos }); attachments add to the logo. */
async function sendOrderEmail(orderId, templateName, data = {}, { attachments = [] } = {}) {
    const [order, brand] = await Promise.all([loadOrder(orderId), getBrand()]);
    if (!order) throw new Error(`Order #${orderId} not found`);
    if (!EMAIL_RE.test(order.email)) throw new Error(`The customer's address "${order.email}" is not a valid email address`);
    const templateData = { order, ...data };
    const { subject } = renderTemplate(templateName, templateData, brand);
    const sending = sendTemplate(templateName, templateData, { to: order.email, replyTo: companyReplyTo(brand), brand, attachments });
    return { to: order.email, subject, sending };
}

// A new order: a confirmation to the customer and an alert to staff.
function notifyOrderPlaced(orderId) {
    inBackground(`Order #${orderId} emails`, async () => {
        const [order, brand] = await Promise.all([loadOrder(orderId), getBrand()]);
        if (!order) return;
        const customerOk = EMAIL_RE.test(order.email);

        const sends = [
            customerOk
                ? sendTemplate('order-confirmation', { order }, { to: order.email, replyTo: companyReplyTo(brand), brand })
                : Promise.reject(new Error(`customer address "${order.email}" is not valid`)),
            brand.staffInbox.length
                ? sendTemplate('order-alert', { order }, {
                    to: brand.staffInbox,
                    replyTo: customerOk ? { name: cleanName(order.fullName), address: order.email } : undefined,
                    brand,
                })
                : Promise.reject(new Error('no staff inbox is set (Admin > Contact)')),
        ];
        const [confirmation, alert] = await Promise.allSettled(sends);
        if (confirmation.status === 'rejected') console.error(`[Email] Order #${orderId} confirmation not sent: ${confirmation.reason.message}`);
        if (alert.status === 'rejected') console.error(`[Email] Order #${orderId} staff alert not sent: ${alert.reason.message}`);
    });
}

// Customers hear about these steps; "pending" is where every order starts.
const STATUSES_TO_ANNOUNCE = new Set(['processing', 'shipping', 'completed', 'rejected']);

function notifyOrderStatus(orderId, status, { note } = {}) {
    if (!STATUSES_TO_ANNOUNCE.has(status)) return;
    inBackground(`Order #${orderId} "${status}" email`, async () => {
        const [order, brand] = await Promise.all([loadOrder(orderId), getBrand()]);
        if (!order || !EMAIL_RE.test(order.email)) return;
        await sendTemplate(`order-${status}`, { order, note }, { to: order.email, replyTo: companyReplyTo(brand), brand });
    });
}

function notifyWelcome(user) {
    if (!EMAIL_RE.test(String(user?.email || ''))) return;
    inBackground(`Welcome email to ${user.email}`, async () => {
        const brand = await getBrand();
        await sendTemplate('welcome', { user }, { to: user.email, replyTo: companyReplyTo(brand), brand });
    });
}

function notifyNewsletterWelcome(email) {
    if (!EMAIL_RE.test(String(email || ''))) return;
    inBackground(`Newsletter welcome to ${email}`, async () => {
        const brand = await getBrand();
        await sendTemplate('newsletter-welcome', { email }, { to: email, replyTo: companyReplyTo(brand), brand });
    });
}

module.exports = {
    TEMPLATES,
    renderTemplate,
    sendTemplate,
    getBrand,
    notifyOrderPlaced,
    notifyOrderStatus,
    sendOrderEmail,
    STATUSES_TO_ANNOUNCE,
    notifyWelcome,
    notifyNewsletterWelcome,
};
