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
    FileText
} from 'lucide-react';
import ProjectViewer from '../../components/viewer/ProjectViewer';

const AdminOrdersList = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [previewItem, setPreviewItem] = useState(null);

    useEffect(() => {
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
        fetchOrders();
    }, []);

    const filteredOrders = orders.filter(o =>
        o.id.toString().includes(searchTerm) ||
        o.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusStyle = (status) => {
        switch (status) {
            case 'pending': return { bg: '#fff7ed', text: '#9a3412', label: 'Pending Approval' };
            case 'processing': return { bg: '#eff6ff', text: '#1e40af', label: 'In Production' };
            case 'completed': return { bg: '#f0fdf4', text: '#166534', label: 'Manufacturing Complete' };
            default: return { bg: '#f9fafb', text: '#374151', label: status };
        }
    };

    if (loading) return <div className="admin-loading">Initializing Order Management...</div>;

    return (
        <div className="admin-orders-container">
            <div className="admin-header">
                <div>
                    <h1>Manufacturing Orders</h1>
                    <p>Global production queue and customer projects</p>
                </div>
                <div className="admin-actions">
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search by ID, Customer..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="admin-orders-grid">
                <div className="orders-table-card">
                    <div className="table-header">
                        <span>Order ID</span>
                        <span>Customer</span>
                        <span>Date</span>
                        <span>Total</span>
                        <span>Status</span>
                        <span>Actions</span>
                    </div>
                    <div className="table-body">
                        {filteredOrders.map((order) => {
                            const status = getStatusStyle(order.status);
                            return (
                                <div key={order.id} className={`table-row ${selectedOrder?.id === order.id ? 'active' : ''}`} onClick={() => setSelectedOrder(order)}>
                                    <div className="order-id">#{order.id}</div>
                                    <div className="customer-info">
                                        <span className="name">{order.customer_name || 'Guest'}</span>
                                        <span className="email">{order.email}</span>
                                    </div>
                                    <div className="order-date">{new Date(order.created_at).toLocaleDateString()}</div>
                                    <div className="order-total">${parseFloat(order.total_price).toFixed(2)}</div>
                                    <div className="order-status">
                                        <span className="status-pill" style={{ backgroundColor: status.bg, color: status.text }}>
                                            {status.label}
                                        </span>
                                    </div>
                                    <div className="order-actions">
                                        <button className="btn-icon">
                                            <ChevronRight size={20} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <AnimatePresence>
                    {selectedOrder && (
                        <motion.div
                            className="order-detail-panel"
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 20, opacity: 0 }}
                        >
                            <div className="panel-header">
                                <h3>Order Details #{selectedOrder.id}</h3>
                                <button className="btn-close" onClick={() => setSelectedOrder(null)}>&times;</button>
                            </div>
                            <div className="panel-content">
                                <div className="info-section">
                                    <h4 className="small-label">Customer Info</h4>
                                    <div className="customer-card">
                                        <div className="avatar">{selectedOrder.customer_name?.[0]?.toUpperCase() || 'G'}</div>
                                        <div>
                                            <p className="name">{selectedOrder.full_name}</p>
                                            <p className="email">{selectedOrder.email}</p>
                                            <p className="address">{selectedOrder.address}, {selectedOrder.city} {selectedOrder.zip_code}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="items-section">
                                    <h4 className="small-label">Configured Items</h4>
                                    <AdminItemsList orderId={selectedOrder.id} onPreview={setPreviewItem} />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Preview Modal (Internal) */}
            <AnimatePresence>
                {previewItem && (
                    <div className="preview-modal-overlay" onClick={() => setPreviewItem(null)}>
                        <motion.div
                            className="preview-modal-content admin-size"
                            onClick={e => e.stopPropagation()}
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                        >
                            <div className="preview-modal-header">
                                <h3>ADMIN PREVIEW: {previewItem.file_name}</h3>
                                <div className="actions-group">
                                    <button className="btn-icon" title="Download Raw"><Download size={20} /></button>
                                    <button className="btn-close" onClick={() => setPreviewItem(null)}>&times;</button>
                                </div>
                            </div>
                            <div className="preview-body">
                                <div className="preview-viewer-wrap">
                                    <ProjectViewer
                                        file={{ name: previewItem.file_name }}
                                        configuration={previewItem.configuration_json}
                                    />
                                </div>
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
        <div className="admin-items-mini-list">
            {items.map(item => (
                <div key={item.id} className="item-mini-card">
                    <div className="item-meta">
                        <span className="file-name">{item.file_name}</span>
                        <span className="spec-info">{item.configuration_json.metal?.name} - {item.configuration_json.thickness}mm</span>
                    </div>
                    <div className="item-btns">
                        <button className="btn-text-icon" onClick={() => onPreview(item)}>
                            <Eye size={14} /> Preview
                        </button>
                        <a href={`/${item.original_file_path}`} download className="btn-text-icon">
                            <Download size={14} /> Raw
                        </a>
                        <a href={`/${item.configured_file_path}`} download className="btn-text-icon highlight">
                            <FileText size={14} /> Configured
                        </a>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default AdminOrdersList;
