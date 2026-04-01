/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Package,
    Download,
    Eye,
    Clock,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    FileText,
    Boxes,
    Search,
    ShieldCheck
} from 'lucide-react';
import ProjectViewer from '../components/viewer/ProjectViewer';
import '../styles/PremiumOrders.css';

// Helper to ensure JSON is parsed correctly regardless of DB driver behavior
const parseConfig = (config) => {
    if (typeof config === 'string') {
        try { return JSON.parse(config); } catch (e) { return {}; }
    }
    return config || {};
};

// Memoized Item Row for maximum render performance
const ItemRow = React.memo(({ item, onPreview }) => {
    const config = useMemo(() => parseConfig(item.configuration_json), [item.configuration_json]);

    return (
        <div className="item-row">
            <div className="item-main">
                <span className="item-name">{item.file_name}</span>
                <span className="item-spec">
                    {config.metal?.name || 'Standard Metal'} • {config.thickness}mm
                </span>
            </div>
            <div className="item-qty">{item.quantity}</div>
            <div className="item-price">${parseFloat(item.unit_price).toFixed(2)}</div>
            <div className="item-actions">
                <button className="btn-icon" onClick={() => onPreview(item)} title="Preview 3D">
                    <Eye size={18} />
                </button>
                <a href={`/${item.original_file_path}`} download className="btn-icon" title="Download Raw File">
                    <Download size={18} />
                </a>
                <a href={`/${item.configured_file_path}`} download className="btn-icon secondary" title="Download Configured File">
                    <FileText size={18} />
                </a>
            </div>
        </div>
    );
});

// Memoized List to prevent summary-toggle re-renders
const OrderItemsList = React.memo(({ items, loading }) => {
    if (loading) {
        return (
            <div className="items-loading-skeleton">
                {[1, 2].map(i => (
                    <div key={i} className="skeleton-row-mini" />
                ))}
            </div>
        );
    }

    if (!items || items.length === 0) return <div className="no-items">No items found for this order.</div>;

    return (
        <div className="order-items-table">
            <div className="items-header">
                <span>Product / Specification</span>
                <span>Qty</span>
                <span>Price</span>
                <span>Actions</span>
            </div>
            {items.map((item) => (
                <ItemRow key={item.id} item={item} onPreview={(it) => window.dispatchEvent(new CustomEvent('open-preview', { detail: it }))} />
            ))}
        </div>
    );
});

