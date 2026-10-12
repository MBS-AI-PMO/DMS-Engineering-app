import React, { useState, useEffect, useMemo, useRef, useId } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { ChevronDown, Download, Eye, Package, Search, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authHeaders } from '../utils/api';
import { displayMetalName } from '../utils/metalDisplay';
import ProjectViewer from '../components/viewer/ProjectViewer';
import ConfirmDialog from '../components/ConfirmDialog';
// Not used by this page any more, but the admin orders list leans on its
// global rules (.preview-modal-overlay, status badges), so it stays loaded.
import '../styles/PremiumOrders.css';
import '../styles/Shimmer.css';
import '../styles/AccountPages.css';

/**
 * My orders: a short dark heading band, then the orders as rows in one
 * white panel — search and status filters above, each row opening to its
 * parts (preview and download of the uploaded file and of the finished
 * part), the shipping details, and "remove from history". Rows and parts
 * shimmer while loading.
 */

const parseConfig = (config) => {
    if (typeof config === 'string') {
        try { return JSON.parse(config); } catch { return {}; }
    }
    return config || {};
};

const STATUS_LABEL = { pending: 'Pending', processing: 'In production', completed: 'Completed', cancelled: 'Cancelled', shipped: 'Shipped' };
const statusLabel = (status) => STATUS_LABEL[status] || (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown');
const money = (value) => `$${(Number(value) || 0).toFixed(2)}`;
const dateText = (value) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};
const fileUrl = (path) => (path ? `/${String(path).replace(/^\/+/, '')}` : '');

