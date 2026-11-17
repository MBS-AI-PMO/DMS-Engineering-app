/*
 * An in-memory limit on how often something may happen, per sender and
 * across the site (behind a proxy many people can share one address, so the
 * site-wide cap is what bounds abuse). Resets when the server restarts.
 *
 *   const limit = createRateLimit({ perSender: 5, windowMs: 15 * 60e3, siteMax: 60, siteWindowMs: 60 * 60e3 });
 *   if (!limit.allows(key)) …refuse…;   // before the work
 *   limit.record(key);                  // after it succeeded
 */
function createRateLimit({ perSender, windowMs, siteMax, siteWindowMs, now = () => Date.now() }) {
    const bySender = new Map();
    let siteWide = [];

    const recent = (key) => {
        const t = now();
        const times = (bySender.get(key) || []).filter(x => t - x < windowMs);
        if (times.length) bySender.set(key, times); else bySender.delete(key);
        return times;
    };

    return {
        allows(key) {
            const t = now();
            siteWide = siteWide.filter(x => t - x < siteWindowMs);
            return siteWide.length < siteMax && recent(key).length < perSender;
        },
        record(key) {
            const t = now();
            bySender.set(key, [...recent(key), t]);
            siteWide.push(t);
            if (bySender.size > 5000) for (const k of [...bySender.keys()]) recent(k);
        },
    };
}

/* The address a request came from (first X-Forwarded-For hop when proxied). */
const senderKey = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';

module.exports = { createRateLimit, senderKey };
