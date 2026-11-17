/*
 * Route plumbing shared by every router.
 *
 *   router.get('/x', route('load the x', async (req, res) => ok(res, data)));
 *
 * Throw an HttpError (badRequest / notFound / …) for anything the caller
 * did wrong: it becomes { success: false, error } with that status. Any
 * other error is logged and answered with a 500 and "Could not <label>."
 * The JSON shape ({ success, data | error }) is the one the client expects.
 */

class HttpError extends Error {
    constructor(status, message, extra = {}) {
        super(message);
        this.status = status;
        this.extra = extra;
    }
}

const badRequest = (message, extra) => new HttpError(400, message, extra);
const unauthorized = (message = 'Please sign in.') => new HttpError(401, message);
const forbidden = (message = 'You do not have access to this.') => new HttpError(403, message);
const notFound = (what = 'Item') => new HttpError(404, `${what} not found.`);
const conflict = (message, extra) => new HttpError(409, message, extra);

/* Throw-style helpers, for one-liners: fail('Add a name.') */
const fail = (message, extra) => { throw badRequest(message, extra); };

function sendError(res, err, label) {
    if (err instanceof HttpError) {
        return res.status(err.status).json({ success: false, error: err.message, ...(err.extra || {}) });
    }
    console.error(`[${label}]`, err);
    return res.status(500).json({ success: false, error: `Could not ${label}. Please try again.` });
}

/* Wraps an async handler; label says what it does ("save the metal"). */
const route = (label, handler) => async (req, res, next) => {
    try {
        await handler(req, res, next);
    } catch (err) {
        if (res.headersSent) { console.error(`[${label}] after response started`, err); return; }
        sendError(res, err, label);
    }
};

const ok = (res, data, extra = {}) => res.json({ success: true, ...(data === undefined ? {} : { data }), ...extra });
const created = (res, data, extra = {}) => res.status(201).json({ success: true, ...(data === undefined ? {} : { data }), ...extra });

/* The row a query returned, or a 404. */
const one = (result, what) => {
    if (!result || !result.rowCount) throw notFound(what);
    return result.rows[0];
};

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict, fail, route, sendError, ok, created, one };
