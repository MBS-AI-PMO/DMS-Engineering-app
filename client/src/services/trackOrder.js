import { http } from './http';

/*
 * Public order tracking (backend/routes/trackOrder.js). A successful lookup
 * or an emailed link leaves a cookie that lets this browser open the order
 * again; a signed-in customer opens their own orders without one.
 *
 * Both resolve to { view, access } where access is 'account' (signed in as
 * its owner), 'link' (this browser holds its link) or 'email' (just looked
 * up). Errors are ApiErrors: 404 with body.needsEmail (ask for the email),
 * 404 (no such order and email), 429 (too many tries), 400 (bad input).
 */
const unpack = (body) => ({ view: body.data, access: body.access || null });

// One request per order at a time: callers asking again meanwhile share it.
const inFlight = new Map();

export const trackOrderService = {
    lookup: (order, email) => http.postBody('/track-order/lookup', { order, email }).then(unpack),
    get(number) {
        const key = String(number);
        if (!inFlight.has(key)) {
            const request = http.getBody(`/track-order/${encodeURIComponent(key)}`).then(unpack)
                .finally(() => inFlight.delete(key));
            inFlight.set(key, request);
        }
        return inFlight.get(key);
    },
};
