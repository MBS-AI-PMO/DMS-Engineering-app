/*
 * Reading request input. Each reader returns a clean value or throws a 400
 * (HttpError) with a message an admin or customer can act on. `label` is
 * how the field is named in that message.
 *
 *   const name = text(body.name, 'Name', { required: true, max: 120 });
 *   const price = number(body.price, 'Price', { min: 0 });
 */
const { badRequest } = require('./http');

const blank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

function text(value, label, { required = false, max = 2000, min = 0, trim = true } = {}) {
    if (blank(value)) {
        if (required) throw badRequest(`${label} is required.`);
        return null;
    }
    if (typeof value !== 'string' && typeof value !== 'number') throw badRequest(`${label} must be text.`);
    const s = trim ? String(value).trim() : String(value);
    if (s.length > max) throw badRequest(`${label} must be ${max} characters or fewer.`);
    if (s.length < min) throw badRequest(`${label} must be at least ${min} characters.`);
    return s;
}

function number(value, label, { required = false, min = -Infinity, max = Infinity, integer = false, allowNull = true } = {}) {
    if (blank(value)) {
        if (required || !allowNull) throw badRequest(`${label} is required.`);
        return null;
    }
    const n = typeof value === 'number' ? value : Number(String(value).trim());
    if (!Number.isFinite(n)) throw badRequest(`${label} must be a number.`);
    if (integer && !Number.isInteger(n)) throw badRequest(`${label} must be a whole number.`);
    if (n < min) throw badRequest(`${label} must be at least ${min}.`);
    if (n > max) throw badRequest(`${label} must be at most ${max}.`);
    return n;
}

const integer = (value, label, opts = {}) => number(value, label, { ...opts, integer: true });

/* A positive integer id from a URL param or body. */
function id(value, label = 'Id') {
    const n = Number.parseInt(value, 10);
    if (!Number.isInteger(n) || n <= 0 || String(n) !== String(value).trim()) throw badRequest(`${label} is not valid.`);
    return n;
}

function bool(value, fallback = false) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    return ['true', '1', 'on', 'yes'].includes(String(value).toLowerCase());
}

function oneOf(value, allowed, label, { required = true } = {}) {
    if (blank(value) && !required) return null;
    if (!allowed.includes(value)) throw badRequest(`${label} must be one of: ${allowed.join(', ')}.`);
    return value;
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
function email(value, label = 'Email', { required = false } = {}) {
    const s = text(value, label, { required, max: 254 });
    if (s === null) return null;
    if (!EMAIL_RE.test(s)) throw badRequest(`${label} is not a valid email address.`);
    return s.toLowerCase();
}

function url(value, label, { required = false, max = 2000 } = {}) {
    const s = text(value, label, { required, max });
    if (s === null) return null;
    if (!/^https?:\/\/[^\s]+$/i.test(s)) throw badRequest(`${label} must start with http:// or https://`);
    return s;
}

/* A calendar day, "2026-11-17". */
function day(value, label, { required = false } = {}) {
    const s = text(value, label, { required, max: 10 });
    if (s === null) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(new Date(`${s}T00:00:00Z`).getTime())) throw badRequest(`${label} must be a date.`);
    return s;
}

/* JSON sent as an object, or as a string (multipart forms). */
function json(value, label, { required = false, fallback = null } = {}) {
    if (blank(value)) {
        if (required) throw badRequest(`${label} is required.`);
        return fallback;
    }
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch { throw badRequest(`${label} is not valid.`); }
}

function list(value, label, { max = 1000 } = {}) {
    const arr = json(value, label, { fallback: [] });
    if (!Array.isArray(arr)) throw badRequest(`${label} must be a list.`);
    if (arr.length > max) throw badRequest(`${label} has too many entries (max ${max}).`);
    return arr;
}

module.exports = { blank, text, number, integer, id, bool, oneOf, email, url, day, json, list, EMAIL_RE };
