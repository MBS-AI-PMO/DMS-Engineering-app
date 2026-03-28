import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';  // eslint-disable-line no-unused-vars
import { Save, X, Upload, Layers, Shield, CornerDownRight, ChevronLeft, Loader2, Wrench, Plus, Hash, ArrowDown, ArrowUp, Maximize, Check } from 'lucide-react';
import { fetchServices, createService, updateService, uploadServiceImage } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

const emptyService = {
    title: '', description: '', image_path: '', display_order: 0,
    is_production: false, parent_id: null,
    min_length: 0, max_length: 0, min_width: 0, max_width: 0, min_height: 0, max_height: 0,
    dimensions_unit: 'in', service_options: []
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
                setAllServices(svcs || []);

                if (!isNew) {
                    const match = svcs.find(s => s.id === parseInt(id));
                    if (match) {
                        setService({
                            ...match,
                            service_options: Array.isArray(match.service_options) ? match.service_options : []
                        });
                    }
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

    const toggleUnit = (newUnit) => {
        if (service.dimensions_unit === newUnit) return;
        const ratio = newUnit === 'mm' ? 25.4 : (1 / 25.4);
        const conv = (v) => parseFloat((parseFloat(v || 0) * ratio).toFixed(4));

        setService(prev => ({
            ...prev,
            dimensions_unit: newUnit,
            min_length: conv(prev.min_length),
            max_length: conv(prev.max_length),
            min_width: conv(prev.min_width),
            max_width: conv(prev.max_width),
            min_height: conv(prev.min_height),
            max_height: conv(prev.max_height)
        }));
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
            <main className="admin-edit-content">
                <div className="admin-edit-top-actions">
                    <Link to="/admin/services" className="admin-back-link">
                        <ChevronLeft size={18} />
                        <span>Services</span>
                    </Link>
                    <div className="admin-edit-actions-row">
                        <button className="admin-btn admin-btn-outline" onClick={() => navigate('/admin/services')}>
                            <X size={18} /> Cancel
                        </button>
                        <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            Save Changes
                        </button>
                    </div>
                </div>

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
                                                onClick={() => toggleUnit('in')}
                                            >
                                                IN
                                            </button>
                                            <button
                                                className={`unit-pill ${service.dimensions_unit === 'mm' ? 'active' : ''}`}
                                                onClick={() => toggleUnit('mm')}
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

                        {(() => {
                            const isAnodizing = service.title.toLowerCase().includes('anodiz');
                            const isTapping = service.title.toLowerCase().includes('tap');

                            if (isAnodizing) return (
                                <div className="admin-edit-card service-options-card">
                                    <div className="admin-hierarchy-header" style={{ marginBottom: '20px', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Shield size={16} />
                                            <span>Anodizing Colors</span>
                                        </div>
                                        <button
                                            className="admin-btn admin-btn-outline"
                                            style={{ padding: '6px 14px', fontSize: '0.75rem' }}
                                            onClick={() => setService(s => ({ ...s, service_options: [...(s.service_options || []), { name: '', color: '#000000' }] }))}
                                        >
                                            <Plus size={14} /> Add Color
                                        </button>
                                    </div>
                                    <p className="admin-card-tip">Define available anodizing colors. These appear as selectable swatches in the quote flow and are reflected on the 3D model.</p>
                                    <div className="options-list">
                                        {(service.service_options || []).map((opt, idx) => (
                                            <div key={idx} className="option-item-row">
                                                <div className="option-input-group">
                                                    <label><Hash size={10} style={{ marginRight: '4px' }} /> Color Name</label>
                                                    <input type="text" value={opt.name} onChange={e => { const n = [...service.service_options]; n[idx].name = e.target.value; setService(s => ({ ...s, service_options: n })); }} placeholder="e.g. Clear" />
                                                </div>
                                                <div className="option-input-group color-picker-group">
                                                    <label><Shield size={10} style={{ marginRight: '4px' }} /> Hex Code</label>
                                                    <div className="color-input-wrapper">
                                                        <input type="color" value={opt.color || '#000000'} onChange={e => { const n = [...service.service_options]; n[idx].color = e.target.value; setService(s => ({ ...s, service_options: n })); }} />
                                                        <input type="text" value={opt.color || ''} onChange={e => { const n = [...service.service_options]; n[idx].color = e.target.value; setService(s => ({ ...s, service_options: n })); }} />
                                                    </div>
                                                </div>
                                                <button className="option-remove-btn" onClick={() => { const n = service.service_options.filter((_, i) => i !== idx); setService(s => ({ ...s, service_options: n })); }}><X size={14} /></button>
                                            </div>
                                        ))}
                                        {(!service.service_options || service.service_options.length === 0) && <div className="empty-options-state">No anodizing colors defined.</div>}
                                    </div>
                                </div>
                            );

                            if (isTapping) return (
                                <div className="admin-edit-card service-options-card">
                                    <div className="admin-hierarchy-header" style={{ marginBottom: '20px', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Wrench size={16} />
                                            <span>Tapping Configuration</span>
                                        </div>
                                        <button
                                            className="admin-btn admin-btn-outline"
                                            style={{ padding: '6px 14px', fontSize: '0.75rem' }}
                                            onClick={() => setService(s => ({ ...s, service_options: [...(s.service_options || []), { name: '', min_diameter: '', max_diameter: '', min_depth: null, max_depth: '', notes: '' }] }))}
                                        >
                                            <Plus size={14} /> Add Tap
                                        </button>
                                    </div>
                                    <p className="admin-card-tip">Configure taps with hole diameter and depth ranges. These appear in the quote flow when a DXF file is uploaded.</p>
                                    <div className="tap-options-list">
                                        {(service.service_options || []).map((opt, idx) => (
                                            <div key={idx} className="tap-option-card">
                                                <div className="tap-option-header">
                                                    <Hash size={18} style={{ color: '#94a3b8' }} />
                                                    <input type="text" className="tap-name-input" value={opt.name} onChange={e => { const n = [...service.service_options]; n[idx].name = e.target.value; setService(s => ({ ...s, service_options: n })); }} placeholder="e.g. 4-40 Roll Tap" />
                                                    <button className="option-remove-btn" onClick={() => { const n = service.service_options.filter((_, i) => i !== idx); setService(s => ({ ...s, service_options: n })); }}><X size={14} /></button>
                                                </div>
                                                <div className="tap-fields-grid">
                                                    <div className="option-input-group">
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ArrowDown size={10} /> Min Diameter (in)</label>
                                                        <input type="number" step="0.001" value={opt.min_diameter} onChange={e => { const n = [...service.service_options]; n[idx].min_diameter = e.target.value; setService(s => ({ ...s, service_options: n })); }} placeholder="0.000" />
                                                    </div>
                                                    <div className="option-input-group">
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ArrowUp size={10} /> Max Diameter (in)</label>
                                                        <input type="number" step="0.001" value={opt.max_diameter} onChange={e => { const n = [...service.service_options]; n[idx].max_diameter = e.target.value; setService(s => ({ ...s, service_options: n })); }} placeholder="0.000" />
                                                    </div>
                                                    <div className="option-input-group">
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Maximize size={10} /> Max Depth (in)</label>
                                                        <input type="number" step="0.001" value={opt.max_depth} onChange={e => { const n = [...service.service_options]; n[idx].max_depth = e.target.value; setService(s => ({ ...s, service_options: n })); }} placeholder="0.000" />
                                                    </div>
                                                    <div className="option-input-group">
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ArrowDown size={10} /> Min Depth (in)</label>
                                                        <div className="tap-min-depth-group">
                                                            <div className="toggle-switch-group" onClick={() => { const n = [...service.service_options]; n[idx].min_depth = n[idx].min_depth === null ? '' : null; setService(s => ({ ...s, service_options: n })); }}>
                                                                <div className={`toggle-switch ${opt.min_depth === null ? 'active' : ''}`} style={{ width: '36px', height: '20px' }}>
                                                                    <div className="toggle-handle" style={{ width: '14px', height: '14px', top: '3px', left: opt.min_depth === null ? '19px' : '3px' }} />
                                                                </div>
                                                                <span style={{ fontSize: '0.8rem' }}>{opt.min_depth === null ? 'No Limit' : 'Value'}</span>
                                                            </div>
                                                            {opt.min_depth !== null && (
                                                                <input type="number" step="0.001" value={opt.min_depth} onChange={e => { const n = [...service.service_options]; n[idx].min_depth = e.target.value; setService(s => ({ ...s, service_options: n })); }} placeholder="0.000" />
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="option-input-group">
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Price per Hole ($)</label>
                                                        <input type="number" step="0.01" value={opt.price || ''} onChange={e => { const n = [...service.service_options]; n[idx].price = e.target.value; setService(s => ({ ...s, service_options: n })); }} placeholder="0.00" />
                                                    </div>
                                                </div>
                                                <div className="option-input-group">
                                                    <label>Additional Notes</label>
                                                    <textarea className="tap-option-notes-area" rows={2} value={opt.notes || ''} onChange={e => { const n = [...service.service_options]; n[idx].notes = e.target.value; setService(s => ({ ...s, service_options: n })); }} placeholder="Optional notes... e.g. recommended hole size, material specific notes" />
                                                </div>
                                            </div>
                                        ))}
                                        {(!service.service_options || service.service_options.length === 0) && <div className="empty-options-state">No taps configured. Add a tap to define threading options.</div>}
                                    </div>
                                </div>
                            );

                            return null;
                        })()}
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
                .admin-edit-page, .admin-edit-page * {
                    box-sizing: border-box;
                }
                .admin-edit-page {
                    min-height: 100vh;
                    background: #f8fafc;
                    padding: 40px;
                    color: #1e293b; /* Explicitly set dark text color for visibility */
                    font-family: inherit;
                }
                .admin-edit-top-actions {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 32px;
                    max-width: 1200px;
                    margin-left: auto;
                    margin-right: auto;
                }
                .admin-back-link {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    text-decoration: none;
                    color: #64748b;
                    font-weight: 700;
                    font-size: 1rem;
                    transition: all 0.2s;
                }
                .admin-back-link:hover { color: #1e293b; transform: translateX(-4px); }
                .admin-edit-actions-row { display: flex; gap: 12px; }

                .admin-edit-content { padding: 0; }
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
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                }
                .admin-edit-card h3 {
                    font-size: 1.1rem;
                    font-weight: 800;
                    color: #0f172a;
                    margin-bottom: 24px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .admin-form-group { margin-bottom: 20px; }
                .admin-form-group label {
                    display: block;
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 8px;
                }
                
                /* Standardizing all form controls */
                .admin-form-group input, 
                .admin-form-group textarea,
                .admin-form-group select {
                    width: 100%;
                    padding: 12px 16px;
                    border-radius: 10px;
                    border: 1.5px solid #e2e8f0;
                    background: #ffffff;
                    font-size: 0.95rem;
                    color: #1e293b; /* Ensure text is dark and visible */
                    transition: all 0.2s;
                    font-family: inherit;
                }
                .admin-form-group input:focus, 
                .admin-form-group textarea:focus,
                .admin-form-group select:focus {
                    outline: none;
                    border-color: #8b5cf6;
                    box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.1);
                }

                .image-upload-card { text-align: center; }
                .admin-image-preview-large {
                    width: 100%;
                    aspect-ratio: 16/9;
                    background: #f8fafc;
                    border-radius: 12px;
                    overflow: hidden;
                    margin-bottom: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px dashed #cbd5e1;
                }
                .admin-image-preview-large img { width: 100%; height: 100%; object-fit: contain; }
                .image-placeholder { color: #94a3b8; font-weight: 600; font-size: 0.9rem; }
                .upload-btn-container { margin-top: 16px; }
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

                .unit-toggle-pills { display: flex; background: #f1f5f9; padding: 3px; border-radius: 10px; gap: 2px; }
                .unit-pill {
                    border: none; background: none; padding: 6px 14px; font-size: 0.7rem;
                    font-weight: 800; color: #64748b; border-radius: 8px; cursor: pointer;
                    transition: all 0.2s;
                }
                .unit-pill.active { background: #ffffff; color: #1e293b; box-shadow: 0 2px 4px rgba(0,0,0,0.08); }

                /* Capacity Grid Refinement */
                .capacity-grid { display: flex; flex-direction: column; gap: 12px; }
                .capacity-row { display: grid; grid-template-columns: 100px 1fr 1fr; gap: 16px; align-items: center; }
                .capacity-row.header { font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }
                .capacity-label-cell { font-weight: 700; color: #475569; font-size: 0.85rem; }
                .capacity-row input { 
                    padding: 10px 12px !important; 
                    font-size: 0.9rem !important; 
                    height: 42px !important; 
                    background: #ffffff !important; 
                    border: 1.5px solid #e2e8f0 !important;
                    border-radius: 10px !important;
                    width: 100% !important;
                    color: #1e293b !important; /* Force visibility */
                }
                .capacity-row input:focus { border-color: #8b5cf6 !important; box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.1) !important; outline: none; }

                .admin-form-group-inline { display: flex; align-items: center; justify-content: space-between; }
                
                .admin-card-tip { font-size: 0.8rem; color: #64748b; margin-bottom: 20px; line-height: 1.4; }

                .options-list { display: flex; flex-direction: column; gap: 12px; }
                .option-item-row { 
                    display: grid; 
                    grid-template-columns: 1fr 180px 40px; 
                    gap: 12px; 
                    align-items: flex-end; 
                    padding: 16px; 
                    background: #f8fafc; 
                    border-radius: 12px; 
                    border: 1px solid #f1f5f9;
                }
                .option-input-group label { display: block; font-size: 0.65rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px; }
                .option-input-group input { 
                    width: 100%; 
                    padding: 10px 14px; 
                    border-radius: 10px; 
                    border: 1.5px solid #e2e8f0; 
                    font-size: 0.9rem;
                    background: #ffffff !important;
                    color: #1e293b !important;
                    font-family: inherit;
                    transition: all 0.2s;
                }
                .option-input-group input:focus {
                    outline: none;
                    border-color: #8b5cf6;
                    box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.1);
                }
                .color-input-wrapper { display: flex; gap: 8px; }
                .color-input-wrapper input[type="color"] { width: 40px; height: 38px; padding: 2px; cursor: pointer; border: 1.5px solid #e2e8f0; }
                .option-remove-btn { 
                    height: 38px; 
                    width: 38px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    background: #fee2e2; 
                    color: #ef4444; 
                    border: none; 
                    border-radius: 8px; 
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .option-remove-btn:hover { background: #fecaca; transform: scale(1.05); }
                .empty-options-state { text-align: center; padding: 20px; color: #94a3b8; font-size: 0.85rem; border: 2px dashed #f1f5f9; border-radius: 12px; }

                /* Buttons */
                .admin-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.19, 1, 0.22, 1);
                    border: none;
                    white-space: nowrap;
                }
                .admin-btn-primary {
                    background: #8b5cf6;
                    color: #ffffff;
                    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
                }
                .admin-btn-primary:hover {
                    background: #7c3aed;
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(139, 92, 246, 0.4);
                }
                .admin-btn-primary:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
                
                .admin-btn-outline {
                    background: #ffffff;
                    color: #64748b;
                    border: 2px solid #e2e8f0;
                }
                .admin-btn-outline:hover {
                    background: #f8fafc;
                    border-color: #cbd5e1;
                    color: #1e293b;
                }

                .tap-options-list { display: flex; flex-direction: column; gap: 20px; }
                .tap-option-card {
                    background: #ffffff;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 20px;
                    padding: 24px;
                    position: relative;
                    transition: all 0.2s;
                }
                .tap-option-card:hover {
                    box-shadow: 0 10px 25px rgba(0,0,0,0.03);
                    border-color: #cbd5e1;
                }
                .tap-option-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 20px;
                }
                .tap-name-input {
                    flex: 1;
                    padding: 12px 16px;
                    border-radius: 12px;
                    border: 1.5px solid #e2e8f0;
                    font-size: 1rem;
                    font-weight: 700;
                    color: #0f172a;
                    background: #f8fafc;
                    font-family: inherit;
                    transition: all 0.2s;
                }
                .tap-name-input:focus { 
                    outline: none; 
                    border-color: #8b5cf6; 
                    background: white;
                    box-shadow: 0 0 0 4px rgba(139,92,246,0.1); 
                }
                .tap-fields-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-bottom: 20px;
                }
                .tap-option-notes-area {
                    width: 100%;
                    padding: 12px 14px;
                    border-radius: 12px;
                    border: 1.5px solid #e2e8f0;
                    background: #f8fafc;
                    font-size: 0.9rem;
                    color: #1e293b;
                    font-family: inherit;
                    resize: vertical;
                    transition: all 0.2s;
                }
                .tap-option-notes-area:focus {
                    outline: none;
                    border-color: #8b5cf6;
                    background: white;
                    box-shadow: 0 0 0 4px rgba(139,92,246,0.1);
                }
                .tap-min-depth-group { display: flex; flex-direction: column; gap: 8px; }
                .tap-min-depth-group .toggle-switch-group { margin-top: 4px; }

                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                .admin-loading-full { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 16px; color: #64748b; }
            `}</style>
        </div>
    );
}
