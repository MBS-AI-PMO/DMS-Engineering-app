/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
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
    Trash2
} from 'lucide-react';
import '../../styles/PremiumAdminOrders.css';

const AdminOrdersList = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [previewItem, setPreviewItem] = useState(null);

    const fetchOrders = async () => {
        try {
            const response = await fetch('/api/orders/admin/all');
            const data = await response.json();
            if (data.success) {
                setOrders(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch admin orders:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteOrder = async (orderId, e) => {
        e.stopPropagation();
        if (!window.confirm(`Are you sure you want to permanently delete Order #${orderId}? This will remove all associated manufacturing files.`)) return;

        try {
            const response = await fetch(`/api/orders/${orderId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                fetchOrders();
                if (selectedOrder?.id === orderId) {
                    setSelectedOrder(null);
                }
            } else {
                alert('Failed to delete: ' + data.error);
            }
        } catch (err) {
            console.error('Error deleting order:', err);
            alert('Failed to delete order. Check console.');
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const filteredOrders = orders.filter(o =>
        o.id.toString().includes(searchTerm) ||
        o.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusStyle = (status) => {
        switch (status) {
            case 'pending': return { class: 'pending', label: 'Pending Approval' };
            case 'processing': return { class: 'processing', label: 'In Production' };
            case 'completed': return { class: 'completed', label: 'Manufacturing Complete' };
            default: return { class: '', label: status };
        }
    };

    if (loading) return (
        <div className="admin-orders-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ color: '#e31b23', fontWeight: 800, fontSize: '1.2rem' }}
            >
                INITIALIZING PRODUCTION QUEUE...
            </motion.div>
        </div>
    );

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
            </motion.div>

            <div className="admin-search-wrapper">
                <Search size={20} />
                <input
                    type="text"
                    placeholder="Search by Order ID, Customer Name or Email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

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
                    <AnimatePresence>
                        {filteredOrders.map((order) => {
                            const status = getStatusStyle(order.status);
                            return (
                                <motion.div
                                    key={order.id}
                                    className={`admin-order-card ${selectedOrder?.id === order.id ? 'active' : ''}`}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
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
                                        <span className={`status-badge ${status.class}`}>
                                            {status.label}
                                        </span>
                                    </div>
                                    <div className="order-action-hub">
                                        <button
                                            className="action-btn-circle delete-btn"
                                            onClick={(e) => handleDeleteOrder(order.id, e)}
                                            title="Delete Order"
                                            style={{ marginRight: '10px', background: 'rgba(227, 27, 35, 0.1)', color: '#e31b23', border: '1px solid rgba(227, 27, 35, 0.2)' }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
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
                                width: '520px',
                                background: 'linear-gradient(180deg, #0a0f1e 0%, #0f172a 100%)',
                                backdropFilter: 'blur(40px)',
                                borderLeft: '1px solid rgba(99, 102, 241, 0.2)',
                                padding: '40px',
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
                                    <AdminItemsList orderId={selectedOrder.id} onPreview={setPreviewItem} />
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
                                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'white', fontWeight: 800 }}>ADMIN PREVIEW: {previewItem.file_name}</h3>
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <a href={`/${previewItem.original_file_path}`} download style={{ color: 'white', opacity: 0.7 }}><Download size={22} /></a>
                                    <button onClick={() => setPreviewItem(null)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '2rem', opacity: 0.7 }}>&times;</button>
                                </div>
                            </div>
                            <div style={{ flex: 1, background: '#000' }}>
                                <ProjectViewer
                                    file={{
                                        name: previewItem.file_name,
                                        path: previewItem.original_file_path ? '/' + previewItem.original_file_path : null
                                    }}
                                    configuration={typeof previewItem.configuration_json === 'string' ? JSON.parse(previewItem.configuration_json) : previewItem.configuration_json}
                                />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

const AdminItemsList = ({ orderId, onPreview }) => {
    const [items, setItems] = useState([]);
    useEffect(() => {
        fetch(`/api/orders/${orderId}`).then(r => r.json()).then(d => {
            if (d.success) setItems(d.items);
        });
    }, [orderId]);

    return (
        <div className="admin-items-mini-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {items.map(item => {
                const config = typeof item.configuration_json === 'string' ? JSON.parse(item.configuration_json) : item.configuration_json;
                return (
                    <div key={item.id} style={{ background: 'rgba(99, 102, 241, 0.03)', padding: '24px', borderRadius: '15px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                        <div style={{ marginBottom: '18px' }}>
                            <span style={{ display: 'block', fontWeight: 800, marginBottom: '6px', color: 'white', fontSize: '1.1rem', letterSpacing: '-0.01em' }}>{item.file_name}</span>
                            <span style={{ fontSize: '0.85rem', color: '#a5b4fc', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                {config.metal?.name} - {config.thickness}mm
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => onPreview(item)}
                                style={{ flex: '1 1 30%', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', color: '#a5b4fc', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                                title="3D Preview"
                            >
                                <Eye size={14} />
                            </button>
                            <a
                                href={`/${item.original_file_path}`}
                                download
                                style={{ flex: '1 1 30%', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', textAlign: 'center', color: '#a5b4fc', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'none', fontWeight: 600 }}
                                title="Download Raw Source"
                            >
                                <Download size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> RAW
                            </a>
                            <a
                                href={`/${item.configured_file_path}`}
                                download
                                style={{ flex: '1 1 100%', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(124, 58, 237, 0.15))', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#a5b4fc', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'none', textAlign: 'center', fontWeight: 800, marginTop: '5px' }}
                                title="Download Manufacturing-Ready STEP (AP214/AP242)"
                            >
                                <FileText size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> MANU-REQ STEP
                            </a>
                            {item.flat_file_path && (
                                <a
                                    href={`/${item.flat_file_path}`}
                                    download
                                    style={{ flex: '1 1 100%', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'none', textAlign: 'center', fontWeight: 800, marginTop: '2px' }}
                                    title="Download Laser-Ready DXF (Flat Pattern)"
                                >
                                    <FileText size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> PRODUCTION DXF
                                </a>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default AdminOrdersList;
