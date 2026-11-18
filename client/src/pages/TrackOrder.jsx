import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Ban, Check, ClipboardCheck, Factory, Loader2, Package, PackageCheck, TriangleAlert, Truck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import usePageHero from '../hooks/usePageHero';
import { trackOrderService } from '../services/trackOrder';
import { displayMetalName } from '../utils/metalDisplay';
import { OrderPhotos, OrderShipments } from '../components/orders/OrderExtras';
import { dateText } from '../components/orders/orderFormat';
import '../styles/Shimmer.css';
import '../styles/AccountPages.css';
import '../styles/TrackOrder.css';

/**
 * Track order (/track-order, /track-order/:orderNumber): a heading band over
 * the page picture (Admin › Hero sections, "Track order"), then either
 *  - the lookup: order number + the email used on the order, or
 *  - the order: where it is (stepper), shipments with carrier tracking links,
 *    the shop's updates, the parts and any photos the shop shared.
 * /track-order/:n opens straight away for the signed-in customer who owns
 * the order and for a browser that has looked it up or followed the link
 * in an order email (backend/routes/trackOrder.js); anyone else is asked
 * for the email. Nothing shows prices.
 */

const STEP_LABEL = {
    placed: 'Order placed',
    production: 'In production',
    shipped: 'Shipped',
    delivered: 'Delivered',
    attention: 'Needs attention',
    cancelled: 'Cancelled',
};

const STAGE = {
    placed: { Icon: ClipboardCheck, title: 'Order received', text: "We have your order and are reviewing your files. We'll email you when production starts." },
    production: { Icon: Factory, title: 'In production', text: "We've reviewed your files and your parts are being made. We'll email you as soon as they ship." },
    shipped: { Icon: Truck, title: 'Shipped', text: 'Your parts have left our shop.' },
    delivered: { Icon: PackageCheck, title: 'Delivered', text: 'This order is complete. Thanks for choosing DMS.' },
    attention: { Icon: TriangleAlert, title: 'Needs attention', text: "After reviewing your files, we aren't able to produce this order as it stands. Someone from our team will be in touch with the details, or contact us and we'll help you find a way forward." },
    cancelled: { Icon: Ban, title: 'Cancelled', text: 'This order was cancelled. Contact us if you have a question about it.' },
};

const PAYMENT_LABEL = { COD: 'Cash on delivery', PAYPAL: 'PayPal' };

