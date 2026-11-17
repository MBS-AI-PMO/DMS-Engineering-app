/*
 * The look every email shares: a dark band with the logo, a thin red rule,
 * a white card holding the message, and the company's contact details
 * underneath. Built from tables with inline styles, since that is what
 * email clients (Gmail, Outlook, Apple Mail) render the same way.
 */

const C = {
    page: '#f2f2f3',
    card: '#ffffff',
    dark: '#0b0c0f',
    ink: '#0b0c0f',
    text: '#3f424a',
    muted: '#6b6f78',
    faint: '#9a9ea6',
    rule: '#e6e7ea',
    panel: '#f7f7f8',
    accent: '#dc2626',
    onDark: '#f4f4f5',
};
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const money = (value) => {
    const num = Number(value);
    return Number.isFinite(num)
        ? num.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
        : '—';
};

const longDate = (value) => {
    const date = value ? new Date(value) : new Date();
    return Number.isNaN(date.getTime())
        ? ''
        : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

// ── Building blocks (each returns an HTML string) ─────────────────────────

const heading = (text) =>
    `<h1 style="margin:0 0 14px;font-family:${FONT};font-size:24px;line-height:1.25;font-weight:700;color:${C.ink};">${escapeHtml(text)}</h1>`;

const subheading = (text) =>
    `<h2 style="margin:32px 0 12px;font-family:${FONT};font-size:13px;line-height:1.4;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.muted};">${escapeHtml(text)}</h2>`;

// Takes HTML, so callers escape what they put in.
const paragraph = (html, { muted = false, small = false } = {}) =>
    `<p style="margin:0 0 14px;font-family:${FONT};font-size:${small ? 13 : 15}px;line-height:1.6;color:${muted ? C.muted : C.text};">${html}</p>`;

const button = (label, href) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px;">
  <tr>
    <td bgcolor="${C.accent}" style="border-radius:6px;">
      <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:13px 24px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;

const link = (label, href) =>
    `<a href="${escapeHtml(href)}" target="_blank" style="color:${C.accent};text-decoration:underline;">${escapeHtml(label)}</a>`;

/* Label/value rows on a light panel. Values are text unless a row passes
 * { html: true }. Rows with no value are left out. */
const details = (rows) => {
    const body = rows
        .filter(row => row && row[1] !== undefined && row[1] !== null && String(row[1]).trim() !== '')
        .map(([label, value, opts = {}], i) => `
    <tr>
      <td valign="top" style="padding:${i ? 10 : 0}px 16px 0 0;width:120px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${escapeHtml(label)}</td>
      <td valign="top" style="padding:${i ? 10 : 0}px 0 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${C.ink};word-break:break-word;">${opts.html ? value : escapeHtml(value)}</td>
    </tr>`).join('');
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.panel}" style="border-radius:8px;">
  <tr><td style="padding:18px 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table>
  </td></tr>
</table>`;
};

// A block of free text (a customer's message), line breaks kept.
const quote = (text) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:3px solid ${C.accent};">
  <tr><td style="padding:4px 0 4px 16px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.ink};white-space:pre-wrap;word-break:break-word;">${escapeHtml(text)}</td></tr>
</table>`;

/* The parts of an order: name and specs on the left, line total on the
 * right, then the order total. Each item is
 * { name, specs: [string], quantity, unitPrice }. */
const itemsTable = (items, total) => {
    const rows = items.map((item, i) => {
        const qty = Number(item.quantity) || 1;
        // The line total the order was priced at; older orders only have a unit price.
        const line = item.lineTotal !== null && item.lineTotal !== undefined ? Number(item.lineTotal) : Number(item.unitPrice) * qty;
        const specs = (item.specs || []).filter(Boolean);
        return `
    <tr>
      <td valign="top" style="padding:16px 12px 16px 0;${i ? `border-top:1px solid ${C.rule};` : ''}">
        <div style="font-family:${FONT};font-size:14px;line-height:1.4;font-weight:600;color:${C.ink};word-break:break-all;">${escapeHtml(item.name)}</div>
        ${specs.length ? `<div style="margin-top:4px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${specs.map(escapeHtml).join(' &middot; ')}</div>` : ''}
        <div style="margin-top:4px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">Qty ${qty} &times; ${money(item.unitPrice)}</div>
      </td>
      <td valign="top" align="right" style="padding:16px 0;${i ? `border-top:1px solid ${C.rule};` : ''}font-family:${FONT};font-size:14px;line-height:1.4;font-weight:600;color:${C.ink};white-space:nowrap;">${money(line)}</td>
    </tr>`;
    }).join('');

    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  ${rows}
  <tr>
    <td style="padding:16px 12px 0 0;border-top:2px solid ${C.ink};font-family:${FONT};font-size:15px;font-weight:700;color:${C.ink};">Total</td>
    <td align="right" style="padding:16px 0 0;border-top:2px solid ${C.ink};font-family:${FONT};font-size:17px;font-weight:700;color:${C.ink};white-space:nowrap;">${money(total)}</td>
  </tr>
</table>`;
};

/* Where an order is: Received → In production → Shipped → Completed, the
 * steps reached drawn in red. Bars rather than dots, since Outlook cannot
 * round corners. */
const STEPS = ['Received', 'In production', 'Shipped', 'Completed'];
const progress = (reached) => {
    const cells = STEPS.map((label, i) => {
        const on = i <= reached;
        return `
    <td width="25%" valign="top" style="padding:0 ${i < STEPS.length - 1 ? 4 : 0}px 0 0;">
      <div style="height:4px;line-height:4px;font-size:0;background:${on ? C.accent : C.rule};border-radius:2px;">&nbsp;</div>
      <div style="padding-top:8px;font-family:${FONT};font-size:12px;line-height:1.3;font-weight:${i === reached ? 700 : 500};color:${on ? C.ink : C.faint};">${label}</div>
    </td>`;
    }).join('');
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 8px;">
  <tr>${cells}</tr>
</table>`;
};

// Two blocks side by side on wide screens, stacked on phones.
const columns = (left, right) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="em-stack">
  <tr>
    <td valign="top" width="50%" style="padding:0 12px 0 0;">${left}</td>
    <td valign="top" width="50%" style="padding:0 0 0 12px;">${right}</td>
  </tr>
</table>`;

const block = (title, lines) => `
<div style="font-family:${FONT};font-size:13px;line-height:1.4;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.muted};margin:0 0 8px;">${escapeHtml(title)}</div>
<div style="font-family:${FONT};font-size:14px;line-height:1.6;color:${C.ink};margin:0 0 20px;word-break:break-word;">${lines.filter(Boolean).map(escapeHtml).join('<br>')}</div>`;

// ── The page ──────────────────────────────────────────────────────────────

/* brand: { name, siteUrl, contactEmail, phone, address }
 * logoSrc: "cid:…" when sending, a data: URL for the admin preview, or
 * empty for the name in text. */
function renderLayout({ brand, subject, preheader = '', eyebrow = '', body, footnote = '', logoSrc = '', logo = null }) {
    const siteUrl = brand.siteUrl;
    const siteLabel = siteUrl.replace(/^https?:\/\//, '');

    const logoHtml = logoSrc && logo
        ? `<img src="${escapeHtml(logoSrc)}" width="${logo.width}" height="${logo.height}" alt="${escapeHtml(brand.name)}" style="display:block;border:0;outline:none;width:${logo.width}px;height:${logo.height}px;">`
        : `<span style="font-family:${FONT};font-size:22px;font-weight:800;letter-spacing:0.04em;color:${C.onDark};">${escapeHtml(brand.name)}</span>`;

    const contactBits = [
        brand.phone ? `<a href="tel:${escapeHtml(brand.phone.replace(/[^\d+]/g, ''))}" style="color:${C.muted};text-decoration:none;">${escapeHtml(brand.phone)}</a>` : '',
        brand.contactEmail ? `<a href="mailto:${escapeHtml(brand.contactEmail)}" style="color:${C.muted};text-decoration:none;">${escapeHtml(brand.contactEmail)}</a>` : '',
        `<a href="${escapeHtml(siteUrl)}" style="color:${C.muted};text-decoration:none;">${escapeHtml(siteLabel)}</a>`,
    ].filter(Boolean).join('&nbsp;&nbsp;&middot;&nbsp;&nbsp;');

    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title>
<style>
  body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
  a { color: ${C.accent}; }
  @media (max-width: 620px) {
    .em-outer { padding: 0 !important; }
    .em-head { padding: 20px 24px !important; border-radius: 0 !important; }
    .em-card { padding: 32px 24px !important; border-radius: 0 !important; }
    .em-foot { padding: 24px 24px 32px !important; }
    .em-stack td { display: block !important; width: 100% !important; padding: 0 !important; }
    .em-eyebrow { display: none !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;" data-preheader>${escapeHtml(preheader)}${'&#8203;&nbsp;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};">
  <tr>
    <td align="center" class="em-outer" style="padding:32px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <tr>
          <td class="em-head" bgcolor="${C.dark}" style="padding:22px 40px;background:${C.dark};border-radius:10px 10px 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle"><a href="${escapeHtml(siteUrl)}" target="_blank" style="text-decoration:none;">${logoHtml}</a></td>
                ${eyebrow ? `<td valign="middle" align="right" class="em-eyebrow" style="font-family:${FONT};font-size:13px;font-weight:600;letter-spacing:0.04em;color:${C.onDark};opacity:0.7;white-space:nowrap;">${escapeHtml(eyebrow)}</td>` : ''}
              </tr>
            </table>
          </td>
        </tr>
        <tr><td height="3" bgcolor="${C.accent}" style="height:3px;line-height:3px;font-size:0;background:${C.accent};">&nbsp;</td></tr>
        <tr>
          <td class="em-card" bgcolor="${C.card}" style="padding:40px;background:${C.card};border-radius:0 0 10px 10px;">
            ${body}
          </td>
        </tr>
        <tr>
          <td class="em-foot" align="center" style="padding:28px 40px 8px;font-family:${FONT};font-size:12px;line-height:1.7;color:${C.muted};">
            <div style="font-size:13px;font-weight:700;color:${C.ink};">${escapeHtml(brand.name)}</div>
            ${brand.address ? `<div>${escapeHtml(brand.address)}</div>` : ''}
            <div>${contactBits}</div>
            ${footnote ? `<div style="margin-top:14px;color:${C.faint};">${footnote}</div>` : ''}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/* A plain-text copy of an email, sent alongside the HTML. Mail filters
 * trust messages that have one, and some readers only show text. */
function htmlToText(html) {
    const decode = (s) => s
        .replace(/&nbsp;/g, ' ')
        .replace(/&#8203;/g, '')
        .replace(/&middot;/g, '·')
        .replace(/&times;/g, '×')
        .replace(/&rarr;/g, '→')
        .replace(/&mdash;/g, '—')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
    const strip = (s) => s.replace(/<[^>]+>/g, '');

    return decode(html
        .replace(/<head[\s\S]*?<\/head>/i, '')
        .replace(/<div[^>]*data-preheader[^>]*>[\s\S]*?<\/div>/i, '')
        .replace(/<img[^>]*>/gi, '')
        .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, inner) => {
            const label = strip(inner).replace(/\s+/g, ' ').trim();
            const url = decode(href);
            if (!label || url.startsWith('tel:')) return label;
            const target = url.startsWith('mailto:') ? url.slice(7).split('?')[0] : url;
            return label === target || target.endsWith(label) ? label : `${label} (${target})`;
        })
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|h1|h2|div|tr|table)>/gi, '\n')
        .replace(/<\/td>/gi, '   ')
        .replace(/<[^>]+>/g, ''))
        .split('\n')
        .map(line => line.replace(/[ \t]+/g, ' ').trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

module.exports = {
    C, FONT, escapeHtml, money, longDate,
    heading, subheading, paragraph, button, link, details, quote, itemsTable, progress, columns, block,
    renderLayout, htmlToText,
};