const OrderItems = ({ items, loading, onPreview }) => {
    if (loading) {
        return (
            <ul className="acc-items" aria-hidden="true">
                {[0, 1].map(i => (
                    <li key={i} className="acc-part">
                        <span className="acc-part-text">
                            <span className="shimmer acc-sk-line is-name" />
                            <span className="shimmer acc-sk-line is-short" />
                        </span>
                    </li>
                ))}
            </ul>
        );
    }
    if (!items || items.length === 0) return <p className="acc-muted">No parts found for this order.</p>;
    return (
        <ul className="acc-items">
            {items.map(item => {
                const config = parseConfig(item.configuration_json);
                const spec = [config.metal?.name ? displayMetalName(config.metal.name) : null, config.thickness ? `${config.thickness} mm` : null]
                    .filter(Boolean).join(' · ');
                return (
                    <li key={item.id} className="acc-part">
                        <span className="acc-part-text">
                            <span className="acc-part-name" title={item.file_name}>{item.file_name}</span>
                            <span className="acc-part-spec">
                                {spec || 'Standard metal'} · Qty {item.quantity} · {money(item.unit_price)} each
                            </span>
                        </span>
                        <span className="acc-part-actions">
                            {item.original_file_path && (
                                <span className="acc-pair">
                                    <span className="acc-pair-label">Your file</span>
                                    <button type="button" className="acc-icon-btn" onClick={() => onPreview(item, 'original')} aria-label={`Preview your file ${item.file_name}`}>
                                        <Eye size={15} aria-hidden="true" />
                                    </button>
                                    <a href={fileUrl(item.original_file_path)} download className="acc-icon-btn" aria-label={`Download your file ${item.file_name}`}>
                                        <Download size={15} aria-hidden="true" />
                                    </a>
                                </span>
                            )}
                            {item.configured_file_path && (
                                <span className="acc-pair">
                                    <span className="acc-pair-label">Finished part</span>
                                    <button type="button" className="acc-icon-btn" onClick={() => onPreview(item, 'configured')} aria-label={`Preview finished part ${item.file_name}`}>
                                        <Eye size={15} aria-hidden="true" />
                                    </button>
                                    <a href={fileUrl(item.configured_file_path)} download className="acc-icon-btn" aria-label={`Download finished part ${item.file_name}`}>
                                        <Download size={15} aria-hidden="true" />
                                    </a>
                                </span>
                            )}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
};

const PreviewDialog = ({ preview, onClose }) => {
    const closeRef = useRef(null);
    const titleId = useId();
    useEffect(() => {
        closeRef.current?.focus();
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = previous;
        };
    }, [onClose]);

    const { item, mode } = preview;
    const config = parseConfig(item.configuration_json);
    const path = mode === 'original' ? item.original_file_path : item.configured_file_path;
    return (
        <div className="acc-overlay" onClick={onClose}>
            <motion.div
                className="acc-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={e => e.stopPropagation()}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
                <div className="acc-dialog-head">
                    <h2 id={titleId} className="acc-dialog-title">
                        {item.file_name}
                        <span className="acc-dialog-sub">{mode === 'original' ? 'Your file' : 'Finished part'}</span>
                    </h2>
                    <button ref={closeRef} type="button" className="acc-icon-btn" onClick={onClose} aria-label="Close preview">
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>
                <div className="acc-dialog-body">
                    <div className="acc-dialog-viewer">
                        <ProjectViewer
                            file={{ name: item.file_name, path: path ? fileUrl(path) : null }}
                            tempPath={item.original_file_path ? fileUrl(item.original_file_path) : null}
                            configuration={mode === 'configured' ? config : {}}
                        />
                    </div>
                    <dl className="acc-dialog-meta">
                        <div><dt>Material</dt><dd>{config.metal?.name ? displayMetalName(config.metal.name) : '—'}</dd></div>
                        <div><dt>Thickness</dt><dd>{config.thickness ? `${config.thickness} mm` : '—'}</dd></div>
                        {config.anodizingColor?.name && <div><dt>Anodizing</dt><dd>{config.anodizingColor.name}</dd></div>}
                        <div><dt>Quantity</dt><dd>{item.quantity}</dd></div>
                        <div><dt>Price each</dt><dd>{money(item.unit_price)}</dd></div>
                    </dl>
                </div>
            </motion.div>
        </div>
    );
};

const Orders = () => {
    const { user, loading: authLoading } = useAuth();
    const reduceMotion = useReducedMotion();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(null);
    const [itemsCache, setItemsCache] = useState({});
    const [preview, setPreview] = useState(null);
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('all');
    const [removing, setRemoving] = useState(null); // { id, busy, error }

    useEffect(() => {
        let cancelled = false;
        fetch('/api/orders/my-orders', { credentials: 'include', headers: { ...authHeaders() } })
            .then(r => r.json())
            .then(data => { if (!cancelled && data.success) setOrders(Array.isArray(data.data) ? data.data : []); })
            .catch(err => console.error('Failed to fetch orders:', err))
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const loadItems = async (orderId) => {
        if (itemsCache[orderId]?.items) return;
        setItemsCache(prev => ({ ...prev, [orderId]: { ...prev[orderId], loading: true } }));
        try {
            const response = await fetch(`/api/orders/${orderId}`, { credentials: 'include', headers: { ...authHeaders() } });
            const data = await response.json();
            setItemsCache(prev => ({ ...prev, [orderId]: { items: data.success ? data.items : [], loading: false } }));
        } catch (err) {
            console.error('Failed to fetch items:', err);
            setItemsCache(prev => ({ ...prev, [orderId]: { items: [], loading: false } }));
        }
    };

    const toggle = (orderId) => {
        if (expanded === orderId) {
            setExpanded(null);
        } else {
            loadItems(orderId);
            setExpanded(orderId);
        }
    };

    const removeOrder = async () => {
        const orderId = removing?.id;
        if (orderId == null) return;
        setRemoving({ id: orderId, busy: true, error: '' });
        try {
            const response = await fetch(`/api/orders/${orderId}/user-delete`, {
                method: 'POST',
                credentials: 'include',
                headers: { ...authHeaders() },
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Could not remove the order.');
            setOrders(prev => prev.filter(o => o.id !== orderId));
            if (expanded === orderId) setExpanded(null);
            setRemoving(null);
        } catch (err) {
            console.error('Failed to delete order:', err);
            setRemoving({ id: orderId, busy: false, error: err.message || 'Could not remove the order. Please try again.' });
        }
    };

    const statuses = useMemo(() => {
        const counts = new Map();
        orders.forEach(o => counts.set(o.status, (counts.get(o.status) || 0) + 1));
        return [...counts.entries()].map(([key, count]) => ({ key, count }));
    }, [orders]);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase().replace(/^#/, '');
        return orders.filter(o => {
            if (status !== 'all' && o.status !== status) return false;
            if (!q) return true;
            return [String(o.id), statusLabel(o.status), dateText(o.created_at), money(o.total_price)]
                .some(text => text.toLowerCase().includes(q));
        });
    }, [orders, query, status]);

    const signedOut = !authLoading && !user;

    return (
        <div className="acc">
            <section className="acc-hero" aria-labelledby="acc-title">
                <div className="acc-inner">
                    <nav className="acc-crumbs" aria-label="Breadcrumb">
                        <Link to="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">My orders</span>
                    </nav>
                    <h1 id="acc-title" className="acc-title">My orders</h1>
                    <p className="acc-lede">
                        {loading && !signedOut
                            ? <span className="shimmer acc-sk-lede" aria-hidden="true" />
                            : signedOut ? 'Sign in to see your orders.' : `${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`}
                    </p>
                </div>
            </section>

            <section className="acc-body" aria-label="Orders">
                <div className="acc-inner">
                    {signedOut ? (
                        <div className="acc-empty">
                            <span className="acc-empty-icon" aria-hidden="true"><Package size={24} /></span>
                            <h2 className="acc-h2">Sign in to view your orders</h2>
                            <p>Your order history is kept with your account.</p>
                            <div className="acc-empty-actions">
                                <Link to="/login?redirect=/orders" className="acc-btn is-primary">Sign in</Link>
                                <Link to="/signup?redirect=/orders" className="acc-btn">Create account</Link>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="acc-toolbar">
                                <div className="acc-filters" role="group" aria-label="Filter by status">
                                    {loading ? (
                                        [64, 88, 108].map((w, i) => <span key={i} className="shimmer acc-sk-chip" style={{ width: w }} aria-hidden="true" />)
                                    ) : orders.length > 0 && (
                                        [{ key: 'all', count: orders.length }, ...statuses].map(s => (
                                            <button
                                                key={s.key}
                                                type="button"
                                                className={`acc-chip${status === s.key ? ' is-active' : ''}`}
                                                aria-pressed={status === s.key}
                                                onClick={() => setStatus(s.key)}
                                            >
                                                {s.key === 'all' ? 'All' : statusLabel(s.key)}
                                                <span className="acc-chip-count">{s.count}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                                {(loading || orders.length > 0) && (
                                    <div className="acc-search">
                                        <Search size={16} aria-hidden="true" />
                                        <input
                                            type="search"
                                            aria-label="Search orders"
                                            placeholder="Order number, date or status"
                                            value={query}
                                            onChange={e => setQuery(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>

                            {loading ? (
                                <ul className="acc-orders" aria-hidden="true">
                                    {[0, 1, 2].map(i => (
                                        <li key={i} className="acc-order">
                                            <span className="acc-order-row is-skeleton">
                                                <span className="shimmer acc-sk-line is-id" />
                                                <span className="shimmer acc-sk-line is-date" />
                                                <span className="shimmer acc-sk-line is-total" />
                                                <span className="shimmer acc-sk-chip" style={{ width: 92 }} />
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : orders.length === 0 ? (
                                <div className="acc-empty">
                                    <span className="acc-empty-icon" aria-hidden="true"><Package size={24} /></span>
                                    <h2 className="acc-h2">No orders yet</h2>
                                    <p>Your orders will show here once you place one.</p>
                                    <div className="acc-empty-actions">
                                        <Link to="/get-instant-pricing" className="acc-btn is-primary">Get instant pricing</Link>
                                    </div>
                                </div>
                            ) : visible.length === 0 ? (
                                <div className="acc-empty is-small">
                                    <p>No orders match.</p>
                                    <button type="button" className="acc-btn" onClick={() => { setQuery(''); setStatus('all'); }}>Show all orders</button>
                                </div>
                            ) : (
                                <ul className="acc-orders">
                                    {visible.map(order => {
                                        const isOpen = expanded === order.id;
                                        const cache = itemsCache[order.id];
                                        const shipTo = [order.full_name, order.address, [order.city, order.zip_code].filter(Boolean).join(' ')].filter(Boolean).join(', ');
                                        return (
                                            <li key={order.id} className={`acc-order${isOpen ? ' is-open' : ''}`}>
                                                <button
                                                    type="button"
                                                    className="acc-order-row"
                                                    aria-expanded={isOpen}
                                                    aria-controls={`acc-order-${order.id}`}
                                                    onClick={() => toggle(order.id)}
                                                >
                                                    <span className="acc-order-id">#{order.id}</span>
                                                    <span className="acc-order-date">{dateText(order.created_at)}</span>
                                                    <span className="acc-order-total">{money(order.total_price)}</span>
                                                    <span className={`acc-status is-${order.status || 'unknown'}`}>{statusLabel(order.status)}</span>
                                                    <ChevronDown size={18} className="acc-order-chev" aria-hidden="true" />
                                                </button>
                                                <AnimatePresence initial={false}>
                                                    {isOpen && (
                                                        <motion.div
                                                            id={`acc-order-${order.id}`}
                                                            className="acc-order-detail"
                                                            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                                                        >
                                                            <div className="acc-order-inner">
                                                                <OrderItems items={cache?.items} loading={!cache || cache.loading} onPreview={(item, mode) => setPreview({ item, mode })} />
                                                                <div className="acc-order-foot">
                                                                    <dl className="acc-order-meta">
                                                                        {shipTo && <div><dt>Ship to</dt><dd>{shipTo}</dd></div>}
                                                                        {order.payment_method && <div><dt>Payment</dt><dd>{order.payment_method}</dd></div>}
                                                                    </dl>
                                                                    <button type="button" className="acc-text-btn" onClick={() => setRemoving({ id: order.id, busy: false, error: '' })}>
                                                                        Remove from history
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </>
                    )}
                </div>
            </section>

            <AnimatePresence>
                {preview && <PreviewDialog preview={preview} onClose={() => setPreview(null)} />}
            </AnimatePresence>

            <ConfirmDialog
                open={removing !== null}
                title={`Remove order #${removing?.id ?? ''} from your history?`}
                message="It disappears from this list. The order itself is not cancelled."
                confirmLabel="Remove"
                danger
                busy={Boolean(removing?.busy)}
                error={removing?.error}
                onConfirm={removeOrder}
                onCancel={() => setRemoving(null)}
            />
        </div>
    );
};

export default Orders;
