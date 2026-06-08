import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Search, FileText, Layers } from 'lucide-react';
import { fetchServices, fetchServicesWithUsage, updateServiceStatus } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import ImageModal from '../../components/admin/ImageModal';
import Skeleton from '../../components/Skeleton';

const widths = [170, 130, 150, 120, 140, 110, 160, 125, 145, 135];
const TableSkeleton = () => (
    <>
        {[...Array(10)].map((_, i) => {
            const isParent = i % 4 === 0;
            return (
                <tr key={i}>
                    <td style={{ paddingLeft: `${12 + (isParent ? 0 : 20)}px` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {!isParent && <Skeleton style={{ width: 8, height: 8, borderRadius: 2 }} />}
                            <Skeleton style={{ width: widths[i], height: 15 }} />
                        </div>
                    </td>
                    <td><Skeleton style={{ width: isParent ? 48 : 40, height: 22, borderRadius: 6 }} /></td>
                    <td className="hide-on-mobile"><Skeleton style={{ width: i % 2 === 0 ? 220 : 160, height: 12 }} /></td>
                    <td className="hide-on-mobile"><Skeleton style={{ width: 36, height: 36, borderRadius: 8 }} /></td>
                    <td className="hide-on-mobile"><Skeleton style={{ width: 28, height: 20, borderRadius: 12 }} /></td>
                    <td className="hide-on-mobile"><Skeleton style={{ width: 20, height: 15 }} /></td>
                    <td>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            {[28, 28, 28, 28].map((w, j) => <Skeleton key={j} style={{ width: w, height: w, borderRadius: 8 }} />)}
                        </div>
                    </td>
                </tr>
            );
        })}
    </>
);

export default function ServicesList() {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingStatusId, setUpdatingStatusId] = useState(null);
    const [search, setSearch] = useState('');
    const [zoomedImage, setZoomedImage] = useState(null);
    const navigate = useNavigate();
    const toast = useToast();

    const fetchAllData = useCallback(() => {
        setLoading(true);
        fetchServicesWithUsage({ includeInactive: true })
            .then(setServices)
            .catch(() => {
                fetchServices({ includeInactive: true }).then(setServices).catch(err => toast('Failed to load services: ' + err.message, 'error'));
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

    const handleStatusToggle = async (service) => {
        const nextActive = service.is_active === false;
        setUpdatingStatusId(service.id);
        try {
            await updateServiceStatus(service.id, nextActive);
            setServices(prev => prev.map(item => (
                Number(item.id) === Number(service.id)
                    ? { ...item, is_active: nextActive }
                    : item
            )));
            toast(`${service.title} marked ${nextActive ? 'active' : 'inactive'}`, 'success');
        } catch (err) {
            toast('Status update failed: ' + err.message, 'error');
        } finally {
            setUpdatingStatusId(null);
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
                                const isActive = svc.is_active !== false;
                                return (
                                    <tr key={svc.id} className={!isActive ? 'service-row-inactive' : ''}>
                                        <td style={{ paddingLeft: `${12 + indent * 10}px` }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {indent > 0 && <span style={{ color: '#cbd5e1', fontSize: '10px' }}>└</span>}
                                                    <strong style={{ fontSize: '14px', lineHeight: '1.2' }}>{svc.title}</strong>
                                                    {!isActive && <span className="badge-inactive">Inactive</span>}
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
                                                <button
                                                    className={`service-status-toggle ${isActive ? 'active' : 'inactive'}`}
                                                    onClick={() => handleStatusToggle(svc)}
                                                    disabled={updatingStatusId === svc.id}
                                                    title={isActive ? 'Set inactive' : 'Set active'}
                                                >
                                                    <span className="status-toggle-track">
                                                        <span className="status-toggle-knob" />
                                                    </span>
                                                    <span>{isActive ? 'Active' : 'Inactive'}</span>
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
                .badge-inactive {
                    background: #fff7ed;
                    color: #c2410c;
                    padding: 2px 7px;
                    border-radius: 999px;
                    border: 1px solid #fed7aa;
                    font-size: 0.68rem;
                    font-weight: 800;
                }
                .service-row-inactive {
                    background: #fffaf5;
                }
                .service-row-inactive td {
                    color: #64748b;
                }
                .service-status-toggle {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    min-width: 92px;
                    height: 32px;
                    padding: 0 10px;
                    border: none;
                    border-radius: 999px;
                    font-size: 0.72rem;
                    font-weight: 900;
                    cursor: pointer;
                    transition: opacity 0.2s ease, transform 0.2s ease, background 0.2s ease;
                }
                .service-status-toggle:disabled {
                    cursor: wait;
                    opacity: 0.62;
                }
                .service-status-toggle:not(:disabled):hover {
                    transform: translateY(-1px);
                }
                .service-status-toggle.active {
                    color: #047857;
                    background: #ecfdf5;
                }
                .service-status-toggle.inactive {
                    color: #c2410c;
                    background: #fff7ed;
                }
                .status-toggle-track {
                    position: relative;
                    width: 28px;
                    height: 16px;
                    flex: 0 0 28px;
                    border-radius: 999px;
                    background: currentColor;
                    opacity: 0.28;
                }
                .status-toggle-knob {
                    position: absolute;
                    top: 3px;
                    left: 3px;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: #ffffff;
                    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.2);
                    transition: transform 0.2s ease;
                }
                .service-status-toggle.active .status-toggle-knob {
                    transform: translateX(12px);
                }
            `}</style>
        </div>
    );
}