const LINK_NOTICE = {
    expired: 'That link has expired. Enter the email used on the order to open it.',
    invalid: "That link isn't valid. Enter the email used on the order to open it.",
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const dateTime = (value) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

/* "1042" -> 1042; anything else -> null. */
const orderNumberOf = (value) => (/^\d{1,9}$/.test(String(value || '')) && Number(value) > 0 ? Number(value) : null);

/* An update from the shop, in the customer's words. */
function updateTitle(u) {
    if (u.kind === 'status') {
        if (/^Update sent/i.test(u.title || '')) return 'Update from our team';
        const stage = { pending: 'placed', processing: 'production', shipping: 'shipped', shipped: 'shipped', completed: 'delivered', rejected: 'attention', cancelled: 'cancelled' }[u.status_to];
        return stage ? STAGE[stage].title : 'Status updated';
    }
    if (u.kind === 'shipment') return 'Tracking added';
    return u.title || 'Update';
}
const updateDetail = (u) => (u.kind === 'shipment' ? String(u.title || '').replace(/^Shipment added:\s*/i, '') : '');

// ── The lookup form ─────────────────────────────────────────────────────

function LookupForm({ defaultOrder, notice, onFound }) {
    const { user } = useAuth();
    const [order, setOrder] = useState(defaultOrder ? String(defaultOrder) : '');
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const orderId = useId();
    const emailId = useId();
    const errorId = useId();

    const submit = async (e) => {
        e.preventDefault();
        if (busy) return;
        const number = order.trim().replace(/^#\s*/, '');
        if (!orderNumberOf(number)) { setError('Enter your order number as digits, for example 1042.'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setError('Enter the email address used on the order.'); return; }
        setBusy(true);
        setError('');
        try {
            onFound(await trackOrderService.lookup(number, email.trim()));
        } catch (err) {
            setError(err.message || 'Could not look up the order. Please try again.');
            setBusy(false);
        }
    };

    return (
        <div className="trk-find">
            <form className="acc-panel trk-form" onSubmit={submit} noValidate aria-describedby={error ? errorId : undefined}>
                <div>
                    <h2 className="acc-h2">Find your order</h2>
                    <p className="acc-muted">Enter the order number and the email address you used when you ordered.</p>
                </div>
                {notice && !error && <p className="trk-notice" role="status">{notice}</p>}
                <div className="trk-form-row">
                    <div className="acc-field">
                        <label className="acc-label" htmlFor={orderId}>Order number</label>
                        <input
                            id={orderId}
                            name="order"
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="e.g. 1042"
                            maxLength={12}
                            value={order}
                            onChange={e => setOrder(e.target.value)}
                            aria-invalid={Boolean(error) || undefined}
                        />
                    </div>
                    <div className="acc-field">
                        <label className="acc-label" htmlFor={emailId}>Email</label>
                        <input
                            id={emailId}
                            name="email"
                            type="email"
                            autoComplete="email"
                            placeholder="you@company.com"
                            maxLength={254}
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            aria-invalid={Boolean(error) || undefined}
                        />
                    </div>
                </div>
                {error && <p id={errorId} className="trk-error" role="alert">{error}</p>}
                <div className="trk-form-foot">
                    <button type="submit" className="acc-btn is-primary" disabled={busy}>
                        {busy ? <Loader2 size={16} className="acc-spin" aria-hidden="true" /> : null}
                        {busy ? 'Looking up' : 'Track order'}
                        {!busy && <ArrowRight size={16} aria-hidden="true" />}
                    </button>
                </div>
            </form>

            <aside className="acc-panel trk-help" aria-labelledby="trk-help-title">
                <h2 id="trk-help-title" className="acc-h2">Where to find your order number</h2>
                <ul className="trk-help-list">
                    <li>In the email we sent when you ordered: “We’ve received your order #…”</li>
                    <li>On the confirmation page right after checkout.</li>
                    <li>Under My orders when you’re signed in, where every order has a Track order button.</li>
                </ul>
                {user ? (
                    <Link to="/orders" className="acc-btn">Go to My orders <ArrowRight size={16} aria-hidden="true" /></Link>
                ) : (
                    <p className="acc-muted">Every order email also has a link that opens its tracking page, no typing needed.</p>
                )}
            </aside>
        </div>
    );
}

// ── The order ───────────────────────────────────────────────────────────

function Stepper({ steps }) {
    return (
        <ol className="trk-steps" style={{ '--trk-steps': steps.length }}>
            {steps.map((step, i) => (
                <li key={step.key} className={`trk-step is-${step.state}`} aria-current={step.state === 'current' || step.state === 'stopped' ? 'step' : undefined}>
                    <span className="trk-step-dot" aria-hidden="true">
                        {step.state === 'done' ? <Check size={16} strokeWidth={3} /> : step.state === 'stopped' ? <TriangleAlert size={15} /> : i + 1}
                    </span>
                    <span className="trk-step-text">
                        <span className="trk-step-label">{STEP_LABEL[step.key] || step.key}</span>
                        <span className="trk-step-date">
                            {step.at && step.state !== 'todo' ? dateText(step.at) : step.state === 'todo' ? 'Not yet' : ''}
                            <span className="trk-sr">{step.state === 'done' ? ' (done)' : step.state === 'current' ? ' (current step)' : ''}</span>
                        </span>
                    </span>
                </li>
            ))}
        </ol>
    );
}

function OrderView({ view, access, focusOnShow, onAnother }) {
    const headingRef = useRef(null);
    useEffect(() => {
        if (focusOnShow) headingRef.current?.focus();
    }, [focusOnShow]);

    const stage = STAGE[view.stage] || STAGE.placed;
    const { Icon } = stage;
    const stopped = view.stage === 'attention' || view.stage === 'cancelled';
    const paid = view.payment?.paid === true ? 'Paid' : view.payment?.paid === false ? 'Unpaid' : '';
    const payment = [PAYMENT_LABEL[view.payment?.method] || view.payment?.method, paid].filter(Boolean).join(' · ');
    const contactHref = `/contact?topic=${encodeURIComponent('Order help')}&message=${encodeURIComponent(`About order #${view.number}: `)}`;
    const shippedText = view.stage === 'shipped' && view.shipments.some(s => s.tracking_link)
        ? `${stage.text} Follow ${view.shipments.length > 1 ? 'each package' : 'the package'} with the carrier's tracking link below.`
        : stage.text;

    return (
        <div className="trk-order">
            <section className={`acc-panel trk-status is-${view.stage}`} aria-labelledby="trk-stage">
                <div className="trk-status-head">
                    <span className="trk-status-icon" aria-hidden="true"><Icon size={22} /></span>
                    <div className="trk-status-text">
                        <p className="trk-kicker">Order #{view.number}</p>
                        <h2 id="trk-stage" className="trk-stage" tabIndex={-1} ref={headingRef}>{stage.title}</h2>
                        <p className="trk-stage-text">{shippedText}</p>
                    </div>
                </div>
                <Stepper steps={view.steps} />
                <dl className="trk-meta">
                    <div><dt>Placed</dt><dd>{dateText(view.placedAt)}</dd></div>
                    <div><dt>Last update</dt><dd>{dateText(view.updatedAt)}</dd></div>
                    <div><dt>Parts</dt><dd>{plural(view.partCount, 'part')}{view.parts.length > 1 ? ` in ${view.parts.length} designs` : ''}</dd></div>
                    {payment && <div><dt>Payment</dt><dd>{payment}</dd></div>}
                    {view.email && <div><dt>Emails go to</dt><dd>{view.email}</dd></div>}
                </dl>
            </section>

            <div className="trk-grid">
                <div className="trk-main">
                    <section className="acc-panel" aria-labelledby="trk-ship-title">
                        <h2 id="trk-ship-title" className="acc-h2 trk-h2"><Truck size={18} aria-hidden="true" /> {view.shipments.length > 1 ? 'Shipments' : 'Shipping'}</h2>
                        {view.shipments.length ? (
                            <OrderShipments shipments={view.shipments} title={false} />
                        ) : (
                            <p className="acc-muted">
                                {stopped ? 'Nothing has shipped for this order.' : 'Nothing has shipped yet. The carrier and tracking number show here as soon as your parts leave our shop.'}
                            </p>
                        )}
                    </section>

                    <section className="acc-panel" aria-labelledby="trk-updates-title">
                        <h2 id="trk-updates-title" className="acc-h2">Updates from our team</h2>
                        {view.updates.length ? (
                            <ol className="trk-updates">
                                {view.updates.map(u => (
                                    <li key={u.id} className="trk-update">
                                        <p className="trk-update-title">
                                            {updateTitle(u)}
                                            {updateDetail(u) && <span className="trk-update-detail"> {updateDetail(u)}</span>}
                                        </p>
                                        <time className="trk-update-date" dateTime={u.created_at}>{dateTime(u.created_at)}</time>
                                        {u.body && <p className="trk-update-body">{u.body}</p>}
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <p className="acc-muted">No updates yet. We email you at each step, and every update shows here too.</p>
                        )}
                    </section>
                </div>

                <div className="trk-side">
                    <section className="acc-panel" aria-labelledby="trk-parts-title">
                        <h2 id="trk-parts-title" className="acc-h2 trk-h2"><Package size={18} aria-hidden="true" /> Parts</h2>
                        <ul className="acc-items">
                            {view.parts.map(part => {
                                const spec = [part.material ? displayMetalName(part.material) : null, part.thickness ? `${part.thickness} thick` : null, ...part.services]
                                    .filter(Boolean).join(' · ');
                                return (
                                    <li key={part.id} className="acc-part trk-part">
                                        <span className="acc-part-text">
                                            <span className="acc-part-name" title={part.name}>{part.name}</span>
                                            {spec && <span className="acc-part-spec">{spec}</span>}
                                        </span>
                                        <span className="trk-qty">Qty {part.quantity}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>

                    {view.photos.length > 0 && (
                        <section className="acc-panel" aria-labelledby="trk-photos-title">
                            <h2 id="trk-photos-title" className="acc-h2">Photos of your parts</h2>
                            <OrderPhotos photos={view.photos} title={false} />
                        </section>
                    )}

                    <section className="acc-panel trk-help-panel" aria-labelledby="trk-q-title">
                        <h2 id="trk-q-title" className="acc-h2">Questions about this order?</h2>
                        <p className="acc-muted">Send us a message with your order number and we’ll get back to you.</p>
                        <div className="trk-actions">
                            <Link to={contactHref} className="acc-btn">Contact us</Link>
                            {access === 'account'
                                ? <Link to="/orders" className="acc-btn">My orders</Link>
                                : <button type="button" className="acc-btn" onClick={onAnother}>Track another order</button>}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

function LoadingView() {
    return (
        <div className="trk-order" aria-busy="true" aria-label="Loading the order">
            <div className="acc-panel trk-status" aria-hidden="true">
                <div className="trk-status-head">
                    <span className="shimmer trk-sk-icon" />
                    <div className="trk-status-text">
                        <span className="shimmer acc-sk-line is-date" />
                        <span className="shimmer acc-sk-line is-name" />
                        <span className="shimmer acc-sk-line is-short" />
                    </div>
                </div>
                <span className="shimmer trk-sk-steps" />
            </div>
        </div>
    );
}

// ── Page ────────────────────────────────────────────────────────────────

const TrackOrder = () => {
    const { orderNumber } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const hero = usePageHero('track');

    const number = orderNumberOf(orderNumber);
    const badNumber = orderNumber !== undefined && !number;
    // The latest answer: { number, view, access } or { number, error }.
    const [result, setResult] = useState(null);
    const knownRef = useRef(null);
    const [focusOnShow, setFocusOnShow] = useState(false);

    useEffect(() => {
        if (!number || knownRef.current === number) return undefined;
        let live = true;
        trackOrderService.get(number)
            .then(({ view, access }) => { if (live) { knownRef.current = number; setResult({ number, view, access }); } })
            .catch(error => { if (live) setResult({ number, error }); });
        return () => { live = false; };
    }, [number]);

    const current = number && result?.number === number ? result : null;
    const view = current?.view || null;
    const loading = Boolean(number) && !current;
    const needsEmail = Boolean(current?.error?.body?.needsEmail);
    const loadError = current?.error && !needsEmail ? current.error.message || 'Could not load the order. Please try again.' : '';
    const link = searchParams.get('link');

    const notice = badNumber ? "That address doesn't have a valid order number. Enter it below."
        : LINK_NOTICE[link] || (needsEmail ? `Enter the email used on order #${number} to see it.` : loadError);

    const found = ({ view: foundView, access }) => {
        knownRef.current = foundView.number;
        setResult({ number: foundView.number, view: foundView, access });
        setFocusOnShow(true);
        if (foundView.number !== number || link) navigate(`/track-order/${foundView.number}`);
    };

    const another = () => {
        setFocusOnShow(false);
        navigate('/track-order');
    };

    const lede = view
        ? `${plural(view.partCount, 'part')}, placed ${dateText(view.placedAt)}. Last update ${dateText(view.updatedAt)}.`
        : number ? 'Status, shipping and updates for your order.'
            : 'Enter your order number and email to see where your parts are: production, shipping and messages from our team.';

    return (
        <div className="acc trk">
            <section className="trk-hero" aria-labelledby="trk-title">
                {hero.src && <img className="trk-hero-img" src={hero.src} srcSet={hero.srcSet} sizes="100vw" alt="" aria-hidden="true" loading="eager" fetchPriority="high" decoding="async" />}
                <div className="trk-hero-shade" aria-hidden="true" />
                <div className="acc-inner trk-hero-content">
                    <nav className="acc-crumbs" aria-label="Breadcrumb">
                        <Link to="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        {number ? (
                            <>
                                <Link to="/track-order">Track order</Link>
                                <span aria-hidden="true">/</span>
                                <span aria-current="page">#{number}</span>
                            </>
                        ) : <span aria-current="page">Track order</span>}
                    </nav>
                    <h1 id="trk-title" className="trk-title">{number ? `Order #${number}` : 'Track your order'}</h1>
                    <p className="trk-lede">{loading ? <span className="shimmer trk-sk-lede" aria-hidden="true" /> : lede}</p>
                </div>
            </section>

            <section className="acc-body trk-body" aria-label={number ? `Order #${number}` : 'Find your order'}>
                <div className="acc-inner">
                    {loading ? <LoadingView />
                        : view ? <OrderView view={view} access={current.access} focusOnShow={focusOnShow} onAnother={another} />
                            : <LookupForm key={number || 'new'} defaultOrder={number} notice={notice} onFound={found} />}
                </div>
            </section>
        </div>
    );
};

export default TrackOrder;
