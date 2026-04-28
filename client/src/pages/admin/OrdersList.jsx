/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ClipboardList,
    Search,
    Download,
    Eye,
    User,
    Calendar,
    DollarSign,
    ShieldCheck,
    MoreHorizontal,
    ChevronRight,
    Filter,
    FileText,
    Trash2,
    RotateCcw,
    Trash
} from 'lucide-react';
import ProjectViewer from '../../components/viewer/ProjectViewer';
import { generateOrderReport } from '../../utils/generateOrderReport';
import '../../styles/PremiumAdminOrders.css';
import { useToast } from '../../context/ToastContext';

const CALIBRATION_STATUS_OPTIONS = [
    { value: 'untouched', label: 'Untouched', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
    { value: 'reviewed', label: 'Reviewed', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
    { value: 'tuned', label: 'Tuned', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    { value: 'approved', label: 'Approved', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
    { value: 'flagged', label: 'Flagged', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
];

const toFiniteNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const parseQuoteSnapshot = (value) => {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch (err) {
        return {};
    }
};

const formatMoney = (value) => {
    const num = toFiniteNumber(value);
    return num === null ? '-' : `$${num.toFixed(2)}`;
};

const formatSignedNumber = (value, digits = 1, suffix = '') => {
    const num = toFiniteNumber(value);
    if (num === null) return '-';
    const prefix = num > 0 ? '+' : '';
    return `${prefix}${num.toFixed(digits)}${suffix}`;
};

const getVarianceMeta = (value) => {
    const num = toFiniteNumber(value);
    if (num === null) return { label: 'No comparison', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
    if (Math.abs(num) < 5) return { label: 'Aligned', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' };
    if (num > 0) return { label: 'Underquoted', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
    return { label: 'Overquoted', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
};

const AdminOrdersList = () => {
    const [activeTab, setActiveTab] = useState('active'); // 'active' or 'deleted'
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [previewItem, setPreviewItem] = useState(null);
    const [calibrationSummary, setCalibrationSummary] = useState(null);
    const toast = useToast();

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const endpoint = activeTab === 'active' ? '/api/orders/admin/all' : '/api/orders/admin/deleted';
            const response = await fetch(endpoint);
            const data = await response.json();
            if (data.success) {
                setOrders(data.data);
            }
        } catch (err) {
            toast('Failed to fetch orders: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [activeTab, toast]);

    const fetchCalibrationSummary = useCallback(async () => {
        if (activeTab !== 'active') {
            setCalibrationSummary(null);
            return;
        }

        try {
            const response = await fetch('/api/orders/admin/calibration/summary');
            const data = await response.json();
            if (data.success) {
                setCalibrationSummary(data.summary);
            }
        } catch (err) {
            toast('Failed to fetch calibration summary: ' + err.message, 'error');
        }
    }, [activeTab, toast]);

    const handleSoftDelete = async (orderId, e) => {
        e.stopPropagation();
        try {
            const response = await fetch(`/api/orders/${orderId}/admin-soft-delete`, { method: 'POST' });
            if ((await response.json()).success) {
                fetchOrders();
                toast('Order moved to trash', 'success');
            }
        } catch (err) { toast('Failed to move to trash: ' + err.message, 'error'); }
    };

    const handleRestore = async (orderId, e) => {
        e.stopPropagation();
        try {
            const response = await fetch(`/api/orders/${orderId}/admin-restore`, { method: 'POST' });
            if ((await response.json()).success) {
                fetchOrders();
                toast('Order restored successfully', 'success');
            }
        } catch (err) { toast('Failed to restore order: ' + err.message, 'error'); }
    };

    const handlePermanentDelete = async (orderId, e) => {
        e.stopPropagation();
        if (!window.confirm(`PERMANENT DELETE: Are you sure you want to remove Order #${orderId} from the database? This action is irreversible for the Admin side.`)) return;

        try {
            const response = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
            if ((await response.json()).success) {
                fetchOrders();
                toast('Order permanently deleted', 'success');
            }
        } catch (err) { toast('Delete failed: ' + err.message, 'error'); }
    };

    const handleDeleteAll = async () => {
        if (!window.confirm(`PERMANENT DELETE ALL: This will remove ALL ${orders.length} trashed order(s) from the database forever. This action is irreversible. Continue?`)) return;
        try {
            await Promise.all(orders.map(o => fetch(`/api/orders/${o.id}`, { method: 'DELETE' })));
            fetchOrders();
            toast('Trash bin cleared successfully', 'success');
        } catch (err) { toast('Failed to clear trash: ' + err.message, 'error'); }
    };

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    useEffect(() => {
        fetchCalibrationSummary();
    }, [fetchCalibrationSummary]);

    const filteredOrders = orders.filter(o =>
        o.id.toString().includes(searchTerm) ||
        o.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const STATUS_OPTIONS = [
        { value: 'pending', label: 'Pending', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
        { value: 'processing', label: 'Processing', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
        { value: 'shipping', label: 'Shipping', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
        { value: 'completed', label: 'Completed', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
        { value: 'rejected', label: 'Rejected', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    ];

    const getStatusMeta = (status) => STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];

    const handleStatusChange = async (orderId, newStatus, e) => {
        e.stopPropagation();
        try {
            const res = await fetch(`/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            const data = await res.json();
            if (data.success) {
                setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
                if (selectedOrder?.id === orderId) setSelectedOrder(prev => ({ ...prev, status: newStatus }));
                toast(`Order #${orderId} status updated to ${newStatus}`, 'success');
            }
        } catch (err) {
            toast('Status update failed: ' + err.message, 'error');
        }
    };


    return (
        <div className="admin-orders-container">
            <motion.div
                className="admin-page-header"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="page-titles">
                    <h1>Manufacturing Queue</h1>
                    <p>Global production tracking for precision customer projects</p>
                </div>

                <div className="admin-tabs" style={{ display: 'flex', gap: '5px', background: 'rgba(0,0,0,0.05)', padding: '5px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)' }}>
                    <button
                        className={`admin-tab-btn ${activeTab === 'active' ? 'active' : ''}`}
                        onClick={() => setActiveTab('active')}
                        style={{
                            padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                            background: activeTab === 'active' ? '#e31b23' : 'transparent',
                            color: activeTab === 'active' ? 'white' : '#475569',
                            fontWeight: 700, fontSize: '0.85rem', transition: 'all 0.3s'
                        }}
                    >
                        Active Orders
                    </button>
                    <button
                        className={`admin-tab-btn ${activeTab === 'deleted' ? 'active' : ''}`}
                        onClick={() => setActiveTab('deleted')}
                        style={{
                            padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                            background: activeTab === 'deleted' ? '#e31b23' : 'transparent',
                            color: activeTab === 'deleted' ? 'white' : '#475569',
                            fontWeight: 700, fontSize: '0.85rem', transition: 'all 0.3s'
                        }}
                    >
                        Trash Bin
                    </button>
                </div>
            </motion.div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} className='align-items-center'>
                <div className="admin-search-wrapper" style={{ flex: 1 }}>
                    <Search size={20} />
                    <input
                        type="text"
                        placeholder="Search by Order ID, Customer Name or Email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {activeTab === 'deleted' && orders.length > 0 && (
                    <button
                        onClick={handleDeleteAll}
                        style={{
                            display: 'flex', alignItems: 'center',
                            padding: '12px 20px', borderRadius: '10px', border: '1px solid rgba(227,27,35,0.3)',
                            background: 'rgba(227,27,35,0.08)', color: '#e31b23',
                            fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                            transition: 'all 0.2s', whiteSpace: 'nowrap',
                        }}
                        title="Permanently delete all trashed orders"
                    >
                        <Trash size={15} /> Delete All
                    </button>
                )}
            </div>

            {activeTab === 'active' && calibrationSummary ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '18px', marginBottom: '18px' }}>
                    {[
                        {
                            label: 'Reviewed Items',
                            value: `${calibrationSummary.totals.reviewedItems}/${calibrationSummary.totals.totalItems}`,
                            hint: `${calibrationSummary.totals.tunedItems} tuned or approved`
                        },
                        {
                            label: 'Avg Unit Drift',
                            value: formatSignedNumber(calibrationSummary.totals.avgVariancePercent, 1, '%'),
                            hint: 'Actual/target vs quoted unit price'
                        },
                        {
                            label: 'Avg Setup Delta',
                            value: formatSignedNumber(calibrationSummary.totals.avgSetupDelta, 1),
                            hint: 'Actual setup count minus estimate'
                        },
                        {
                            label: 'Top Warning',
                            value: calibrationSummary.topWarnings?.[0]?.warning || 'None yet',
                            hint: calibrationSummary.topWarnings?.[0] ? `${calibrationSummary.topWarnings[0].count} occurrences` : 'No warning trend recorded'
                        },
                    ].map(card => (
                        <div key={card.label} style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(30, 41, 59, 0.92))', border: '1px solid rgba(99, 102, 241, 0.18)', borderRadius: '16px', padding: '18px 20px', boxShadow: '0 18px 36px rgba(2, 6, 23, 0.16)' }}>
                            <div style={{ fontSize: '0.74rem', color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, marginBottom: '10px' }}>{card.label}</div>
                            <div style={{ color: 'white', fontSize: card.label === 'Top Warning' ? '0.98rem' : '1.4rem', fontWeight: 800, lineHeight: 1.2 }}>{card.value}</div>
                            <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: '8px', lineHeight: 1.5 }}>{card.hint}</div>
                        </div>
                    ))}
                </div>
            ) : null}

            <div className="admin-orders-grid">
                <div className="queue-header-row">
                    <span>Order ID</span>
                    <span>Customer Details</span>
                    <span>Staged Date</span>
                    <span>Project Total</span>
                    <span>Production Status</span>
                    <span>Actions</span>
                </div>

                <div className="admin-queue-list">
                    <AnimatePresence mode="popLayout">
                        {loading ? (
                            <>
                                <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="admin-order-card skeleton-card">
                                        <div className="order-id-chip skeleton-chip" style={{ width: '50px', height: '28px', borderRadius: '8px', background: 'linear-gradient(90deg, rgba(99,102,241,0.06) 25%, rgba(99,102,241,0.14) 50%, rgba(99,102,241,0.06) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                                        <div className="customer-info"><div style={{ width: '120px', height: '14px', borderRadius: '6px', marginBottom: '6px', background: 'linear-gradient(90deg, rgba(15,23,42,0.04) 25%, rgba(15,23,42,0.08) 50%, rgba(15,23,42,0.04) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} /><div style={{ width: '170px', height: '11px', borderRadius: '6px', background: 'linear-gradient(90deg, rgba(15,23,42,0.03) 25%, rgba(15,23,42,0.06) 50%, rgba(15,23,42,0.03) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} /></div>
                                        <div className="order-timestamp"><div style={{ width: '90px', height: '14px', borderRadius: '6px', background: 'linear-gradient(90deg, rgba(15,23,42,0.03) 25%, rgba(15,23,42,0.06) 50%, rgba(15,23,42,0.03) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} /></div>
                                        <div className="order-price-total"><div style={{ width: '65px', height: '14px', borderRadius: '6px', background: 'linear-gradient(90deg, rgba(15,23,42,0.03) 25%, rgba(15,23,42,0.06) 50%, rgba(15,23,42,0.03) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} /></div>
                                        <div className="order-status"><div style={{ width: '110px', height: '32px', borderRadius: '8px', background: 'linear-gradient(90deg, rgba(245,158,11,0.06) 25%, rgba(245,158,11,0.12) 50%, rgba(245,158,11,0.06) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} /></div>
                                        <div className="order-action-hub"><div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(90deg, rgba(15,23,42,0.03) 25%, rgba(15,23,42,0.06) 50%, rgba(15,23,42,0.03) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} /></div>
                                    </div>
                                ))}
                            </>
                        ) : filteredOrders.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                                No orders found in this section.
                            </div>
                        ) : filteredOrders.map((order) => {
                            const sMeta = getStatusMeta(order.status);
                            return (
                                <motion.div
                                    key={order.id}
                                    className={`admin-order-card ${selectedOrder?.id === order.id ? 'active' : ''}`}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.15 }}
                                    layout={false}
                                    onClick={() => setSelectedOrder(order)}
                                >
                                    <div className="order-id-chip">#{order.id}</div>
                                    <div className="customer-info">
                                        <span className="name">{order.customer_name || 'Guest Explorer'}</span>
                                        <span className="email">{order.email}</span>
                                    </div>
                                    <div className="order-timestamp">
                                        <Calendar size={14} style={{ marginRight: '8px', verticalAlign: 'middle', opacity: 0.5 }} />
                                        {new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </div>
                                    <div className="order-price-total">
                                        ${parseFloat(order.total_price).toFixed(2)}
                                    </div>
                                    <div className="order-status">
                                        <select
                                            value={order.status || 'pending'}
                                            onClick={e => e.stopPropagation()}
                                            onChange={e => handleStatusChange(order.id, e.target.value, e)}
                                            style={{
                                                appearance: 'none',
                                                WebkitAppearance: 'none',
                                                background: sMeta.bg,
                                                color: sMeta.color,
                                                border: `1px solid ${sMeta.color}40`,
                                                padding: '8px 28px 8px 12px',
                                                borderRadius: '8px',
                                                fontSize: '0.78rem',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                width: '100%',
                                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(sMeta.color)}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                                                backgroundRepeat: 'no-repeat',
                                                backgroundPosition: 'right 8px center',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            {STATUS_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value} style={{ background: '#ffffff', color: '#1e293b' }}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="order-action-hub">
                                        {activeTab === 'active' ? (
                                            <button
                                                className="action-btn-circle delete-btn"
                                                onClick={(e) => handleSoftDelete(order.id, e)}
                                                title="Move to Trash"
                                                style={{ marginRight: '10px', background: 'rgba(227, 27, 35, 0.1)', color: '#e31b23', border: '1px solid rgba(227, 27, 35, 0.2)' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    className="action-btn-circle"
                                                    onClick={(e) => handleRestore(order.id, e)}
                                                    title="Restore Order"
                                                    style={{ marginRight: '10px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)' }}
                                                >
                                                    <RotateCcw size={16} />
                                                </button>
                                                <button
                                                    className="action-btn-circle"
                                                    onClick={(e) => handlePermanentDelete(order.id, e)}
                                                    title="Delete Permanently"
                                                    style={{ marginRight: '10px', background: 'rgba(227, 27, 35, 0.2)', color: '#e31b23', border: '1px solid rgba(227, 27, 35, 0.4)' }}
                                                >
                                                    <Trash size={16} />
                                                </button>
                                            </>
                                        )}
                                        <button className="action-btn-circle">
                                            <ChevronRight size={20} />
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>

            <AnimatePresence>
                {selectedOrder && (
                    <div className="order-detail-panel-overlay" onClick={() => setSelectedOrder(null)}>
                        <motion.div
                            className="order-detail-panel"
                            onClick={e => e.stopPropagation()}
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            style={{
                                position: 'fixed',
                                right: 0,
                                top: 0,
                                height: '100vh',
                                width: '100%',
                                maxWidth: '520px',
                                background: 'linear-gradient(180deg, #0a0f1e 0%, #0f172a 100%)',
                                backdropFilter: 'blur(40px)',
                                borderLeft: '1px solid rgba(99, 102, 241, 0.2)',
                                padding: 'clamp(20px, 5vw, 40px)',
                                zIndex: 1000,
                                boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.3)',
                                overflowY: 'auto'
                            }}
                        >
                            <div className="panel-inner">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'white' }}>Order #{selectedOrder.id}</h2>
                                    <button
                                        onClick={() => setSelectedOrder(null)}
                                        style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '2rem', cursor: 'pointer', opacity: 0.7 }}
                                    >
                                        &times;
                                    </button>
                                </div>

                                <div className="detail-section" style={{ marginBottom: '40px' }}>
                                    <h4 style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.15em', color: '#a5b4fc', marginBottom: '15px', fontWeight: 800 }}>
                                        Customer Engineering Profile
                                    </h4>
                                    <div style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '24px', borderRadius: '15px', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                                        <p style={{ fontWeight: 800, fontSize: '1.25rem', margin: '0 0 8px 0', color: 'white', letterSpacing: '-0.01em' }}>{selectedOrder.full_name}</p>
                                        <p style={{ color: '#94a3b8', margin: '0 0 20px 0', fontSize: '0.95rem', fontWeight: 500 }}>{selectedOrder.email}</p>
                                        <div style={{ padding: '15px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(124, 58, 237, 0.05))', borderRadius: '10px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                                            <p style={{ fontSize: '0.9rem', color: '#e2e8f0', lineHeight: 1.7, margin: 0, fontWeight: 500 }}>
                                                {selectedOrder.address}<br />
                                                {selectedOrder.city}, {selectedOrder.zip_code}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="items-section">
                                    <h4 style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.15em', color: '#a5b4fc', marginBottom: '15px', fontWeight: 800 }}>
                                        Configured Manufacturing Items
                                    </h4>
                                    <AdminItemsList orderId={selectedOrder.id} order={selectedOrder} onPreview={setPreviewItem} onCalibrationSaved={fetchCalibrationSummary} />
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {previewItem && (
                    <div className="preview-modal-overlay" style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        background: 'rgba(0,0,0,0.8)',
                        backdropFilter: 'blur(10px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2000
                    }} onClick={() => setPreviewItem(null)}>
                        <motion.div
                            className="preview-modal-content-admin"
                            onClick={e => e.stopPropagation()}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            style={{
                                background: '#111',
                                width: '900px',
                                height: '80vh',
                                borderRadius: '30px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden'
                            }}
                        >
                            <div className="preview-header" style={{ padding: '25px 40px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'white', fontWeight: 800 }}>
                                    ADMIN PREVIEW: {previewItem.item.file_name}
                                    <span style={{ opacity: 0.5, marginLeft: '10px', fontSize: '0.9rem' }}>
                                        • {previewItem.mode === 'original' ? 'RAW SOURCE' : 'MANUFACTURING MODEL'}
                                    </span>
                                </h3>
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                    <a
                                        href={previewItem.mode === 'original' ? `/${previewItem.item.original_file_path}` : `/${previewItem.item.configured_file_path}`}
                                        download
                                        style={{ color: 'white', opacity: 0.7 }}
                                        title="Download this version"
                                    >
                                        <Download size={22} />
                                    </a>
                                    <button onClick={() => setPreviewItem(null)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '2rem', opacity: 0.7 }}>&times;</button>
                                </div>
                            </div>
                            <div style={{ flex: 1, background: '#000' }}>
                                <ProjectViewer
                                    file={{
                                        name: previewItem.item.file_name,
                                        path: previewItem.mode === 'original'
                                            ? (previewItem.item.original_file_path ? '/' + previewItem.item.original_file_path : null)
                                            : (previewItem.item.configured_file_path ? '/' + previewItem.item.configured_file_path : null)
                                    }}
                                    tempPath={previewItem.item.original_file_path ? '/' + previewItem.item.original_file_path : null}
                                    configuration={previewItem.mode === 'configured' ? (typeof previewItem.item.configuration_json === 'string' ? JSON.parse(previewItem.item.configuration_json) : previewItem.item.configuration_json) : {}}
                                />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

const AdminItemsList = ({ orderId, order, onPreview, onCalibrationSaved }) => {
    const [items, setItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(true);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [savingItemId, setSavingItemId] = useState(null);
    const [drafts, setDrafts] = useState({});
    const toast = useToast();

    const buildDraft = (item) => ({
        calibrationStatus: item.calibration_status || 'untouched',
        targetUnitPrice: item.calibration_target_unit_price ?? '',
        actualUnitPrice: item.calibration_actual_unit_price ?? '',
        actualSetupCount: item.calibration_actual_setup_count ?? '',
        actualRuntimeHours: item.calibration_actual_runtime_hours ?? '',
        calibrationNotes: item.calibration_notes || '',
    });

    useEffect(() => {
        setLoadingItems(true);
        fetch(`/api/orders/${orderId}`).then(r => r.json()).then(d => {
            if (d.success) {
                setItems(d.items);
                setDrafts(Object.fromEntries(d.items.map(item => [item.id, buildDraft(item)])));
            }
        }).finally(() => setLoadingItems(false));
    }, [orderId]);

    const handleGenerateReport = async () => {
        if (!order || items.length === 0) return;
        setGeneratingPdf(true);
        try {
            await generateOrderReport(order, items);
            toast('Report generated successfully', 'success');
        } catch (err) {
            toast('Failed to generate report: ' + err.message, 'error');
        } finally {
            setGeneratingPdf(false);
        }
    };

    const updateDraft = (itemId, field, value) => {
        setDrafts(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [field]: value
            }
        }));
    };

    const handleSaveCalibration = async (itemId) => {
        const draft = drafts[itemId];
        if (!draft) return;

        setSavingItemId(itemId);
        try {
            const response = await fetch(`/api/orders/items/${itemId}/calibration`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(draft),
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Failed to save calibration');

            setItems(prev => prev.map(item => item.id === itemId ? data.item : item));
            setDrafts(prev => ({ ...prev, [itemId]: buildDraft(data.item) }));
            if (onCalibrationSaved) await onCalibrationSaved();
            toast('Calibration review saved', 'success');
        } catch (err) {
            toast('Failed to save calibration: ' + err.message, 'error');
        } finally {
            setSavingItemId(null);
        }
    };

    const skeletonPulse = {
        background: 'linear-gradient(90deg, rgba(99,102,241,0.05) 25%, rgba(99,102,241,0.12) 50%, rgba(99,102,241,0.05) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        borderRadius: '8px',
    };

    if (loadingItems) {
        return (
            <div className="admin-items-mini-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
                {[1, 2].map(i => (
                    <div key={i} style={{ background: 'rgba(99, 102, 241, 0.03)', padding: '24px', borderRadius: '15px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                        <div style={{ marginBottom: '18px' }}>
                            <div style={{ ...skeletonPulse, width: '140px', height: '18px', marginBottom: '8px' }} />
                            <div style={{ ...skeletonPulse, width: '200px', height: '14px' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                            <div style={{ ...skeletonPulse, flex: 1, height: '38px' }} />
                            <div style={{ ...skeletonPulse, flex: 1, height: '38px' }} />
                        </div>
                        <div style={{ ...skeletonPulse, width: '100%', height: '38px', marginBottom: '6px' }} />
                        <div style={{ ...skeletonPulse, width: '100%', height: '42px', marginBottom: '6px' }} />
                        <div style={{ ...skeletonPulse, width: '100%', height: '42px' }} />
                    </div>
                ))}
            </div>
        );
    }

    const reviewedCount = items.filter(item => (item.calibration_status || 'untouched') !== 'untouched').length;

    return (
        <div className="admin-items-mini-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(99, 102, 241, 0.18)', borderRadius: '16px', padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontSize: '0.74rem', color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, marginBottom: '8px' }}>Calibration Overview</div>
                        <div style={{ color: 'white', fontSize: '1.2rem', fontWeight: 800 }}>{reviewedCount}/{items.length} items reviewed</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '6px' }}>Save actual setup, runtime, and unit-price outcomes here to tune the CNC engine.</div>
                    </div>
                    <button
                        onClick={handleGenerateReport}
                        disabled={generatingPdf}
                        style={{ background: generatingPdf ? 'rgba(100,100,100,0.2)' : 'linear-gradient(135deg, rgba(227, 27, 35, 0.15), rgba(227, 27, 35, 0.25))', border: '1px solid rgba(227, 27, 35, 0.4)', color: generatingPdf ? '#94a3b8' : '#e31b23', padding: '12px 14px', borderRadius: '10px', cursor: generatingPdf ? 'wait' : 'pointer', fontSize: '0.8rem', fontWeight: 800, transition: 'all 0.3s', whiteSpace: 'nowrap' }}
                        title="Generate comprehensive PDF report with watermarks"
                    >
                        <FileText size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                        {generatingPdf ? 'GENERATING REPORT...' : 'GENERATE ORDER REPORT'}
                    </button>
                </div>
            </div>
            {items.map(item => {
                const config = typeof item.configuration_json === 'string' ? JSON.parse(item.configuration_json) : item.configuration_json;
                const quoteSnapshot = parseQuoteSnapshot(item.quote_snapshot_json);
                const metrics = quoteSnapshot?.summary?.cnc_metrics || {};
                const warnings = Array.isArray(quoteSnapshot?.summary?.warnings) ? quoteSnapshot.summary.warnings : [];
                const setupEstimate = toFiniteNumber(metrics?.setupCountEstimate) ?? toFiniteNumber(quoteSnapshot?.summary?.cnc_setup_context?.effective_setup_count);
                const quotedUnitPrice = toFiniteNumber(quoteSnapshot?.summary?.final_unit_price) ?? toFiniteNumber(quoteSnapshot?.unitPrice) ?? toFiniteNumber(item.unit_price);
                const targetUnitPrice = toFiniteNumber(item.calibration_target_unit_price);
                const actualUnitPrice = toFiniteNumber(item.calibration_actual_unit_price);
                const comparePrice = actualUnitPrice ?? targetUnitPrice;
                const variancePercent = quotedUnitPrice !== null && comparePrice !== null && quotedUnitPrice !== 0
                    ? ((comparePrice - quotedUnitPrice) / quotedUnitPrice) * 100
                    : null;
                const varianceMeta = getVarianceMeta(variancePercent);
                const draft = drafts[item.id] || buildDraft(item);
                const statusMeta = CALIBRATION_STATUS_OPTIONS.find(option => option.value === (draft.calibrationStatus || 'untouched')) || CALIBRATION_STATUS_OPTIONS[0];
                const setupDelta = setupEstimate !== null && draft.actualSetupCount !== ''
                    ? (Number(draft.actualSetupCount) - setupEstimate)
                    : null;
                return (
                    <div key={item.id} style={{ background: 'rgba(99, 102, 241, 0.03)', padding: '24px', borderRadius: '15px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '18px', flexWrap: 'wrap' }}>
                            <div>
                                <span style={{ display: 'block', fontWeight: 800, marginBottom: '6px', color: 'white', fontSize: '1.1rem', letterSpacing: '-0.01em' }}>{item.file_name}</span>
                                <span style={{ fontSize: '0.85rem', color: '#a5b4fc', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                    {config.metal?.name} - {config.thickness}mm
                                </span>
                                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ background: varianceMeta.bg, color: varianceMeta.color, padding: '6px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                        {varianceMeta.label}
                                    </span>
                                    <span style={{ background: statusMeta.bg, color: statusMeta.color, padding: '6px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                        {statusMeta.label}
                                    </span>
                                </div>
                            </div>
                            <div style={{ minWidth: '200px', color: '#cbd5f5', fontSize: '0.82rem' }}>
                                <div>Quoted unit: <strong style={{ color: 'white' }}>{formatMoney(quotedUnitPrice)}</strong></div>
                                <div>Setup estimate: <strong style={{ color: 'white' }}>{setupEstimate ?? '-'}</strong></div>
                                <div>Warnings: <strong style={{ color: 'white' }}>{warnings.length}</strong></div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '4px', flex: '1 1 100%', marginBottom: '4px' }}>
                                <button
                                    onClick={() => onPreview({ item, mode: 'original' })}
                                    style={{ flex: 1, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'rgba(255,255,255,0.6)', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                    title="Preview Raw Source"
                                >
                                    <Eye size={14} /> RAW
                                </button>
                                <button
                                    onClick={() => onPreview({ item, mode: 'configured' })}
                                    style={{ flex: 1, background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', color: '#a5b4fc', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                    title="Preview Manufacturing-Ready Design"
                                >
                                    <Eye size={14} /> FINAL
                                </button>
                            </div>

                            <a
                                href={`/${item.original_file_path}`}
                                download
                                style={{ flex: '1 1 30%', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'none', fontWeight: 600 }}
                                title="Download Raw Source"
                            >
                                <Download size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> RAW 💾
                            </a>
                            <a
                                href={`/${item.configured_file_path}`}
                                download
                                style={{ flex: '1 1 100%', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(124, 58, 237, 0.15))', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#a5b4fc', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'none', textAlign: 'center', fontWeight: 800, marginTop: '2px' }}
                                title="Download Manufacturing-Ready STEP (AP214/AP242)"
                            >
                                <FileText size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> MANU-REQ STEP 📄
                            </a>
                            <button
                                onClick={handleGenerateReport}
                                disabled={generatingPdf}
                                style={{ flex: '1 1 100%', background: generatingPdf ? 'rgba(100,100,100,0.2)' : 'linear-gradient(135deg, rgba(227, 27, 35, 0.15), rgba(227, 27, 35, 0.25))', border: '1px solid rgba(227, 27, 35, 0.4)', color: generatingPdf ? '#94a3b8' : '#e31b23', padding: '12px', borderRadius: '8px', cursor: generatingPdf ? 'wait' : 'pointer', fontSize: '0.85rem', textAlign: 'center', fontWeight: 800, marginTop: '2px', transition: 'all 0.3s' }}
                                title="Generate comprehensive PDF report with watermarks"
                            >
                                <FileText size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                {generatingPdf ? 'GENERATING REPORT...' : 'GENERATE ORDER REPORT 📋'}
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default AdminOrdersList;
