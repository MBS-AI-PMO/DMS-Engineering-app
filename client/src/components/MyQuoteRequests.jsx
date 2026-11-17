import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { quoteRequestsService } from '../services/quotes';
import { displayMetalName } from '../utils/metalDisplay';
import '../styles/MyQuoteRequests.css';

/**
 * My orders > Quote requests: the signed-in customer's requests for parts
 * that had no instant price — reference, file, date, status and, once the
 * shop has answered, the price, lead time and its message. Shown only when
 * there is at least one request. Lives inside the account page (.acc).
 */

// The account page's status colours.
const STATUS_CLASS = { new: 'is-pending', quoted: 'is-processing', accepted: 'is-completed', declined: 'is-rejected', closed: '' };

const money = (value) => (Number.isFinite(Number(value)) && value !== null
    ? Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : '—');
const dateText = (value) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const acceptLink = (q) => `/contact?topic=${encodeURIComponent('Quote question')}&message=${encodeURIComponent(
    `About quote ${q.reference} (${q.file_name}): I'd like to go ahead with ${q.answer?.quantity || q.quantity} pcs at ${money(q.answer?.unit_price)} each.`,
)}`;

function Answer({ request }) {
    const a = request.answer;
    return (
        <div className="mq-answer">
            <dl className="mq-price">
                <div><dt>Price per part</dt><dd>{money(a.unit_price)}</dd></div>
                <div><dt>Quantity</dt><dd>{a.quantity} pcs</dd></div>
                <div><dt>Total</dt><dd className="is-total">{money(a.total)}</dd></div>
                {a.lead_time && <div><dt>Lead time</dt><dd>{a.lead_time}</dd></div>}
            </dl>
            {a.message && (
                <blockquote className="mq-reply">
                    <span className="mq-reply-label"><MessageSquare size={13} aria-hidden="true" /> From our team</span>
                    <p>{a.message}</p>
                </blockquote>
            )}
            {request.status === 'quoted' && (
                <p className="mq-accept">
                    To accept, reply to our email or <Link to={acceptLink(request)}>send us a message</Link>.
                </p>
            )}
        </div>
    );
}

const MyQuoteRequests = () => {
    const { user } = useAuth() || {};
    const [requests, setRequests] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!user) return undefined;
        let cancelled = false;
        quoteRequestsService.mine()
            .then(list => { if (!cancelled) setRequests(Array.isArray(list) ? list : []); })
            .catch(err => { if (!cancelled) setError(err.message); });
        return () => { cancelled = true; };
    }, [user]);

    if (!user || (!requests.length && !error)) return null;

    return (
        <section className="mq" aria-labelledby="mq-title">
            <div className="mq-head">
                <h2 id="mq-title" className="acc-h2">Quote requests</h2>
                <p className="mq-sub">Parts we price by hand. We email you when a quote is ready.</p>
            </div>
            {error ? (
                <p className="mq-error" role="alert">Your quote requests could not be loaded. {error}</p>
            ) : (
                <ul className="mq-list">
                    {requests.map(q => (
                        <li key={q.id} className="mq-item">
                            <div className="mq-row">
                                <span className="mq-icon" aria-hidden="true"><FileQuestion size={18} /></span>
                                <div className="mq-main">
                                    <span className="mq-ref">{q.reference}</span>
                                    <span className="mq-file" title={q.file_name}>{q.file_name}</span>
                                    <span className="mq-specs">
                                        {[q.material && displayMetalName(q.material), q.thickness, q.process, `${q.quantity} pcs`].filter(Boolean).join(' · ')}
                                    </span>
                                </div>
                                <span className="mq-date">{dateText(q.created_at)}</span>
                                <span className={`acc-status ${STATUS_CLASS[q.status] || ''}`}>{q.status_label}</span>
                            </div>
                            {q.answer && <Answer request={q} />}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};

export default MyQuoteRequests;
