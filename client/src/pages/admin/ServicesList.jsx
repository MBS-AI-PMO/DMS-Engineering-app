/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, Search, FileText, Layers, X } from 'lucide-react';
import { fetchServices, deleteService, fetchServicesWithUsage } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import ImageModal from '../../components/admin/ImageModal';

export default function ServicesList() {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [search, setSearch] = useState('');
    const [zoomedImage, setZoomedImage] = useState(null);
    const navigate = useNavigate();
    const toast = useToast();

    const fetchAllData = () => {
        setLoading(true);
        fetchServicesWithUsage()
            .then(setServices)
            .catch(() => {
                fetchServices().then(setServices).catch(console.error);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    // Build hierarchical tree and flatten it for display
    const getFlattenedHierarchy = (items, parentId = null, depth = 0) => {
        const levelItems = items
            .filter(item => item.parent_id === parentId)
            .sort((a, b) => a.display_order - b.display_order);

        let result = [];
        levelItems.forEach(item => {
            result.push({ ...item, depth });
            result = result.concat(getFlattenedHierarchy(items, item.id, depth + 1));
        });
        return result;
    };

    const getServicesToDisplay = () => {
        if (!search) return getFlattenedHierarchy(services);

        const searchLower = search.toLowerCase();
        const matches = services.filter(s => s.title.toLowerCase().includes(searchLower));

        // If we want to show parents of matched children (highly recommended for tree context)
        const toShow = new Set();
        matches.forEach(m => {
            let curr = m;
            while (curr) {
                toShow.add(curr.id);
                curr = services.find(s => s.id === curr.parent_id);
            }
        });

        const filteredSet = services.filter(s => toShow.has(s.id));
        return getFlattenedHierarchy(filteredSet);
    };

    const displayServices = getServicesToDisplay();

    const handleDelete = async (id) => {
        try {
            await deleteService(id);
            setServices(prev => prev.filter(s => s.id !== id));
            setConfirmDelete(null);
            toast('Service deleted', 'success');
        } catch (err) {
            toast('Delete failed: ' + err.message, 'error');
        }
    };

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <h1 className="admin-page-title">Services</h1>
                <button className="admin-btn-primary" onClick={() => navigate('/admin/services/new')}>
                    <Plus size={16} /> Add Service
                </button>
            </div>

            <div className="admin-search-bar">
                <Search size={16} />
                <input
                    type="text"
                    placeholder="Search services..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {loading ? (
                [...Array(6)].map((_, i) => <div key={i} className="skeleton skeleton-table-row" />)
            ) : (
                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Type</th>
                                <th>Description</th>
                                <th>Image</th>
                                <th>Metals</th>
                                <th>Order</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayServices.map(svc => {
                                const indent = svc.depth || 0;
                                return (
                                    <tr key={svc.id}>
                                        <td style={{ paddingLeft: `${20 + indent * 24}px` }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {indent > 0 && <span style={{ color: '#cbd5e1' }}>└</span>}
                                                <strong>{svc.title}</strong>
                                            </div>
                                        </td>
                                        <td>
                                            {svc.is_production ? (
                                                <span className="badge-production">Main</span>
                                            ) : svc.parent_id ? (
                                                <span className="badge-sub">Sub</span>
                                            ) : (
                                                <span className="table-cell-muted">Standard</span>
                                            )}
                                        </td>
                                        <td className="table-cell-muted">{svc.description?.substring(0, 40)}{svc.description?.length > 40 ? '...' : ''}</td>
                                        <td>
                                            {svc.image_path ? (
                                                <img
                                                    src={svc.image_path}
                                                    alt={svc.title}
                                                    className="table-thumb"
                                                    onClick={() => setZoomedImage({ src: svc.image_path, title: svc.title })}
                                                />
                                            ) : (
                                                <span className="table-cell-muted">—</span>
                                            )}
                                        </td>
                                        <td>
                                            <span style={{
                                                background: parseInt(svc.metal_count) > 0 ? '#ecfdf5' : '#f3f4f6',
                                                color: parseInt(svc.metal_count) > 0 ? '#065f46' : '#6b7280',
                                                borderRadius: 12,
                                                padding: '2px 8px',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                            }}>
                                                {svc.metal_count != null ? svc.metal_count : '—'}
                                            </span>
                                        </td>
                                        <td>{svc.display_order}</td>
                                        <td>
                                            <div className="table-actions">
                                                <button
                                                    className="admin-icon-btn"
                                                    title="Configure Metals"
                                                    onClick={() => navigate(`/admin/services/${svc.id}/metals`)}
                                                    style={{ color: '#8b5cf6' }}
                                                >
                                                    <Layers size={16} />
                                                </button>
                                                <button
                                                    className="admin-icon-btn"
                                                    title="Configure Guidelines"
                                                    onClick={() => navigate(`/admin/guidelines/${svc.id}`)}
                                                    style={{ color: '#0ea5e9' }}
                                                >
                                                    <FileText size={16} />
                                                </button>
                                                <button className="admin-icon-btn" onClick={() => navigate(`/admin/services/${svc.id}`)}>
                                                    <Edit2 size={16} />
                                                </button>
                                                <button className="admin-icon-btn danger" onClick={() => setConfirmDelete(svc)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {displayServices.length === 0 && <div className="admin-empty">No services found.</div>}
                </div>
            )}

            {/* Delete confirmation remains in separate modal for safety */}
            <AnimatePresence>
                {confirmDelete && (
                    <motion.div className="admin-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmDelete(null)}>
                        <motion.div className="admin-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                            <div className="admin-modal-header">
                                <h3>Delete Service</h3>
                                <button className="admin-icon-btn" onClick={() => setConfirmDelete(null)}><X size={16} /></button>
                            </div>
                            <p style={{ margin: '20px 0', color: '#64748b' }}>
                                Are you sure you want to delete <strong>{confirmDelete.title}</strong>? This action cannot be undone.
                            </p>
                            <div className="admin-modal-actions">
                                <button className="admin-btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
                                <button className="admin-btn-danger" onClick={() => handleDelete(confirmDelete.id)}>Delete Service</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <ImageModal
                src={zoomedImage?.src}
                alt={zoomedImage?.title}
                onClose={() => setZoomedImage(null)}
            />

            <style>{`
                .badge-production {
                    background: #fdf2f2;
                    color: #9b1c1c;
                    padding: 2px 8px;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    border: 1px solid #fbd5d5;
                }
                .badge-sub {
                    background: #f0f9ff;
                    color: #0369a1;
                    padding: 2px 8px;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    border: 1px solid #bae6fd;
                }
            `}</style>
        </div>
    );
}
