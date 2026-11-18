import { ArrowUpRight, Truck } from 'lucide-react';
import { dateText, dayText, safeLink } from './orderFormat';

/*
 * What the shop shares with a customer about an order: shipments with
 * their tracking links, the shop's messages and photos of the parts. My
 * orders shows them together (OrderExtras) inside an open order; the
 * tracking page (/track-order) places each piece in its own panel.
 * Styles: styles/AccountPages.css (acc-), so a page using these sits in an
 * .acc wrapper.
 */

/* Carrier, tracking number, ship date and the carrier's tracking page. */
export function OrderShipments({ shipments = [], title = true }) {
    if (!shipments.length) return null;
    return (
        <div className="acc-extra">
            {title && <h3 className="acc-extra-title"><Truck size={15} aria-hidden="true" /> {shipments.length > 1 ? 'Shipments' : 'Shipment'}</h3>}
            <ul className="acc-ships">
                {shipments.map(s => {
                    const href = safeLink(s.tracking_link);
                    return (
                        <li key={s.id} className="acc-ship">
                            <span className="acc-ship-carrier">{s.carrier}{s.service ? ` · ${s.service}` : ''}</span>
                            {s.tracking_number && <span className="acc-ship-number">{s.tracking_number}</span>}
                            {s.shipped_at && <span className="acc-ship-date">{s.no_tracking ? '' : 'Shipped '}{dayText(s.shipped_at)}</span>}
                            {href && (
                                <a className="acc-btn is-small" href={href} target="_blank" rel="noopener noreferrer">
                                    Track package <ArrowUpRight size={14} aria-hidden="true" />
                                </a>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

/* The notes the shop wrote to the customer (updates with text), each dated. */
export function OrderMessages({ updates = [], title = true }) {
    const notes = updates.filter(u => u.body);
    if (!notes.length) return null;
    return (
        <div className="acc-extra">
            {title && <h3 className="acc-extra-title">Messages from our team</h3>}
            <ul className="acc-notes">
                {notes.map(n => (
                    <li key={n.id}>
                        <p>{n.body}</p>
                        <span>{dateText(n.created_at)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/* Photos the shop chose to show the customer. */
export function OrderPhotos({ photos = [], title = true }) {
    if (!photos.length) return null;
    return (
        <div className="acc-extra">
            {title && <h3 className="acc-extra-title">Photos of your parts</h3>}
            <ul className="acc-photos">
                {photos.map((p, i) => (
                    <li key={p.id}>
                        <a href={p.url} target="_blank" rel="noreferrer" aria-label={`Open photo ${i + 1}${p.caption ? `: ${p.caption}` : ''}`}>
                            <img src={p.thumb_url} alt={p.caption || `Photo ${i + 1} of your parts`} loading="lazy" decoding="async" />
                        </a>
                        {p.caption && <span>{p.caption}</span>}
                    </li>
                ))}
            </ul>
        </div>
    );
}

/* Tracking, photos the shop shared, and the shop's messages for an order. */
export default function OrderExtras({ shipments = [], photos = [], updates = [] }) {
    const hasNotes = updates.some(u => u.body);
    if (!shipments.length && !photos.length && !hasNotes) return null;
    return (
        <div className="acc-extras">
            <OrderShipments shipments={shipments} />
            <OrderMessages updates={updates} />
            <OrderPhotos photos={photos} />
        </div>
    );
}
