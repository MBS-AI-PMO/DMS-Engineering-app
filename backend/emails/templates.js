const {
    C, FONT, escapeHtml: esc, money, longDate,
    heading, subheading, paragraph, button, link, details, quote, itemsTable, progress, columns, block,
} = require('./layout');
const { carrierLabel, carrierByKey, trackingUrlFor, dayString } = require('../orders/carriers');
const { parseConfig, partSpecs } = require('../orders/parts');

/*
 * Every email the site sends. Each template takes its data and the brand
 * (see brand.js) and returns { subject, preheader, eyebrow, body, footnote };
 * index.js wraps that in the shared layout. Each also has sample data so
 * Admin > Email Configuration can preview it and send a copy.
 */

const PAYMENT_LABEL = { COD: 'Cash on delivery', PAYPAL: 'PayPal' };

// "MUHAMMAD" and "muhammad" become "Muhammad"; mixed case ("McKay") is kept.
const firstName = (fullName) => {
    const first = String(fullName || '').trim().split(/\s+/)[0] || '';
    const oneCase = first === first.toUpperCase() || first === first.toLowerCase();
    return oneCase ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : first;
};
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const siteLabel = (brand) => brand.siteUrl.replace(/^https?:\/\//, '');

// What a part is made of and how, from the configuration saved with it.
function itemSpecs(cfg = {}) {
    const { material, thickness, services } = partSpecs(cfg);
    return [material, thickness ? `${thickness} thick` : null, ...services].filter(Boolean);
}

/* The order's tracking page. Real orders carry a signed link (index.js
 * loadOrder) that opens it without typing anything; previews and samples
 * fall back to the page itself, which asks for the order's email. */
const trackHref = (order, brand) => `${brand.siteUrl}${order.trackPath || `/track-order/${encodeURIComponent(order.id)}`}`;

/* An order and its items (and shipments, if any) from the database, in the
 * shape the templates use. */
function toEmailOrder(order, items = [], shipments = []) {
    return {
        shipments: shipments.map(s => ({
            carrier: carrierLabel(s),
            service: s.service || '',
            trackingNumber: s.tracking_number || '',
            trackingUrl: s.tracking_url || trackingUrlFor(s.carrier, s.tracking_number) || '',
            shippedAt: dayString(s.shipped_at),
            noTracking: Boolean(carrierByKey(s.carrier)?.noTracking),
        })),
        id: order.id,
        createdAt: order.created_at,
        fullName: order.full_name || '',
        email: order.email || '',
        phone: order.phone || '',
        address: order.address || '',
        city: order.city || '',
        zip: order.zip_code || '',
        total: order.total_price,
        paymentMethod: String(order.payment_method || 'COD').toUpperCase(),
        paymentId: order.payment_id || '',
        status: order.status,
        items: items.map(item => {
            const cfg = parseConfig(item.configuration_json);
            return {
                name: item.file_name || 'Part',
                specs: itemSpecs(cfg),
                quantity: Number(item.quantity) || 1,
                unitPrice: item.unit_price,
                lineTotal: item.line_total ?? null,
            };
        }),
    };
}

const partCount = (order) => order.items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

const shipToLines = (order) => [
    order.fullName,
    order.address,
    [order.city, order.zip].filter(Boolean).join(' '),
    order.phone,
];

const paymentLines = (order) => (order.paymentMethod === 'PAYPAL'
    ? ['PayPal', `Paid ${money(order.total)}`, order.paymentId ? `Ref. ${order.paymentId}` : '']
    : ['Cash on delivery', `${money(order.total)} due when your parts arrive`]);

// A short list with red markers: [{ title, text }].
const features = (rows) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
  ${rows.map(row => `
  <tr>
    <td valign="top" width="22" style="padding:7px 0 0;"><div style="width:8px;height:8px;line-height:8px;font-size:0;background:${C.accent};">&nbsp;</div></td>
    <td valign="top" style="padding:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.5;color:${C.text};">
      <strong style="color:${C.ink};">${esc(row.title)}</strong><br>${esc(row.text)}
    </td>
  </tr>`).join('')}
</table>`;

// ── Orders ────────────────────────────────────────────────────────────────

function orderConfirmation({ order }, brand) {
    const first = firstName(order.fullName);
    return {
        subject: `We've received your order #${order.id}`,
        preheader: `${plural(partCount(order), 'part')}, ${money(order.total)}. We'll email you when production starts.`,
        eyebrow: `Order #${order.id}`,
        body: [
            heading(first ? `Thanks, ${first}. We've got your order.` : "Thanks, we've got your order."),
            paragraph(`Order <strong>#${esc(order.id)}</strong> was placed on ${esc(longDate(order.createdAt))}. Our team will review your files and start production, and we'll email you as it moves along.`),
            progress(0),
            button('Track your order', trackHref(order, brand)),
            subheading('Order summary'),
            itemsTable(order.items, order.total),
            '<div style="height:28px;line-height:28px;font-size:0;">&nbsp;</div>',
            columns(block('Ship to', shipToLines(order)), block('Payment', paymentLines(order))),
            paragraph('Questions about this order? Just reply to this email.', { muted: true }),
        ].join(''),
        footnote: `You're receiving this because an order was placed at ${esc(siteLabel(brand))} with ${esc(order.email)}.`,
    };
}

