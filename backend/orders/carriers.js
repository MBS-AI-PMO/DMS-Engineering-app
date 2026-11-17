/*
 * Carriers the shop can ship with (US). `url` builds the public tracking
 * page from a tracking number; carriers without one take a pasted link.
 * `noTracking` deliveries (own truck, pickup) need no number at all.
 */
const CARRIERS = [
    { key: 'ups', name: 'UPS', url: 'https://www.ups.com/track?loc=en_US&tracknum={n}' },
    { key: 'fedex', name: 'FedEx', url: 'https://www.fedex.com/fedextrack/?trknbr={n}' },
    { key: 'usps', name: 'USPS', url: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={n}' },
    { key: 'dhl', name: 'DHL Express', url: 'https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id={n}' },
    { key: 'ontrac', name: 'OnTrac' },
    { key: 'lso', name: 'LSO (Lone Star Overnight)' },
    { key: 'estes', name: 'Estes Express', freight: true },
    { key: 'odfl', name: 'Old Dominion (ODFL)', freight: true },
    { key: 'saia', name: 'Saia', freight: true },
    { key: 'xpo', name: 'XPO', freight: true },
    { key: 'rl', name: 'R+L Carriers', freight: true },
    { key: 'tforce', name: 'TForce Freight', freight: true },
    { key: 'other', name: 'Other carrier' },
    { key: 'local', name: 'Local delivery', noTracking: true },
    { key: 'pickup', name: 'Customer pickup', noTracking: true },
];

const carrierByKey = (key) => CARRIERS.find(c => c.key === key) || null;

function trackingUrlFor(carrierKey, trackingNumber) {
    const carrier = carrierByKey(carrierKey);
    const number = String(trackingNumber || '').trim();
    if (!carrier?.url || !number) return null;
    return carrier.url.replace('{n}', encodeURIComponent(number));
}

/* The name a customer sees: "Other carrier" shows what the shop typed. */
function carrierLabel(shipment) {
    if (shipment.carrier === 'other' && shipment.carrier_name) return shipment.carrier_name;
    return carrierByKey(shipment.carrier)?.name || shipment.carrier_name || shipment.carrier;
}

/* pg turns a DATE into local midnight; keep it as the plain day the shop
 * typed ("2026-11-17") so no time zone can move it. */
function dayString(value) {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    }
    const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : null;
}

module.exports = { CARRIERS, carrierByKey, trackingUrlFor, carrierLabel, dayString };