const Orders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedOrder, setExpandedOrder] = useState(null);
    const [previewItem, setPreviewItem] = useState(null);
    const [itemsCache, setItemsCache] = useState({}); // { [orderId]: { items, loading } }

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await fetch('/api/orders/my-orders');
                const data = await response.json();
                if (data.success) {
                    setOrders(data.data);
                }
            } catch (err) {
                console.error('Failed to fetch orders:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();

        // Listen for internal preview events from memoized children
        const handlePreview = (e) => setPreviewItem(e.detail);
        window.addEventListener('open-preview', handlePreview);
        return () => window.removeEventListener('open-preview', handlePreview);
    }, []);

    const fetchOrderItems = async (orderId) => {
        // Skip if already in cache and not currently loading
        if (itemsCache[orderId]?.items) return;

        setItemsCache(prev => ({ ...prev, [orderId]: { ...prev[orderId], loading: true } }));
        try {
            const response = await fetch(`/api/orders/${orderId}`);
            const data = await response.json();
            if (data.success) {
                setItemsCache(prev => ({
                    ...prev,
                    [orderId]: { items: data.items, loading: false }
                }));
            }
        } catch (err) {
            console.error('Failed to fetch items:', err);
            setItemsCache(prev => ({ ...prev, [orderId]: { loading: false } }));
        }
    };

    const toggleOrder = (orderId) => {
        if (expandedOrder !== orderId) {
            fetchOrderItems(orderId);
            setExpandedOrder(orderId);
        } else {
            setExpandedOrder(null);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'pending': return <span className="badge-status pending"><Clock size={12} /> Pending</span>;
            case 'processing': return <span className="badge-status processing"><Boxes size={12} /> Processing</span>;
            case 'completed': return <span className="badge-status completed"><CheckCircle2 size={12} /> Completed</span>;
            default: return <span className="badge-status">{status}</span>;
        }
    };

    const ordersToRender = useMemo(() => orders, [orders]);

    if (loading) {
        return (
            <div className="orders-page">
                <div className="container">
                    <div className="skeleton-list">
                        {[1, 2, 3].map(i => <div key={i} className="skeleton-item" />)}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="orders-page">
            <div className="container">
                <div className="orders-header">
                    <div className="header-content">
                        <h1>Order History</h1>
                        <p>Track and manage your manufacturing projects</p>
                    </div>
                    <div className="orders-search">
                        <Search size={18} />
                        <input type="text" placeholder="Search orders..." />
                    </div>
                </div>

                {ordersToRender.length === 0 ? (
                    <div className="empty-orders">
                        <Package size={48} />
                        <h3>No orders found</h3>
                        <p>Your manufacturing orders will appear here once placed.</p>
                    </div>
                ) : (
                    <div className="orders-list">
                        {ordersToRender.map((order) => (
                            <div key={order.id} className={`order-card ${expandedOrder === order.id ? 'expanded' : ''}`}>
                                <div className="order-summary" onClick={() => toggleOrder(order.id)}>
                                    <div className="order-info">
                                        <div className="order-id">
                                            <span className="label">Order ID</span>
                                            <span className="value">#{order.id}</span>
                                        </div>
                                        <div className="order-date">
                                            <span className="label">Date</span>
                                            <span className="value">{new Date(order.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <div className="order-total">
                                            <span className="label">Total Amount</span>
                                            <span className="value">${parseFloat(order.total_price).toFixed(2)}</span>
                                        </div>
                                        <div className="order-status">
                                            {getStatusBadge(order.status)}
                                        </div>
                                    </div>
                                    <div className="order-toggle">
                                        {expandedOrder === order.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {expandedOrder === order.id && (
                                        <motion.div
                                            className="order-details"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                        >
                                            <OrderItemsList
                                                items={itemsCache[order.id]?.items}
                                                loading={itemsCache[order.id]?.loading}
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Preview Modal */}
            <AnimatePresence>
                {previewItem && (
                    <div className="preview-modal-overlay" onClick={() => setPreviewItem(null)}>
                        <motion.div
                            className="preview-modal-content"
                            onClick={e => e.stopPropagation()}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                        >
                            <div className="preview-modal-header">
                                <h3>{previewItem.file_name}</h3>
                                <button onClick={() => setPreviewItem(null)}>&times;</button>
                            </div>
                            <div className="preview-body">
                                <div className="preview-viewer-wrap">
                                    <ProjectViewer
                                        file={{
                                            name: previewItem.file_name,
                                            path: previewItem.original_file_path ? '/' + previewItem.original_file_path : null
                                        }}
                                        configuration={parseConfig(previewItem.configuration_json)}
                                    />
                                </div>
                                <div className="preview-meta">
                                    <h4>Configuration Details</h4>
                                    <div className="meta-grid">
                                        <div className="meta-item">
                                            <span className="label">Material</span>
                                            <span className="value">{parseConfig(previewItem.configuration_json).metal?.name}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="label">Thickness</span>
                                            <span className="value">{parseConfig(previewItem.configuration_json).thickness}mm</span>
                                        </div>
                                        {parseConfig(previewItem.configuration_json).anodizingColor && (
                                            <div className="meta-item">
                                                <span className="label">Anodizing</span>
                                                <span className="value">{parseConfig(previewItem.configuration_json).anodizingColor.name}</span>
                                            </div>
                                        )}
                                        <div className="meta-item">
                                            <span className="label">Secure Manufacturing</span>
                                            <span className="value" style={{ color: '#00c853', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <ShieldCheck size={18} /> Verified Quality
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};


export default Orders;