function orderAlert({ order }, brand) {
    const who = order.fullName || order.email;
    const payment = PAYMENT_LABEL[order.paymentMethod] || order.paymentMethod;
    const paidBy = order.paymentMethod === 'PAYPAL' ? 'paid with PayPal' : `paying by ${payment.toLowerCase()}`;
    return {
        subject: `New order #${order.id}: ${money(order.total)} from ${who}`,
        preheader: `${plural(partCount(order), 'part')}, ${payment}. Reply to reach the customer.`,
        eyebrow: `Order #${order.id}`,
        body: [
            heading(`New order #${order.id}`),
            paragraph(`<strong>${esc(who)}</strong> ordered ${plural(partCount(order), 'part')} for <strong>${money(order.total)}</strong>, ${esc(paidBy)}.`),
            button('Open orders in admin', `${brand.siteUrl}/admin/orders`),
            subheading('Customer'),
            details([
                ['Name', order.fullName],
                ['Email', link(order.email, `mailto:${order.email}`), { html: true }],
                ['Phone', order.phone],
                ['Ship to', [order.address, [order.city, order.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')],
                ['Placed', longDate(order.createdAt)],
                ['Payment', order.paymentId ? `${payment} (ref. ${order.paymentId})` : payment],
            ]),
            subheading('Parts'),
            itemsTable(order.items, order.total),
            '<div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>',
            paragraph('Reply to this email to reach the customer.', { muted: true, small: true }),
        ].join(''),
        footnote: 'Sent to the inbox set under Admin › Contact.',
    };
}

const STATUS_COPY = {
    processing: {
        step: 1,
        subject: (o) => `Order #${o.id} is in production`,
        title: () => 'Your parts are in production',
        text: (o) => `We've reviewed your files and order <strong>#${esc(o.id)}</strong> is now being made. We'll let you know as soon as it ships.`,
        cta: ['Track your order', 'track'],
    },
    shipping: {
        step: 2,
        subject: (o) => `Order #${o.id} has shipped`,
        title: () => 'Your order is on its way',
        text: (o) => `Order <strong>#${esc(o.id)}</strong> has left our shop${o.city ? ` and is headed to ${esc(o.city)}` : ''}.`,
        cta: ['Track your order', 'track'],
    },
    completed: {
        step: 3,
        subject: (o) => `Order #${o.id} is complete`,
        title: () => 'Your order is complete',
        text: (o, brand) => `Order <strong>#${esc(o.id)}</strong> is complete. Thanks for choosing ${esc(brand.name)}. We'd be glad to make your next part too.`,
        cta: ['Start a new quote', '/get-instant-pricing'],
    },
    rejected: {
        step: null,
        subject: (o) => `An update on your order #${o.id}`,
        title: (o) => `We can't make order #${o.id} as submitted`,
        text: () => "After reviewing your files, we aren't able to produce this order as it stands. Someone from our team will be in touch with the details, or reply to this email and we'll help you find a way forward.",
        cta: ['View your order', 'track'],
    },
};

// A cta path of 'track' is the order's tracking page; anything else a page of the site.
const ctaHref = (path, order, brand) => (path === 'track' ? trackHref(order, brand) : `${brand.siteUrl}${path}`);

const shortDate = (value) => {
    const d = value ? new Date(value) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
};

// One panel per package: carrier, tracking number (linked) and ship date.
const shipmentDetails = (shipments) => shipments.map(s => details([
    ['Carrier', [s.carrier, s.service].filter(Boolean).join(' · ')],
    s.trackingNumber
        ? ['Tracking', s.trackingUrl ? link(s.trackingNumber, s.trackingUrl) : esc(s.trackingNumber), { html: true }]
        : null,
    ['Shipped', shortDate(s.shippedAt)],
])).join('<div style="height:10px;line-height:10px;font-size:0;">&nbsp;</div>');

// A note the shop typed for this email, under its own heading.
const shopNote = (note, brand) => (note && String(note).trim()
    ? subheading(`A note from ${brand.name}`) + quote(String(note).trim())
    : '');

const orderStatus = (status) => ({ order, note }, brand) => {
    const copy = STATUS_COPY[status];
    const shipments = status === 'shipping' ? (order.shipments || []) : [];
    const tracked = shipments.find(s => s.trackingUrl);
    const cta = tracked
        ? button(shipments.length > 1 ? 'Track your first package' : 'Track your package', tracked.trackingUrl)
        : button(copy.cta[0], ctaHref(copy.cta[1], order, brand));
    // When the button leads elsewhere (the carrier, a new quote), the order page is a link under it.
    const orderLink = tracked || copy.cta[1] !== 'track'
        ? paragraph(`See the status, tracking and our messages for this order on ${link('your order page', trackHref(order, brand))}.`, { muted: true, small: true })
        : '';
    return {
        subject: copy.subject(order),
        preheader: `Order #${order.id}: ${copy.title(order).toLowerCase()}.`,
        eyebrow: `Order #${order.id}`,
        body: [
            heading(copy.title(order)),
            paragraph(copy.text(order, brand)),
            copy.step === null ? '' : progress(copy.step),
            shipments.length ? subheading(shipments.length > 1 ? 'Packages' : 'Shipment') + shipmentDetails(shipments) : '',
            shopNote(note, brand),
            cta,
            orderLink,
            subheading('Order summary'),
            itemsTable(order.items, order.total),
            '<div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>',
            paragraph('Questions? Just reply to this email.', { muted: true }),
        ].join(''),
        footnote: `You're receiving this about an order placed at ${esc(siteLabel(brand))} with ${esc(order.email)}.`,
    };
};

/* Photos sent with a message, two to a row; each is { cid, caption } and
 * travels as an inline attachment. */
const photoGrid = (photos) => {
    const cell = (p) => (p ? `
      <td valign="top" width="50%" style="padding:0 6px 12px;">
        <img src="cid:${esc(p.cid)}" width="268" alt="${esc(p.caption || 'Photo of your parts')}" style="display:block;width:100%;max-width:268px;height:auto;border:0;border-radius:6px;">
        ${p.caption ? `<div style="padding-top:6px;font-family:${FONT};font-size:12px;line-height:1.4;color:${C.muted};">${esc(p.caption)}</div>` : ''}
      </td>` : '<td width="50%" style="padding:0 6px 12px;">&nbsp;</td>');
    const rows = [];
    for (let i = 0; i < photos.length; i += 2) rows.push(`<tr>${cell(photos[i])}${cell(photos[i + 1])}</tr>`);
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px -6px 0;">${rows.join('')}</table>`;
};

// A message the shop writes to the customer about their order.
function orderMessage({ order, subject, message, photos = [] }, brand) {
    const first = firstName(order.fullName);
    const paragraphs = String(message || '').trim().split(/\n{2,}/).filter(Boolean)
        .map(p => paragraph(esc(p).replace(/\n/g, '<br>')));
    const title = String(subject || '').trim() || `An update on your order #${order.id}`;
    return {
        subject: title,
        preheader: String(message || '').replace(/\s+/g, ' ').slice(0, 120),
        eyebrow: `Order #${order.id}`,
        body: [
            heading(first ? `Hi ${first},` : 'Hello,'),
            ...paragraphs,
            photos.length ? subheading(photos.length > 1 ? 'Photos' : 'Photo') + photoGrid(photos) : '',
            button('View your order', trackHref(order, brand)),
            subheading('Order summary'),
            itemsTable(order.items, order.total),
            '<div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>',
            paragraph('Questions? Just reply to this email.', { muted: true }),
        ].join(''),
        footnote: `You're receiving this about order #${esc(order.id)}, placed at ${esc(siteLabel(brand))} with ${esc(order.email)}.`,
    };
}

// ── Quote requests (parts with no instant price) ──────────────────────────

const counts = (list) => (list || []).map(x => `${x.name}${x.count > 1 ? ` ×${x.count}` : ''}`).join(', ');
const inches = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n).toFixed(3) : null);

/* The part's specs as [label, value] rows for details(). */
function quoteSpecRows(cfg = {}) {
    const sizeIn = cfg.size_in || {};
    const size = inches(sizeIn.l) && inches(sizeIn.w) ? `${inches(sizeIn.l)} × ${inches(sizeIn.w)} in` : '';
    const finishes = (cfg.finishes || []).map(f => (f.color ? `${f.title} (${f.color})` : f.title)).join(', ');
    const bends = Number(cfg.bends);
    return [
        ['Material', cfg.material],
        ['Thickness', cfg.thickness],
        ['Process', cfg.process],
        ['Finishing', finishes],
        ['Tapped holes', counts(cfg.taps)],
        ['Countersinks', counts(cfg.countersinks)],
        ['Hardware', counts(cfg.hardware)],
        ['Bends', bends > 0 ? String(bends) : ''],
        ['Size', size],
    ];
}

/* A quote request row from the database, in the shape the templates use. */
function toEmailQuote(row = {}) {
    const parse = (v, fallback) => {
        if (typeof v !== 'string') return v || fallback;
        try { return JSON.parse(v); } catch { return fallback; }
    };
    const cfg = parse(row.configuration_json, {});
    return {
        id: row.id,
        ref: `Q-${row.id}`,
        createdAt: row.created_at,
        name: row.name || '',
        email: row.email || '',
        phone: row.phone || '',
        company: row.company || '',
        message: row.message || '',
        quantity: Number(row.quantity) || 1,
        fileName: row.file_name || 'Your part',
        specs: quoteSpecRows(cfg),
        reasons: (parse(row.reasons, []) || []).map(r => r?.message).filter(Boolean),
        hasAccount: Boolean(row.user_id),
        unitPrice: row.quoted_unit_price,
        quotedQuantity: Number(row.quoted_quantity) || Number(row.quantity) || 1,
        total: row.quoted_total,
        leadTime: row.lead_time || '',
        reply: row.reply_message || '',
    };
}

// A plain bulleted list (each item is text).
const bullets = (items) => `
<ul style="margin:0 0 6px;padding:0 0 0 20px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.text};">
  ${items.map(text => `<li style="margin:0 0 6px;">${esc(text)}</li>`).join('')}
</ul>`;

const partDetails = (request) => details([['File', request.fileName], ['Quantity', `${request.quantity} pcs`], ...request.specs]);

function quoteReceived({ request }, brand) {
    const first = firstName(request.name);
    return {
        subject: `We've received your quote request ${request.ref}`,
        preheader: `We'll review ${request.fileName} and email you a price and lead time.`,
        eyebrow: `Quote ${request.ref}`,
        body: [
            heading(first ? `Thanks, ${first}. We've got your request.` : "Thanks, we've got your request."),
            paragraph(`Our team will review <strong>${esc(request.fileName)}</strong> and email you a price and lead time. Your reference is <strong>${esc(request.ref)}</strong>.`),
            subheading('What happens next'),
            features([
                { title: 'We review your part', text: 'We check the file, the material and the options you chose.' },
                { title: 'You get a price by email', text: `Price per part, total and lead time, sent to ${request.email}.` },
                { title: 'Reply to accept', text: "Happy with the price? Reply to that email and we'll start production." },
            ]),
            request.hasAccount ? button('View your quote requests', `${brand.siteUrl}/orders`) : '',
            subheading('Your part'),
            partDetails(request),
            request.reasons.length ? subheading('Why it needs a quote') + bullets(request.reasons) : '',
            request.message ? subheading('Your notes') + quote(request.message) : '',
            '<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>',
            paragraph('Questions? Just reply to this email.', { muted: true }),
        ].join(''),
        footnote: `You're receiving this because a quote was requested at ${esc(siteLabel(brand))} with ${esc(request.email)}.`,
    };
}

function quoteAlert({ request }, brand) {
    const who = request.name || request.email;
    return {
        subject: `New quote request ${request.ref}: ${request.fileName} × ${request.quantity} from ${who}`.slice(0, 200),
        preheader: request.reasons[0] || 'No instant price for this part. Reply to reach the customer.',
        eyebrow: `Quote ${request.ref}`,
        body: [
            heading(`New quote request ${request.ref}`),
            paragraph(`<strong>${esc(who)}</strong> asked for a price on ${plural(request.quantity, 'piece')} of <strong>${esc(request.fileName)}</strong>. The site could not price it instantly.`),
            button('Open in admin', `${brand.siteUrl}/admin/quotes/${request.id}`),
            subheading('Customer'),
            details([
                ['Name', request.name],
                ['Email', link(request.email, `mailto:${request.email}`), { html: true }],
                ['Phone', request.phone],
                ['Company', request.company],
                ['Account', request.hasAccount ? 'Signed in' : 'Guest'],
                ['Received', longDate(request.createdAt)],
            ]),
            subheading('Part'),
            partDetails(request),
            request.reasons.length ? subheading('Why there was no instant price') + bullets(request.reasons) : '',
            request.message ? subheading('Notes from the customer') + quote(request.message) : '',
            '<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>',
            paragraph('The file is attached to the request in admin. Reply to this email to reach the customer.', { muted: true, small: true }),
        ].join(''),
        footnote: 'Sent to the inbox set under Admin › Contact.',
    };
}

function quoteReply({ request }, brand) {
    const first = firstName(request.name);
    const qty = request.quotedQuantity;
    const acceptHref = brand.contactEmail
        ? `mailto:${brand.contactEmail}?subject=${encodeURIComponent(`Accept quote ${request.ref}`)}`
        : '';
    return {
        subject: `Your quote ${request.ref}: ${money(request.total)} for ${plural(qty, 'part')}`,
        preheader: `${money(request.unitPrice)} per part${request.leadTime ? `, ${request.leadTime}` : ''}. Reply to accept.`,
        eyebrow: `Quote ${request.ref}`,
        body: [
            heading(first ? `Hi ${first}, your quote is ready` : 'Your quote is ready'),
            paragraph(`Here's our price for <strong>${esc(request.fileName)}</strong>.`),
            details([
                ['Price per part', money(request.unitPrice)],
                ['Quantity', `${qty} pcs`],
                ['Total', `<strong>${money(request.total)}</strong>`, { html: true }],
                ['Lead time', request.leadTime],
            ]),
            shopNote(request.reply, brand),
            acceptHref ? button('Reply to accept', acceptHref) + '<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>' : '',
            paragraph(`To accept, reply to this email and we'll get your parts into production. Have more parts? ${link('Get instant pricing', `${brand.siteUrl}/get-instant-pricing`)} on our website.`),
            subheading('Your part'),
            partDetails({ ...request, quantity: qty }),
            '<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>',
            paragraph('Questions about this quote? Just reply to this email.', { muted: true }),
        ].join(''),
        footnote: `You're receiving this about quote request ${esc(request.ref)}, sent from ${esc(siteLabel(brand))} with ${esc(request.email)}.`,
    };
}

// ── Accounts and newsletter ───────────────────────────────────────────────

function welcome({ user }, brand) {
    const first = firstName(user.name);
    return {
        subject: `Welcome to ${brand.name}`,
        preheader: 'Your account is ready. Upload a STEP file for an instant price.',
        body: [
            heading(first ? `Welcome, ${first}.` : 'Welcome aboard.'),
            paragraph(`Your ${esc(brand.name)} account is ready. Upload a STEP file to get an instant price on laser-cut, formed and finished sheet metal parts, then order in a few clicks.`),
            features([
                { title: 'Instant pricing', text: 'Prices update as you pick material, thickness and finish.' },
                { title: 'Every order in one place', text: 'Follow production and shipping from your account.' },
                { title: 'Real people behind it', text: 'Questions about a design? Reply to this email.' },
            ]),
            button('Get instant pricing', `${brand.siteUrl}/get-instant-pricing`),
        ].join(''),
        footnote: `You're receiving this because an account was created at ${esc(siteLabel(brand))} with ${esc(user.email)}.`,
    };
}

function newsletterWelcome({ email }, brand) {
    return {
        subject: `You're subscribed to ${brand.name} updates`,
        preheader: 'Occasional news on materials, finishes and the shop.',
        body: [
            heading("You're on the list"),
            paragraph("Thanks for subscribing. We'll send occasional updates on new materials, finishing options and what's happening in the shop."),
            button('Explore materials', `${brand.siteUrl}/metals`),
        ].join(''),
        footnote: `You're receiving this because ${esc(email)} subscribed at ${esc(siteLabel(brand))}. Don't want these emails? Reply and we'll take you off the list.`,
    };
}

// ── Staff ─────────────────────────────────────────────────────────────────

function contactMessage({ name, email, company, topic, message, receivedAt }, brand) {
    const first = firstName(name) || 'them';
    return {
        subject: `Website message: ${topic} from ${name}`.slice(0, 200),
        preheader: String(message).replace(/\s+/g, ' ').slice(0, 120),
        eyebrow: topic,
        body: [
            heading('New message from the website'),
            details([
                ['From', name],
                ['Email', link(email, `mailto:${email}`), { html: true }],
                ['Company', company],
                ['Topic', topic],
                ['Received', `${longDate(receivedAt)}, ${new Date(receivedAt || Date.now()).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`],
            ]),
            subheading('Message'),
            quote(message),
            button(`Reply to ${first}`, `mailto:${email}?subject=${encodeURIComponent(`Re: ${topic}`)}`),
            paragraph('Or just reply to this email. It goes straight to them.', { muted: true, small: true }),
        ].join(''),
        footnote: `Sent from the contact form at ${esc(siteLabel(brand))}.`,
    };
}

function testEmail({ config }, brand) {
    const sentAt = new Date();
    return {
        subject: `Test email from ${brand.name}`,
        preheader: 'Your email settings work.',
        eyebrow: 'Test',
        body: [
            heading('Your email settings work'),
            paragraph(`This is a test from Admin › Email Configuration. If you're reading it, ${esc(brand.name)} can send order confirmations, status updates and the other emails customers and staff receive.`),
            details([
                ['SMTP server', `${config.smtp_host}:${config.smtp_port}`],
                ['Security', config.encryption_type === 'NONE' ? 'None' : config.encryption_type],
                ['Sent from', `${config.sender_name || brand.name} <${config.email}>`],
                ['Sent at', `${longDate(sentAt)}, ${sentAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`],
            ]),
        ].join(''),
        footnote: 'Sent from Admin › Email Configuration.',
    };
}

// ── Registry ──────────────────────────────────────────────────────────────

const SAMPLE_ORDER = {
    id: 1042,
    createdAt: new Date().toISOString(),
    fullName: 'Jordan Rivera',
    email: 'jordan@example.com',
    phone: '+1 (214) 555-0182',
    address: '2400 Commerce St, Suite 120',
    city: 'Dallas',
    zip: '75201',
    total: 873.52,
    paymentMethod: 'COD',
    paymentId: '',
    status: 'pending',
    items: [
        { name: 'mounting-bracket.step', specs: ['COLD ROLLED (1008)', '.120" thick', 'Laser Cutting', 'Powder Coating (Gloss Black)', '2 bends'], quantity: 10, unitPrice: 42.15 },
        { name: 'enclosure-lid.step', specs: ['5052 H32 ALUMINUM', '.090" thick', 'Laser Cutting'], quantity: 4, unitPrice: 112.97 },
    ],
};

const SAMPLE_QUOTE = {
    id: 214,
    created_at: new Date().toISOString(),
    user_id: 1,
    name: 'Jordan Rivera',
    email: 'jordan@example.com',
    phone: '+1 (214) 555-0182',
    company: 'Rivera Fabrication',
    message: 'We need these by the end of the month. Can you hold ±0.005" on the hole positions?',
    quantity: 25,
    file_name: 'mounting-bracket.step',
    configuration_json: {
        material: '5052 H32 ALUMINUM',
        thickness: '.375"',
        process: 'Laser Cutting',
        finishes: [{ title: 'Powder Coating', color: 'Gloss Black' }],
        taps: [{ name: '1/4-20', count: 4 }],
        bends: 0,
        size_in: { l: 8.25, w: 4, t: 0.375 },
    },
    reasons: [{ code: 'NO_SHEET_COST_ROW', message: 'We don\'t have a stock price for 5052 H32 ALUMINUM at .375".' }],
    quoted_unit_price: 18.4,
    quoted_quantity: 25,
    quoted_total: 460,
    lead_time: '7 to 10 business days',
    reply_message: 'We can hold ±0.005" on the holes. Price includes deburring and the powder coat.',
};
const quoteSample = () => ({ request: toEmailQuote(SAMPLE_QUOTE) });

const orderSample = () => ({ order: SAMPLE_ORDER });
const shippedSample = () => ({
    order: {
        ...SAMPLE_ORDER,
        shipments: [{ carrier: 'UPS', service: 'Ground', trackingNumber: '1Z999AA10123456784', trackingUrl: 'https://www.ups.com/track?loc=en_US&tracknum=1Z999AA10123456784', shippedAt: new Date().toISOString() }],
    },
});

const TEMPLATES = {
    'order-confirmation': { label: 'Order received', audience: 'Customer', render: orderConfirmation, sample: orderSample },
    'order-processing': { label: 'Order in production', audience: 'Customer', render: orderStatus('processing'), sample: orderSample },
    'order-shipping': { label: 'Order shipped', audience: 'Customer', render: orderStatus('shipping'), sample: shippedSample },
    'order-completed': { label: 'Order completed', audience: 'Customer', render: orderStatus('completed'), sample: orderSample },
    'order-rejected': { label: 'Order rejected', audience: 'Customer', render: orderStatus('rejected'), sample: orderSample },
    'order-message': {
        label: 'Message about an order',
        audience: 'Customer',
        render: orderMessage,
        sample: () => ({
            order: SAMPLE_ORDER,
            subject: 'Your parts are ready for pickup',
            message: 'Good news: all 14 parts are cut, formed and coated.\n\nYou can pick them up at our shop Monday to Friday, 8 am to 5 pm. Bring your order number and we will have them ready at the front desk.',
        }),
    },
    'quote-received': { label: 'Quote request received', audience: 'Customer', render: quoteReceived, sample: quoteSample },
    'quote-reply': { label: 'Quote ready (price and lead time)', audience: 'Customer', render: quoteReply, sample: quoteSample },
    welcome: { label: 'Welcome (new account)', audience: 'Customer', render: welcome, sample: () => ({ user: { name: 'Jordan Rivera', email: 'jordan@example.com' } }) },
    'newsletter-welcome': { label: 'Newsletter welcome', audience: 'Subscriber', render: newsletterWelcome, sample: () => ({ email: 'jordan@example.com' }) },
    'order-alert': { label: 'New order alert', audience: 'Staff', render: orderAlert, sample: orderSample },
    'quote-alert': { label: 'New quote request alert', audience: 'Staff', render: quoteAlert, sample: quoteSample },
    'contact-message': {
        label: 'Website message',
        audience: 'Staff',
        render: contactMessage,
        sample: () => ({
            name: 'Jordan Rivera',
            email: 'jordan@example.com',
            company: 'Rivera Fabrication',
            topic: 'Quote question',
            message: 'Hi, we need 200 of these brackets in 304 stainless by the end of the month.\n\nCan you hold ±0.005" on the hole positions?',
            receivedAt: new Date().toISOString(),
        }),
    },
    test: { label: 'Test email', audience: 'Staff', render: testEmail, sample: null },
};

module.exports = { TEMPLATES, STATUS_COPY, toEmailOrder, itemSpecs, toEmailQuote };
