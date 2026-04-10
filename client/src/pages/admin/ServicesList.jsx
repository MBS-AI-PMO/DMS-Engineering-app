/* eslint-disable no-unused-vars */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, Search, FileText, Layers, X } from 'lucide-react';
import { fetchServices, deleteService, fetchServicesWithUsage } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import ImageModal from '../../components/admin/ImageModal';

const TableSkeleton = () => (
    <>
        {[...Array(8)].map((_, i) => (
            <tr key={i}>
                <td style={{ paddingLeft: `${20 + (i % 3 === 0 ? 0 : 24)}px` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {i % 3 !== 0 && <div className="skeleton-item" style={{ width: '8px', height: '8px', borderRadius: '2px', opacity: 0.3 }} />}
                        <div className="skeleton-item" style={{ width: i % 2 === 0 ? '160px' : '120px', height: '18px', borderRadius: '4px' }} />
                    </div>
                </td>
                <td>
                    <div className="skeleton-item" style={{ width: '45px', height: '22px', borderRadius: '6px' }} />
                </td>
                <td>
                    <div className="skeleton-item" style={{ width: i % 2 === 0 ? '240px' : '180px', height: '12px', borderRadius: '4px' }} />
                </td>
                <td>
                    <div className="skeleton-item" style={{ width: '36px', height: '36px', borderRadius: '8px' }} />
                </td>
                <td>
                    <div className="skeleton-item" style={{ width: '28px', height: '20px', borderRadius: '12px' }} />
                </td>
                <td>
                    <div className="skeleton-item" style={{ width: '20px', height: '16px', borderRadius: '4px' }} />
                </td>
                <td>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <div className="skeleton-item" style={{ width: '28px', height: '28px', borderRadius: '8px' }} />
                        <div className="skeleton-item" style={{ width: '28px', height: '28px', borderRadius: '8px' }} />
                        <div className="skeleton-item" style={{ width: '28px', height: '28px', borderRadius: '8px' }} />
                    </div>
                </td>
            </tr>
        ))}
    </>
);

export default function ServicesList() {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [search, setSearch] = useState('');
    const [zoomedImage, setZoomedImage] = useState(null);
    const navigate = useNavigate();
    const toast = useToast();

    const fetchAllData = useCallback(() => {
        setLoading(true);
        fetchServicesWithUsage()
            .then(setServices)
            .catch(() => {
                fetchServices().then(setServices).catch(err => toast('Failed to load services: ' + err.message, 'error'));
            })
            .finally(() => {
                // Keep loading for at least 600ms for smooth feel
                setTimeout(() => setLoading(false), 600);
            });
    }, [toast]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // Build hierarchical tree and flatten it for display
    const getFlattenedHierarchy = (items, parentId = null, depth = 0, seen = new Set()) => {
        const levelItems = items
            .filter(item => {
                const pids = item.parent_ids || [];
                if (parentId === null) {
                    return pids.length === 0 || item.is_production;
                }
                return pids.some(pid => Number(pid) === Number(parentId));
            })
            .sort((a, b) => a.display_order - b.display_order);

        let result = [];
        levelItems.forEach(item => {
            // Avoid infinite recursion if there's a circular relationship (safety)
            const itemKey = `${item.id}-${parentId}`;
            if (seen.has(itemKey)) return;
            seen.add(itemKey);

            result.push({ ...item, depth });
            // Only recurse if we are not too deep (safety)
            if (depth < 5) {
                result = result.concat(getFlattenedHierarchy(items, item.id, depth + 1, seen));
            }
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
            let stack = [m];
            while (stack.length > 0) {
                let curr = stack.pop();
                if (toShow.has(curr.id)) continue;
                toShow.add(curr.id);
                // Find all parents of this service
                const parents = services.filter(s => (curr.parent_ids || []).some(pid => Number(pid) === Number(s.id)));
                stack.push(...parents);
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

            <div className="admin-table-wrapper" style={{ minHeight: '400px' }}>
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
                        {loading ? (
                            <TableSkeleton />
                        ) : (
                            displayServices.map(svc => {
                                const indent = svc.depth || 0;
                                return (
                                    <tr key={svc.id}>
                                        <td style={{ paddingLeft: `${12 + indent * 10}px` }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {indent > 0 && <span style={{ color: '#cbd5e1', fontSize: '10px' }}>└</span>}
                                                    <strong style={{ fontSize: '14px', lineHeight: '1.2' }}>{svc.title}</strong>
                                                </div>
                                                {svc.is_production && svc.pricing_config?.base_setup !== undefined && (
                                                    <span style={{ fontSize: 9, color: '#64748b', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        Base: ${svc.pricing_config.base_setup}
                                                        {svc.pricing_config.price_per_length ? ` + ${svc.pricing_config.price_per_length}/in(L)` : ''}
                                                        {svc.pricing_config.price_per_width ? ` + ${svc.pricing_config.price_per_width}/in(W)` : ''}
                                                        {svc.pricing_config.price_per_thickness ? ` + ${svc.pricing_config.price_per_thickness}/in(T)` : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            {svc.is_production ? (
                                                <span className="badge-production">Main</span>
                                            ) : (svc.parent_ids && svc.parent_ids.length > 0) ? (
                                                <span className="badge-sub">Sub</span>
                                            ) : (
                                                <span className="table-cell-muted hide-on-mobile">Standard</span>
                                            )}
                                        </td>
                                        <td className="hide-on-mobile">{svc.description?.substring(0, 40)}{svc.description?.length > 40 ? '...' : ''}</td>
                                        <td className="hide-on-mobile">
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
                                        <td className="hide-on-mobile">
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
                                        <td className="hide-on-mobile">{svc.display_order}</td>
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
                            })
                        )}
                    </tbody>
                </table>
                {!loading && displayServices.length === 0 && <div className="admin-empty">No services found.</div>}
            </div>

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
