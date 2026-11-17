import { adminAuthHeaders, authHeaders } from '../utils/api';

/*
 * One way to call the backend. Service modules (services/admin/*.js) are
 * built on this; pages call services, never fetch() directly.
 *
 *   const http = createHttp({ admin: true });
 *   const metals = await http.get('/metals');          // -> body.data ?? body
 *   await http.post('/metals', { name });               // JSON body
 *   await http.post('/metals/3/image', formData);       // multipart
 *   await http.download('/admin/orders/7/files.zip', 'Order-7.zip');
 *
 * Errors throw an Error whose message is the server's `error` text (or a
 * plain fallback), with .status and .body attached.
 */

export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export class ApiError extends Error {
    constructor(message, status, body) {
        super(message);
        this.status = status;
        this.body = body;
    }
}

const fallbackMessage = (status) => (status === 401 ? 'Please sign in again.'
    : status === 403 ? 'You do not have access to this.'
        : status === 404 ? 'Not found.'
            : status >= 500 ? 'The server had a problem. Please try again.'
                : `Request failed (${status}).`);

export function createHttp({ admin = false, base = API_BASE } = {}) {
    const headersFor = (body) => ({
        ...(body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(admin ? adminAuthHeaders() : authHeaders()),
    });

    async function request(method, path, body, { raw = false, signal, query } = {}) {
        const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()}` : '';
        let res;
        try {
            res = await fetch(`${base}${path}${qs}`, {
                method,
                credentials: 'include',
                signal,
                headers: headersFor(body),
                body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
            });
        } catch (err) {
            if (err.name === 'AbortError') throw err;
            throw new ApiError('Could not reach the server. Check your connection and try again.', 0, null);
        }
        if (raw) {
            if (!res.ok) {
                let data = null;
                try { data = await res.json(); } catch { /* not JSON */ }
                throw new ApiError(data?.error || fallbackMessage(res.status), res.status, data);
            }
            return res;
        }
        let data = null;
        try { data = await res.json(); } catch { /* empty body */ }
        if (!res.ok || data?.success === false) throw new ApiError(data?.error || data?.message || fallbackMessage(res.status), res.status, data);
        return data;
    }

    // Most routes answer { success, data }; get/post/… return data when present.
    const unwrap = (body) => (body && typeof body === 'object' && 'data' in body ? body.data : body);

    return {
        request,
        get: (path, opts) => request('GET', path, undefined, opts).then(unwrap),
        post: (path, body, opts) => request('POST', path, body, opts).then(unwrap),
        put: (path, body, opts) => request('PUT', path, body, opts).then(unwrap),
        patch: (path, body, opts) => request('PATCH', path, body, opts).then(unwrap),
        delete: (path, opts) => request('DELETE', path, undefined, opts).then(unwrap),
        /* The whole JSON body, for routes that put more than `data` in it. */
        getBody: (path, opts) => request('GET', path, undefined, opts),
        postBody: (path, body, opts) => request('POST', path, body, opts),
        putBody: (path, body, opts) => request('PUT', path, body, opts),
        /* A file the browser should save (sends the auth header, unlike a link). */
        async download(path, filename) {
            const res = await request('GET', path, undefined, { raw: true });
            const url = URL.createObjectURL(await res.blob());
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || '';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        },
    };
}

/* For admin screens. */
export const adminHttp = createHttp({ admin: true });
/* For the public site and signed-in customers. */
export const http = createHttp();

/* Builds FormData from an object; arrays/objects are sent as JSON text,
 * File/Blob values as files. */
export function toFormData(fields) {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (value instanceof Blob) form.append(key, value);
        else if (Array.isArray(value) && value.every(v => v instanceof Blob)) value.forEach(v => form.append(key, v));
        else if (typeof value === 'object') form.append(key, JSON.stringify(value));
        else form.append(key, String(value));
    });
    return form;
}
