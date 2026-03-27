import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';  // eslint-disable-line no-unused-vars
import { Save, X, Upload, Layers, Shield, CornerDownRight, ChevronLeft, Loader2 } from 'lucide-react';
import { fetchServices, createService, updateService, uploadServiceImage } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

const emptyService = {
    title: '', description: '', image_path: '', display_order: 0,
    is_production: false, parent_id: null,
    min_length: 0, max_length: 0, min_width: 0, max_width: 0, min_height: 0, max_height: 0,
    dimensions_unit: 'in'
};

export default function ServiceEdit() {
    const { id } = useParams();
    const isNew = !id;
    const navigate = useNavigate();
    const toast = useToast();

    const [service, setService] = useState(emptyService);
    const [allServices, setAllServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const svcs = await fetchServices();
                setAllServices(svcs.data || []);

                if (!isNew) {
                    const match = svcs.data.find(s => s.id === parseInt(id));
                    if (match) setService({ ...match });
                    else setError('Service not found');
                }
            } catch (err) {
                setError('Failed to load data: ' + err.message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, isNew]);

    const handleSave = async () => {
        if (!service.title) {
            toast('Title is required', 'error');
            return;
        }
        setSaving(true);
        try {
            if (isNew) {
                await createService(service);
                toast('Service created successfully', 'success');
            } else {
                await updateService(id, service);
                toast('Service updated successfully', 'success');
            }
            navigate('/admin/services');
        } catch (err) {
            toast('Failed to save: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const res = await uploadServiceImage(file);
            setService(prev => ({ ...prev, image_path: res.data.path }));
            toast('Image uploaded successfully', 'success');
        } catch (err) {
            toast('Upload failed: ' + err.message, 'error');
        } finally {
            setUploading(false);
        }
    };

    if (loading) return (
        <div className="admin-loading-full">
            <Loader2 className="animate-spin" size={48} />
            <p>Loading service details...</p>
        </div>
    );

    if (error) return (
        <div className="admin-error-container">
            <h3>Error</h3>
            <p>{error}</p>
            <Link to="/admin/services" className="admin-btn admin-btn-outline">Back to Services</Link>
        </div>
    );

    return (
        <div className="admin-edit-page">
            <header className="admin-edit-header">
                <div className="admin-edit-breadcrumb">
                    <Link to="/admin/services"><ChevronLeft size={16} /> Services</Link>
                    <span>/</span>
                    <strong>{isNew ? 'New Service' : `Edit: ${service.title}`}</strong>
                </div>
                <div className="admin-edit-actions">
                    <button className="admin-btn admin-btn-outline" onClick={() => navigate('/admin/services')}>
                        <X size={18} /> Cancel
                    </button>
                    <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Save Changes
                    </button>
                </div>
            </header>

            <main className="admin-edit-content">
                <div className="admin-edit-grid">
                    <section className="admin-edit-main">
                        <div className="admin-edit-card">
                            <h3>General Information</h3>
                            <div className="admin-form-group">
                                <label>Title</label>
                                <input
                                    type="text"
                                    value={service.title}
                                    onChange={e => setService(s => ({ ...s, title: e.target.value }))}
                                    placeholder="e.g., CNC Machining"
                                />
                            </div>
                            <div className="admin-form-group">
                                <label>Description</label>
                                <textarea
                                    rows={4}
                                    value={service.description}
                                    onChange={e => setService(s => ({ ...s, description: e.target.value }))}
                                    placeholder="Enter service details..."
                                />
                            </div>
                        </div>

                        <div className="admin-edit-card">
                            <div className="admin-hierarchy-header" style={{ marginBottom: '16px' }}>
                                <Shield size={16} />
                                <span>Hierarchy & Relationships</span>
                            </div>

                            <div className="admin-form-group-inline">
                                <div className="toggle-switch-group" onClick={() => setService(s => ({ ...s, is_production: !s.is_production, parent_id: !s.is_production ? null : s.parent_id }))}>
                                    <div className={`toggle-switch ${service.is_production ? 'active' : ''}`}>
                                        <div className="toggle-handle" />
                                    </div>
                                    <span>Is Main Production Service</span>
                                </div>
                            </div>

                            <AnimatePresence>
                                {!service.is_production && (
                                    <motion.div
                                        className="admin-form-group"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        style={{ marginTop: '16px' }}
                                    >
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <CornerDownRight size={14} />
                                            <span>Parent Service (if any)</span>
                                        </label>
                                        <select
                                            value={service.parent_id || ''}
                                            onChange={e => setService(s => ({ ...s, parent_id: parseInt(e.target.value) || null }))}
                                        >
                                            <option value="">None (Top Level)</option>
                                            {allServices
                                                .filter(s => s.id !== parseInt(id))
                                                .map(s => (
                                                    <option key={s.id} value={s.id}>{s.title}</option>
                                                ))
                                            }
                                        </select>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <AnimatePresence>
                            {service.is_production && (
                                <motion.div
                                    className="admin-edit-card production-capacity"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                >
                                    <div className="admin-hierarchy-header" style={{ justifyContent: 'space-between', marginBottom: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Layers size={16} />
                                            <span>Production Capacity</span>
                                        </div>
                                        <div className="unit-toggle-pills">
                                            <button
                                                className={`unit-pill ${service.dimensions_unit === 'in' ? 'active' : ''}`}
                                                onClick={() => setService(s => ({ ...s, dimensions_unit: 'in' }))}
                                            >
                                                IN
                                            </button>
                                            <button
                                                className={`unit-pill ${service.dimensions_unit === 'mm' ? 'active' : ''}`}
                                                onClick={() => setService(s => ({ ...s, dimensions_unit: 'mm' }))}
                                            >
                                                MM
                                            </button>
                                        </div>
                                    </div>

                                    <div className="capacity-grid">
                                        <div className="capacity-row header">
                                            <div className="capacity-label-cell">Dimension</div>
                                            <div className="capacity-input-cell">Min ({service.dimensions_unit})</div>
                                            <div className="capacity-input-cell">Max ({service.dimensions_unit})</div>
                                        </div>

                                        {[
                                            { label: 'Length', min: 'min_length', max: 'max_length' },
                                            { label: 'Width', min: 'min_width', max: 'max_width' },
                                            { label: 'Height', min: 'min_height', max: 'max_height' }
                                        ].map(dim => (
                                            <div className="capacity-row" key={dim.label}>
                                                <div className="capacity-label-cell">{dim.label}</div>
                                                <div className="capacity-input-cell">
                                                    <input
                                                        type="number"
                                                        step="0.0001"
                                                        value={service[dim.min]}
                                                        onChange={e => setService(s => ({ ...s, [dim.min]: parseFloat(e.target.value) || 0 }))}
                                                    />
                                                </div>
                                                <div className="capacity-input-cell">
                                                    <input
                                                        type="number"
                                                        step="0.0001"
                                                        value={service[dim.max]}
                                                        onChange={e => setService(s => ({ ...s, [dim.max]: parseFloat(e.target.value) || 0 }))}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </section>

                    <aside className="admin-edit-sidebar">
                        <div className="admin-edit-card image-upload-card">
                            <h3>Service Image</h3>
                            <div className="admin-image-preview-large">
                                {service.image_path ? (
                                    <img src={service.image_path} alt="Preview" />
                                ) : (
                                    <div className="image-placeholder">No Image</div>
                                )}
                            </div>
                            <div className="admin-form-group">
                                <label>Image Path</label>
                                <input
                                    type="text"
                                    value={service.image_path}
                                    onChange={e => setService(s => ({ ...s, image_path: e.target.value }))}
                                />
                            </div>
                            <div className="upload-btn-container">
                                <label className="admin-btn admin-btn-outline upload-btn">
                                    {uploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                                    Upload New Image
                                    <input type="file" onChange={handleImageUpload} hidden accept="image/*" />
                                </label>
                            </div>
                        </div>

                        <div className="admin-edit-card">
                            <h3>Metadata</h3>
                            <div className="admin-form-group">
                                <label>Display Order</label>
                                <input
                                    type="number"
                                    value={service.display_order}
                                    onChange={e => setService(s => ({ ...s, display_order: parseInt(e.target.value) || 0 }))}
                                />
                            </div>
                        </div>
                    </aside>
                </div>
            </main>

            <style>{`
                .admin-edit-page {
                    min-height: 100vh;
                    background: #f8fafc;
                }
                .admin-edit-header {
                    position: sticky;
                    top: 0;
                    z-index: 100;
                    background: #ffffff;
                    padding: 16px 40px;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                }
                .admin-edit-breadcrumb {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-size: 0.95rem;
                }
                .admin-edit-breadcrumb a {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    text-decoration: none;
                    color: #64748b;
                    font-weight: 600;
                }
                .admin-edit-breadcrumb span { color: #cbd5e1; }
                .admin-edit-actions { display: flex; gap: 12px; }

                .admin-edit-content { padding: 40px; }
                .admin-edit-grid {
                    display: grid;
                    grid-template-columns: 1fr 340px;
                    gap: 32px;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .admin-edit-card {
                    background: #ffffff;
                    border-radius: 16px;
                    padding: 24px;
                    border: 1px solid #e2e8f0;
                    margin-bottom: 24px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .admin-edit-card h3 {
                    font-size: 1.1rem;
                    font-weight: 800;
                    color: #1e293b;
                    margin-bottom: 20px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .image-upload-card { text-align: center; }
                .admin-image-preview-large {
                    width: 100%;
                    aspect-ratio: 16/9;
                    background: #f1f5f9;
                    border-radius: 12px;
                    overflow: hidden;
                    margin-bottom: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px dashed #cbd5e1;
                }
                .admin-image-preview-large img { width: 100%; height: 100%; object-fit: contain; }
                .image-placeholder { color: #94a3b8; font-weight: 600; }
                .upload-btn-container { margin-top: 12px; }
                .upload-btn { width: 100%; justify-content: center; cursor: pointer; }

                /* Reuse hierarchy/capacity styles */
                .admin-hierarchy-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .toggle-switch-group {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    cursor: pointer;
                    user-select: none;
                }
                .toggle-switch-group span { font-weight: 700; font-size: 0.95rem; color: #1e293b; }
                .toggle-switch {
                    width: 44px; height: 24px;
                    background: #cbd5e1; border-radius: 20px;
                    position: relative;
                    transition: all 0.3s cubic-bezier(0.19, 1, 0.22, 1);
                }
                .toggle-switch.active { background: #8b5cf6; }
                .toggle-handle {
                    width: 18px; height: 18px;
                    background: #ffffff; border-radius: 50%;
                    position: absolute; top: 3px; left: 3px;
                    transition: all 0.3s cubic-bezier(0.19, 1, 0.22, 1);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .toggle-switch.active .toggle-handle { left: 23px; }

                .unit-toggle-pills { display: flex; background: #e2e8f0; padding: 2px; border-radius: 8px; gap: 2px; }
                .unit-pill {
                    border: none; background: none; padding: 4px 10px; font-size: 0.7rem;
                    font-weight: 800; color: #64748b; border-radius: 6px; cursor: pointer;
                }
                .unit-pill.active { background: #ffffff; color: #1e293b; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

                .capacity-grid { display: flex; flex-direction: column; gap: 8px; }
                .capacity-row { display: grid; grid-template-columns: 80px 1fr 1fr; gap: 12px; align-items: center; }
                .capacity-row.header { font-size: 0.7rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
                .capacity-label-cell { font-weight: 700; color: #475569; font-size: 0.85rem; }
                .capacity-row input { padding: 8px 12px !important; font-size: 0.9rem !important; height: 38px !important; background: #ffffff !important; border: 1px solid #e2e8f0 !important; }

                .admin-form-group-inline { display: flex; align-items: center; justify-content: space-between; }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                .admin-loading-full { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 16px; color: #64748b; }
            `}</style>
        </div>
    );
}
