import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';  // eslint-disable-line no-unused-vars
import { Save, X, Upload, Layers, Shield, Zap, CornerDownRight, ChevronLeft, ChevronRight, Loader2, Wrench, Edit2, Plus, Hash, ArrowDown, ArrowUp, Maximize, Check, ArrowRight, Trash2, Cpu, Package, Info, Camera, Ruler, Grid } from 'lucide-react';
import {
    fetchServices, createService, updateService, uploadServiceImage,
    fetchHardwareTypes, fetchHardwareItemsByType, uploadHardwareTypeImage,
    createHardwareItem, updateHardwareItem, deleteHardwareItem
} from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import ImageModal from '../../components/admin/ImageModal';

const emptyService = {
    title: '', description: '', image_path: '', display_order: 0,
    is_production: false, parent_ids: [],
    min_length: 0, max_length: 0, min_width: 0, max_width: 0, min_height: 0, max_height: 0,
    dimensions_unit: 'in', service_options: [], base_price: 0,
    pricing_config: {}
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
    const [isColorModalOpen, setIsColorModalOpen] = useState(false);
    const [editingColorIndex, setEditingColorIndex] = useState(null); // null = new
    const [tempColor, setTempColor] = useState({ name: '', color: '#000000', price: 0, gloss: 50, is_wrinkled: false });

    // Tapping Modal State
    const [isTapModalOpen, setIsTapModalOpen] = useState(false);
    const [editingTapIndex, setEditingTapIndex] = useState(null);
    const [tempTap, setTempTap] = useState({ name: '', min_diameter: '', max_diameter: '', min_depth: null, max_depth: '', price: '', notes: '' });

    // ── Hardware Management State ──────────────────────────
    const [hwTypes, setHwTypes] = useState([]);
    const [selectedHwType, setSelectedHwType] = useState(null);
    const [hwItems, setHwItems] = useState([]);
    const [loadingHw, setLoadingHw] = useState(false);
    const [editingHwItem, setEditingHwItem] = useState(null);
    const [hwItemForm, setHwItemForm] = useState({
        name: '', size_spec: '', price: '', notes: '', is_active: true,
        length: '', min_edge_distance: '', tooling_diameter: '',
        base_width: '', shank: '',
        major_dia: '', minor_dia: '', angle: '', max_hole_diameter: ''
    });
    const [savingHwItem, setSavingHwItem] = useState(false);
    const [hwTypeImgUploading, setHwTypeImgUploading] = useState(false);
    const [zoomedImage, setZoomedImage] = useState(null);
    const [confirmDeleteHwItem, setConfirmDeleteHwItem] = useState(null);
    const [hwUnit, setHwUnit] = useState('in');
    const hwTypeImgRef = useRef(null);

    const isHardware = service?.title?.toLowerCase()?.includes('hardware') || service?.title?.toLowerCase()?.includes('insertion');

    const toMM = (val) => val ? (parseFloat(val) * 25.4).toFixed(4) : '';
    const toIN = (val) => val ? (parseFloat(val) / 25.4).toFixed(4) : '';

    const loadHwTypes = useCallback(async () => {
        try {
            const hwRes = await fetchHardwareTypes();
            setHwTypes(hwRes.data || []);
        } catch (err) {
            toast('Failed to load hardware types: ' + err.message, 'error');
        }
    }, [toast]);

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
                            parent_ids: Array.isArray(match.parent_ids) ? match.parent_ids : [],
                            service_options: Array.isArray(match.service_options) ? match.service_options : [],
                            pricing_config: match.pricing_config || {}
                        });

                        // If it's Hardware, fetch its types
                        if (match.title?.toLowerCase()?.includes('hardware')) {
                            await loadHwTypes();
                        }
                    }
                }
            } catch (err) {
                toast('Failed to load data: ' + err.message, 'error');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, isNew, toast, loadHwTypes]);

    const loadHwItems = useCallback(async (typeId) => {
        setLoadingHw(true);
        try {
            const res = await fetchHardwareItemsByType(typeId);
            setHwItems(res.data || []);
        } catch (err) {
            toast('Failed to load hardware items: ' + err.message, 'error');
        } finally {
            setLoadingHw(false);
        }
    }, [toast]);

    useEffect(() => {
        if (selectedHwType) {
            loadHwItems(selectedHwType.id);
        }
    }, [selectedHwType, loadHwItems]);

    const handleHwTypeImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !selectedHwType) return;
        setHwTypeImgUploading(true);
        try {
            const res = await uploadHardwareTypeImage(selectedHwType.id, file);
            const updatedPath = res.data.path;
            setSelectedHwType(prev => ({ ...prev, image_path: updatedPath }));
            setHwTypes(prev => prev.map(t => t.id === selectedHwType.id ? { ...t, image_path: updatedPath } : t));
            toast('Hardware type image updated', 'success');
        } catch (err) {
            toast('Upload failed: ' + err.message, 'error');
        } finally {
            setHwTypeImgUploading(false);
            e.target.value = '';
        }
    };


    const handleSaveHwItem = async () => {
        const nameStr = (hwItemForm.name || '').toString().trim();
        if (!nameStr) { toast('Name is required', 'error'); return; }
        setSavingHwItem(true);
        try {
            const payload = {
                hardware_type_id: selectedHwType.id,
                name: nameStr,
                size_spec: (hwItemForm.size_spec || '').toString().trim() || null,
                price: parseFloat(hwItemForm.price) || 0,
                notes: (hwItemForm.notes || '').toString().trim() || null,
                is_active: hwItemForm.is_active,
                length: parseFloat(hwItemForm.length) || null,
                min_edge_distance: parseFloat(hwItemForm.min_edge_distance) || null,
                tooling_diameter: parseFloat(hwItemForm.tooling_diameter) || null,
                base_width: parseFloat(hwItemForm.base_width) || null,
                shank: parseFloat(hwItemForm.shank) || null,
                major_dia: parseFloat(hwItemForm.major_dia) || null,
                minor_dia: parseFloat(hwItemForm.minor_dia) || null,
                angle: parseFloat(hwItemForm.angle) || null,
                max_hole_diameter: parseFloat(hwItemForm.max_hole_diameter) || null,
                is_wrinkled: hwItemForm.is_wrinkled ?? false
            };

            if (editingHwItem === 'new') {
                await createHardwareItem(payload);
            } else {
                await updateHardwareItem(editingHwItem.id, payload);
            }

            toast(editingHwItem === 'new' ? 'Item added' : 'Item updated', 'success');
            setEditingHwItem(null);
            setHwItemForm({
                name: '', size_spec: '', price: '', notes: '', is_active: true,
                length: '', min_edge_distance: '', tooling_diameter: '',
                base_width: '', shank: '',
                major_dia: '', minor_dia: '', angle: '', max_hole_diameter: ''
            });
            loadHwItems(selectedHwType.id);
            loadHwTypes(); // Refresh counts
        } catch (err) {
            toast('Failed to save item: ' + err.message, 'error');
        } finally {
            setSavingHwItem(false);
        }
    };

    const handleDeleteHwItem = async () => {
        if (!confirmDeleteHwItem) return;
        try {
            await deleteHardwareItem(confirmDeleteHwItem.id);
            setHwItems(prev => prev.filter(i => i.id !== confirmDeleteHwItem.id));
            toast('Item deleted', 'success');
            loadHwTypes(); // Refresh counts
        } catch (err) {
            toast('Delete failed: ' + err.message, 'error');
        } finally {
            setConfirmDeleteHwItem(null);
        }
    };

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

    const openTapModal = (index = null) => {
        if (index !== null) {
            setEditingTapIndex(index);
            setTempTap({ ...service.service_options[index] });
        } else {
            setEditingTapIndex(null);
            setTempTap({ name: '', min_diameter: '', max_diameter: '', min_depth: null, max_depth: '', price: '', notes: '' });
        }
        setIsTapModalOpen(true);
    };

    const saveTap = () => {
        if (!tempTap.name) {
            toast('Tap name is required', 'error');
            return;
        }
        const updatedOptions = [...(service.service_options || [])];
        if (editingTapIndex !== null) {
            updatedOptions[editingTapIndex] = tempTap;
        } else {
            updatedOptions.push(tempTap);
        }
        setService(s => ({ ...s, service_options: updatedOptions }));
        setIsTapModalOpen(false);
    };

    const CardSkeleton = ({ height = 200, title = '' }) => (
        <div className="admin-edit-card">
            {title && <div className="skeleton-box" style={{ width: '150px', height: '24px', marginBottom: '20px' }} />}
            <div className="skeleton-box" style={{ width: '100%', height }} />
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
                        {loading ? <CardSkeleton title="General Information" height={360} /> : (
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
                        )}

                        {loading ? <CardSkeleton title="Hierarchy & Relationships" height={150} /> : (
                            <div className="admin-edit-card">
                                <div className="admin-hierarchy-header" style={{ marginBottom: '16px' }}>
                                    <Shield size={16} />
                                    <span>Hierarchy & Relationships</span>
                                </div>

                                <div className="admin-form-group-inline">
                                    <div className="toggle-switch-group" onClick={() => setService(s => ({ ...s, is_production: !s.is_production, parent_ids: !s.is_production ? [] : s.parent_ids }))}>
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
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                                <CornerDownRight size={14} />
                                                <span>Parent Services (Select Multiple)</span>
                                            </label>
                                            <p className="admin-card-tip" style={{ marginBottom: '12px' }}>
                                                Linking a parent service makes this a sub-process (e.g. Bending for Laser Cutting).
                                                <strong> Note:</strong> You must also assign this service to specific <strong>Metals & Thicknesses</strong> using the "Configure Metals" button in the services list for it to appear in the quote flow.
                                            </p>

                                            <div className="parent-selection-grid" style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                                gap: '12px',
                                                padding: '16px',
                                                background: '#f8fafc',
                                                borderRadius: '12px',
                                                border: '1.5px solid #e2e8f0'
                                            }}>
                                                {allServices
                                                    .filter(s => s.id !== parseInt(id) && s.is_production)
                                                    .map(s => (
                                                        <div key={s.id} className="parent-checkbox-item" style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '10px',
                                                            cursor: 'pointer',
                                                            padding: '4px'
                                                        }} onClick={() => {
                                                            const pids = [...(service.parent_ids || [])];
                                                            const numericSId = Number(s.id);
                                                            const idx = pids.findIndex(pid => Number(pid) === numericSId);
                                                            if (idx >= 0) pids.splice(idx, 1);
                                                            else pids.push(numericSId);
                                                            setService(prev => ({ ...prev, parent_ids: pids }));
                                                        }}>
                                                            <div style={{
                                                                width: '20px',
                                                                height: '20px',
                                                                borderRadius: '6px',
                                                                border: '2px solid',
                                                                borderColor: (service.parent_ids || []).some(pid => Number(pid) === Number(s.id)) ? '#8b5cf6' : '#cbd5e1',
                                                                background: (service.parent_ids || []).some(pid => Number(pid) === Number(s.id)) ? '#8b5cf6' : 'transparent',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                color: 'white',
                                                                transition: 'all 0.2s'
                                                            }}>
                                                                {(service.parent_ids || []).some(pid => Number(pid) === Number(s.id)) && <Check size={14} />}
                                                            </div>
                                                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: (service.parent_ids || []).some(pid => Number(pid) === Number(s.id)) ? '#1e293b' : '#64748b' }}>
                                                                {s.title}
                                                            </span>
                                                        </div>
                                                    ))
                                                }
                                                {allServices.filter(s => s.id !== parseInt(id) && s.is_production).length === 0 && (
                                                    <div className="text-muted small">No production services available to be parents.</div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

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
                            const isPowderCoating = service.title.toLowerCase().includes('powder coat');
                            const isTapping = service.title.toLowerCase().includes('tap');

                            if (isAnodizing || isPowderCoating) return (
                                <>
                                    {/* Powder Coating Pricing Config (moved out of modal) */}
                                    {isPowderCoating && (
                                        <div className="admin-edit-card service-options-card" style={{ marginBottom: '20px' }}>
                                            <div className="admin-hierarchy-header" style={{ marginBottom: '20px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Cpu size={16} />
                                                    <span>Powder Coating Pricing Configuration</span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
                                                <div className="option-input-group">
                                                    <label>Batch Cost ($)</label>
                                                    <input type="number" step="0.01" value={service.pricing_config?.batch_cost || 0} onChange={e => setService(s => ({ ...s, pricing_config: { ...s.pricing_config, batch_cost: parseFloat(e.target.value) || 0 } }))} />
                                                </div>
                                                <div className="option-input-group">
                                                    <label>Shop Rate ($/hr)</label>
                                                    <input type="number" step="0.01" value={service.pricing_config?.shop_rate || 0} onChange={e => setService(s => ({ ...s, pricing_config: { ...s.pricing_config, shop_rate: parseFloat(e.target.value) || 0 } }))} />
                                                </div>
                                                <div className="option-input-group">
                                                    <label>Setup Time (min)</label>
                                                    <input type="number" value={service.pricing_config?.setup_time || 0} onChange={e => setService(s => ({ ...s, pricing_config: { ...s.pricing_config, setup_time: parseFloat(e.target.value) || 0 } }))} />
                                                </div>
                                                <div className="option-input-group">
                                                    <label>Oven Width (in)</label>
                                                    <input type="number" value={service.pricing_config?.oven_width || 90} onChange={e => setService(s => ({ ...s, pricing_config: { ...s.pricing_config, oven_width: parseFloat(e.target.value) || 0 } }))} />
                                                </div>
                                                <div className="option-input-group">
                                                    <label>Oven Length (in)</label>
                                                    <input type="number" value={service.pricing_config?.oven_length || 160} onChange={e => setService(s => ({ ...s, pricing_config: { ...s.pricing_config, oven_length: parseFloat(e.target.value) || 0 } }))} />
                                                </div>
                                            </div>
                                            <p className="admin-card-tip" style={{ marginTop: '12px' }}>
                                                Formula: <code>cost/unit = (setup_time × shop_rate / 60 + batches × batch_cost) / qty</code>.
                                                Parts per batch uses thickness + 24&Prime; rack clearance across both oven orientations.
                                            </p>
                                        </div>
                                    )}

                                    {/* Inline color grid */}
                                    <div className="admin-edit-card service-options-card">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                                <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #eef2f6' }}>
                                                    <Shield size={22} color="#64748b" />
                                                </div>
                                                <div>
                                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                                        {isAnodizing ? 'Anodizing Finishes' : 'Powder Coating Finishes'}
                                                    </h3>
                                                    <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
                                                        {(service.service_options || []).length} color{(service.service_options || []).length !== 1 ? 's' : ''} configured
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => { setEditingColorIndex(null); setTempColor({ name: '', color: '#000000', price: 0, gloss: 50, is_wrinkled: false }); setIsColorModalOpen(true); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: '12px', background: '#1e293b', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                                            >
                                                <Plus size={15} /> Add Color
                                            </button>
                                        </div>

                                        {(service.service_options || []).length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '16px', border: '2px dashed #e2e8f0', color: '#94a3b8' }}>
                                                <Shield size={28} color="#cbd5e1" style={{ marginBottom: 10 }} />
                                                <p style={{ fontWeight: 700, margin: 0 }}>No colors configured yet.</p>
                                                <p style={{ fontSize: '0.8rem', margin: '4px 0 0' }}>Click <strong>Add Color</strong> to define your first finish.</p>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                                                {(service.service_options || []).map((opt, idx) => (
                                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#f8fafc', borderRadius: '14px', border: '1.5px solid #f1f5f9' }}>
                                                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: opt.color || '#000000', flexShrink: 0, border: '3px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }} />
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.name || <span style={{ color: '#94a3b8' }}>Unnamed</span>}</div>
                                                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                                                                {opt.price > 0 ? `+$${parseFloat(opt.price).toFixed(2)}` : 'No upcharge'}
                                                                {opt.is_wrinkled && ' · Wrinkle'}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                                            <button onClick={() => { setEditingColorIndex(idx); setTempColor({ ...opt }); setIsColorModalOpen(true); }} style={{ width: 28, height: 28, borderRadius: 8, background: '#e2e8f0', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <Edit2 size={12} color="#475569" />
                                                            </button>
                                                            <button onClick={() => { const n = service.service_options.filter((_, i) => i !== idx); setService(s => ({ ...s, service_options: n })); }} style={{ width: 28, height: 28, borderRadius: 8, background: '#fff1f2', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <Trash2 size={12} color="#ef4444" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
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
                                            onClick={() => openTapModal()}
                                        >
                                            <Plus size={14} /> Add Tap
                                        </button>
                                    </div>
                                    <p className="admin-card-tip">Configure taps with hole diameter and depth ranges. These appear in the quote flow when a DXF file is uploaded.</p>

                                    <div className="tap-bar-list">
                                        <div className="tap-bar-header">
                                            <div className="col-name">Tap Name</div>
                                            <div className="col-diam">Diameter (in)</div>
                                            <div className="col-depth">Depth (in)</div>
                                            <div className="col-price">Price</div>
                                            <div className="col-actions"></div>
                                        </div>
                                        {(service.service_options || []).map((opt, idx) => (
                                            <div key={idx} className="tap-option-bar">
                                                <div className="col-name">
                                                    <span className="tap-name-label">{opt.name}</span>
                                                    {opt.notes && <span className="tap-notes-indicator" title={opt.notes}>Notes+</span>}
                                                </div>
                                                <div className="col-diam">
                                                    <span className="diam-range">{opt.min_diameter} - {opt.max_diameter}</span>
                                                </div>
                                                <div className="col-depth">
                                                    <span className="depth-info">
                                                        {opt.min_depth === null ? '∞' : opt.min_depth} to {opt.max_depth || '0'}
                                                    </span>
                                                </div>
                                                <div className="col-price">
                                                    <span className="price-tag">${opt.price || '0'}</span>
                                                </div>
                                                <div className="col-actions">
                                                    <button className="tap-action-btn edit" onClick={() => openTapModal(idx)} title="Edit Tap">
                                                        <Wrench size={14} />
                                                    </button>
                                                    <button className="tap-action-btn delete" onClick={() => { const n = service.service_options.filter((_, i) => i !== idx); setService(s => ({ ...s, service_options: n })); }} title="Remove">
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {(!service.service_options || service.service_options.length === 0) && (
                                            <div className="empty-options-state">No taps configured. Add a tap to define threading options.</div>
                                        )}
                                    </div>
                                </div>
                            );

                            const isLaser = service?.title?.toLowerCase()?.includes('laser');
                            if (isLaser) return (
                                <div className="admin-edit-card service-options-card">
                                    <div className="admin-hierarchy-header" style={{ marginBottom: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Maximize size={16} />
                                            <span>Laser Cutting Pricing Configuration</span>
                                        </div>
                                    </div>
                                    <p className="admin-card-tip">Configure pricing parameters for Laser Cutting. These are added to the material cost in the quote flow.</p>

                                    <div className="laser-pricing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginTop: '20px', maxWidth: '320px' }}>
                                        <div className="option-input-group">
                                            <label><Cpu size={10} style={{ marginRight: '4px' }} /> Machine Hourly Rate ($/hr)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={service.pricing_config?.hourly_rate || 0}
                                                onChange={e => setService(s => ({ ...s, pricing_config: { ...s.pricing_config, hourly_rate: parseFloat(e.target.value) || 0 } }))}
                                            />
                                        </div>
                                    </div>
                                    <p className="admin-card-tip" style={{ marginTop: '12px' }}>
                                        Formula: <code>cost/unit = (HourlyRate × setup_hrs / qty) + (HourlyRate × runtime_h)</code>
                                        <br />
                                        Setup time is automatic: <strong>0.3 h</strong> if thickness ≤ 0.25 in, <strong>0.25 h</strong> if thickness &gt; 0.25 in.
                                        Cut speed and pierce time come from the <strong>Laser Rates</strong> table.
                                    </p>
                                </div>
                            );

                            const isBending = service?.title?.toLowerCase()?.includes('bending');
                            if (isBending) return (
                                <div className="admin-edit-card service-options-card">
                                    <div className="admin-hierarchy-header" style={{ marginBottom: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Wrench size={16} />
                                            <span>Bending Technical Pricing</span>
                                        </div>
                                    </div>

                                    <div className="laser-pricing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        <div className="option-input-group">
                                            <label>Setup Fee ($)</label>
                                            <input
                                                type="number"
                                                value={service.pricing_config?.setup_fee || 0}
                                                onChange={e => setService(s => ({ ...s, pricing_config: { ...s.pricing_config, setup_fee: parseFloat(e.target.value) || 0 } }))}
                                            />
                                        </div>
                                        <div className="option-input-group">
                                            <label>Labor Hourly Rate ($/hr)</label>
                                            <input
                                                type="number"
                                                value={service.pricing_config?.hourly_rate || 0}
                                                onChange={e => setService(s => ({ ...s, pricing_config: { ...s.pricing_config, hourly_rate: parseFloat(e.target.value) || 0 } }))}
                                            />
                                        </div>
                                    </div>

                                    <h4 style={{ marginTop: '20px', marginBottom: '10px', fontSize: '13px' }}>Thresholds (mm)</h4>
                                    <div className="laser-pricing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        <div className="option-input-group">
                                            <label>Medium Bend Threshold (mm)</label>
                                            <input
                                                type="number"
                                                value={service.pricing_config?.med_bend_threshold || 200}
                                                onChange={e => setService(s => ({ ...s, pricing_config: { ...s.pricing_config, med_bend_threshold: parseFloat(e.target.value) || 0 } }))}
                                            />
                                        </div>
                                        <div className="option-input-group">
                                            <label>Large Bend Threshold (mm)</label>
                                            <input
                                                type="number"
                                                value={service.pricing_config?.large_bend_threshold || 500}
                                                onChange={e => setService(s => ({ ...s, pricing_config: { ...s.pricing_config, large_bend_threshold: parseFloat(e.target.value) || 0 } }))}
                                            />
                                        </div>
                                    </div>

                                    <h4 style={{ marginTop: '20px', marginBottom: '10px', fontSize: '13px' }}>Rates per Category ($)</h4>
                                    <div className="laser-pricing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                                        <div className="option-input-group">
                                            <label>Small Rate ($)</label>
                                            <input
                                                type="number"
                                                value={service.pricing_config?.small_bend_rate || 0}
                                                onChange={e => setService(s => ({ ...s, pricing_config: { ...s.pricing_config, small_bend_rate: parseFloat(e.target.value) || 0 } }))}
                                            />
                                        </div>
                                        <div className="option-input-group">
                                            <label>Medium Rate ($)</label>
                                            <input
                                                type="number"
                                                value={service.pricing_config?.med_bend_rate || 0}
                                                onChange={e => setService(s => ({ ...s, pricing_config: { ...s.pricing_config, med_bend_rate: parseFloat(e.target.value) || 0 } }))}
                                            />
                                        </div>
                                        <div className="option-input-group">
                                            <label>Large Rate ($)</label>
                                            <input
                                                type="number"
                                                value={service.pricing_config?.large_bend_rate || 0}
                                                onChange={e => setService(s => ({ ...s, pricing_config: { ...s.pricing_config, large_bend_rate: parseFloat(e.target.value) || 0 } }))}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );

                            const isCNC = (service?.title?.toLowerCase()?.includes('cnc')) || (parseInt(id) === 2);
                            if (isCNC) return (
                                <div className="admin-edit-card service-options-card">
                                    <div className="admin-hierarchy-header" style={{ marginBottom: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Maximize size={16} />
                                            <span>CNC Pricing Configuration</span>
                                        </div>
                                    </div>
                                    <p className="admin-card-tip">Configure global pricing parameters for CNC Machining. These are added to the material cost in the quote flow.</p>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                                        <div className="option-input-group">
                                            <label><Hash size={10} style={{ marginRight: '4px' }} /> Base Setup Fee ($)</label>
                                            <input
                                                type="number"
                                                value={service.pricing_config?.base_setup || 0}
                                                onChange={e => setService(s => ({ ...s, pricing_config: { ...s.pricing_config, base_setup: parseFloat(e.target.value) || 0 } }))}
                                            />
                                        </div>
                                        <div className="option-input-group">
                                            <label><ArrowRight size={10} style={{ marginRight: '4px' }} /> Price per Inch Width ($)</label>
                                            <input
                                                type="number"
                                                value={service.pricing_config?.price_per_width || 0}
                                                onChange={e => setService(s => ({ ...s, pricing_config: { ...s.pricing_config, price_per_width: parseFloat(e.target.value) || 0 } }))}
                                            />
                                        </div>
                                        <div className="option-input-group">
                                            <label><ArrowUp size={10} style={{ marginRight: '4px' }} /> Price per Inch Length ($)</label>
                                            <input
                                                type="number"
                                                value={service.pricing_config?.price_per_length || 0}
                                                onChange={e => setService(s => ({ ...s, pricing_config: { ...s.pricing_config, price_per_length: parseFloat(e.target.value) || 0 } }))}
                                            />
                                        </div>
                                        <div className="option-input-group">
                                            <label><Maximize size={10} style={{ marginRight: '4px' }} /> Price per Inch Thickness ($)</label>
                                            <input
                                                type="number"
                                                value={service.pricing_config?.price_per_thickness || 0}
                                                onChange={e => setService(s => ({ ...s, pricing_config: { ...s.pricing_config, price_per_thickness: parseFloat(e.target.value) || 0 } }))}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 12, marginTop: 16 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', marginBottom: 6 }}>PRICING FORMULA</div>
                                        <code style={{ fontSize: 12, color: '#1e293b' }}>
                                            Price = ${service.pricing_config?.base_setup || 0} (setup)
                                            {service.pricing_config?.price_per_length ? ` + ${service.pricing_config.price_per_length} × Length (in)` : ''}
                                            {service.pricing_config?.price_per_width ? ` + ${service.pricing_config.price_per_width} × Width (in)` : ''}
                                            {service.pricing_config?.price_per_thickness ? ` + ${service.pricing_config.price_per_thickness} × Thickness (in)` : ''}
                                        </code>
                                    </div>
                                </div>
                            );

                            if (isHardware) return (
                                <div className="admin-edit-card hardware-config-card">
                                    <div className="admin-hierarchy-header" style={{ marginBottom: '20px', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div className="icon-badge" style={{ width: '40px', height: '40px', background: '#f5f3ff', color: '#8b5cf6', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Cpu size={18} />
                                            </div>
                                            <div>
                                                <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>Hardware Configuration</span>
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Manage hardware types and specific items for quote flow.</p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {selectedHwType && (
                                                <div className="unit-toggle-pills" style={{ marginRight: '8px' }}>
                                                    <button className={`unit-pill ${hwUnit === 'in' ? 'active' : ''}`} onClick={() => setHwUnit('in')}>IN</button>
                                                    <button className={`unit-pill ${hwUnit === 'mm' ? 'active' : ''}`} onClick={() => setHwUnit('mm')}>MM</button>
                                                </div>
                                            )}
                                            {selectedHwType && (
                                                <button
                                                    className="admin-btn admin-btn-outline"
                                                    style={{ padding: '6px 14px', fontSize: '0.75rem' }}
                                                    onClick={() => setSelectedHwType(null)}
                                                >
                                                    <ChevronLeft size={14} /> Back to Types
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {!selectedHwType ? (
                                        <div className="hardware-type-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                                            {loading ? (
                                                [1, 2, 3, 4].map(i => <div key={i} className="skeleton-box" style={{ height: '100px', borderRadius: '12px' }} />)
                                            ) : hwTypes.length === 0 ? (
                                                <div className="empty-options-state" style={{ gridColumn: '1 / -1' }}>No hardware types found.</div>
                                            ) : hwTypes.map(type => (
                                                <div key={type.id} className="hardware-type-card" style={{ cursor: 'pointer', border: '1.5px solid #f1f5f9' }} onClick={() => setSelectedHwType(type)}>
                                                    <div className="hardware-type-card-header" style={{ padding: '16px' }}>
                                                        {type.image_path ? (
                                                            <img src={type.image_path} alt={type.name} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                                                        ) : (
                                                            <div style={{ width: 48, height: 48, borderRadius: 8, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <Package size={20} color="#94a3b8" />
                                                            </div>
                                                        )}
                                                        <div style={{ flex: 1 }}>
                                                            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>{type.name}</h4>
                                                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{type.item_count} {type.item_count === 1 ? 'Item' : 'Items'}</span>
                                                        </div>
                                                        <ChevronRight size={16} color="#cbd5e1" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="hardware-items-container">
                                            {/* Type Banner */}
                                            <div className="hw-type-banner" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20, padding: '16px 20px', background: '#f8fafc', borderRadius: 12, border: '1px solid #f1f5f9' }}>
                                                {selectedHwType.image_path ? (
                                                    <img
                                                        src={selectedHwType.image_path}
                                                        alt={selectedHwType.name}
                                                        style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, cursor: 'zoom-in', border: '1px solid #e2e8f0' }}
                                                        onClick={() => setZoomedImage(selectedHwType.image_path)}
                                                    />
                                                ) : (
                                                    <div style={{ width: 64, height: 64, borderRadius: 8, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Package size={24} color="#94a3b8" />
                                                    </div>
                                                )}
                                                <div style={{ flex: 1 }}>
                                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{selectedHwType.name}</h3>
                                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                        <button
                                                            className="admin-btn admin-btn-outline"
                                                            style={{ padding: '4px 10px', fontSize: '0.7rem' }}
                                                            onClick={() => hwTypeImgRef.current?.click()}
                                                            disabled={hwTypeImgUploading}
                                                        >
                                                            {hwTypeImgUploading ? 'Uploading...' : <><Upload size={12} /> Change Photo</>}
                                                        </button>
                                                        <input type="file" ref={hwTypeImgRef} hidden accept="image/*" onChange={handleHwTypeImageUpload} />
                                                    </div>
                                                </div>
                                                <button className="admin-btn admin-btn-primary" onClick={() => setEditingHwItem('new')} style={{ padding: '8px 16px', fontSize: '0.8rem' }}>
                                                    <Plus size={14} /> Add Item
                                                </button>
                                            </div>

                                            {/* Items Table / Skeleton */}
                                            <div className="admin-table-wrapper" style={{ boxShadow: 'none', border: '1px solid #f1f5f9' }}>
                                                <table className="admin-table">
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: '40px' }}>#</th>
                                                            <th style={{ width: '60px' }}>Image</th>
                                                            <th style={{ width: '25%' }}>Name</th>
                                                            <th style={{ width: '15%' }}>Size Spec</th>
                                                            <th style={{ width: '25%' }}>Tech Specs ({hwUnit})</th>
                                                            <th style={{ width: '15%' }}>Price</th>
                                                            <th style={{ width: '10%' }}>Status</th>
                                                            <th style={{ textAlign: 'right', width: '100px' }}>Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {loadingHw ? (
                                                            // Skeleton Rows
                                                            [1, 2, 3, 4].map((_, i) => (
                                                                <tr key={`skeleton-${i}`}>
                                                                    <td><div className="skeleton-box" style={{ width: 16, height: 16 }} /></td>
                                                                    <td><div className="skeleton-box" style={{ width: 32, height: 32, borderRadius: 4 }} /></td>
                                                                    <td><div className="skeleton-box" style={{ width: '80%', height: 16 }} /></td>
                                                                    <td><div className="skeleton-box" style={{ width: '60%', height: 16 }} /></td>
                                                                    <td>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                                            <div className="skeleton-box" style={{ width: '40%', height: 10 }} />
                                                                            <div className="skeleton-box" style={{ width: '60%', height: 10 }} />
                                                                            <div className="skeleton-box" style={{ width: '50%', height: 10 }} />
                                                                        </div>
                                                                    </td>
                                                                    <td><div className="skeleton-box" style={{ width: '50px', height: 16 }} /></td>
                                                                    <td><div className="skeleton-box" style={{ width: '50px', height: 16, borderRadius: 10 }} /></td>
                                                                    <td><div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}><div className="skeleton-box" style={{ width: 28, height: 28, borderRadius: 8 }} /><div className="skeleton-box" style={{ width: 28, height: 28, borderRadius: 8 }} /></div></td>
                                                                </tr>
                                                            ))
                                                        ) : hwItems.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={8} style={{ padding: '40px' }}>
                                                                    <div className="empty-options-state" style={{ margin: 0 }}>No items found for this hardware type.</div>
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            hwItems.map((item, index) => (
                                                                <tr key={item.id}>
                                                                    <td data-label="#" style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>{index + 1}</td>
                                                                    <td data-label="Image">
                                                                        <img
                                                                            src={selectedHwType.image_path}
                                                                            className="table-thumb"
                                                                            style={{ width: 32, height: 32, cursor: 'zoom-in', borderRadius: 4, objectFit: 'cover' }}
                                                                            onClick={() => setZoomedImage(selectedHwType.image_path)}
                                                                        />
                                                                    </td>
                                                                    <td data-label="Name" style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.name}</td>
                                                                    <td data-label="Size Spec" style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.size_spec || '—'}</td>
                                                                    <td data-label="Tech Specs" style={{ fontSize: '0.75rem', color: '#444' }}>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                            {selectedHwType.id === 4 ? (
                                                                                <>
                                                                                    {item.length && <div>A: {hwUnit === 'mm' ? toMM(item.length) : item.length}</div>}
                                                                                    {item.base_width && <div>H: {hwUnit === 'mm' ? toMM(item.base_width) : item.base_width}</div>}
                                                                                    {item.shank && <div>Shank: {item.shank}</div>}
                                                                                </>
                                                                            ) : selectedHwType.id === 3 ? (
                                                                                <>
                                                                                    {item.length && <div>T: {hwUnit === 'mm' ? toMM(item.length) : item.length}</div>}
                                                                                    {item.base_width && <div>E: {hwUnit === 'mm' ? toMM(item.base_width) : item.base_width}</div>}
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    {item.length && <div>L: {hwUnit === 'mm' ? toMM(item.length) : item.length}</div>}
                                                                                </>
                                                                            )}
                                                                            {item.min_edge_distance && <div>Edge: {hwUnit === 'mm' ? toMM(item.min_edge_distance) : item.min_edge_distance}</div>}
                                                                            {item.tooling_diameter && <div>Tool: {hwUnit === 'mm' ? toMM(item.tooling_diameter) : item.tooling_diameter}</div>}
                                                                            {selectedHwType?.slug === 'countersink' && item.major_dia && <div>Maj Ø: {hwUnit === 'mm' ? toMM(item.major_dia) : item.major_dia}</div>}
                                                                            {selectedHwType?.slug === 'countersink' && item.minor_dia && <div>Min Ø: {hwUnit === 'mm' ? toMM(item.minor_dia) : item.minor_dia}</div>}
                                                                            {selectedHwType?.slug === 'countersink' && item.angle && <div>Angle: {item.angle}°</div>}
                                                                            {item.max_hole_diameter && <div style={{ color: '#DC2626' }}>Max Hole: {hwUnit === 'mm' ? toMM(item.max_hole_diameter) : item.max_hole_diameter}</div>}
                                                                        </div>
                                                                    </td>
                                                                    <td data-label="Price" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                                                                        ${parseFloat(item.price || 0).toFixed(4)}
                                                                    </td>
                                                                    <td data-label="Status">
                                                                        <span className={`hw-badge ${item.is_active ? 'hw-badge-active' : 'hw-badge-inactive'}`} style={{ fontSize: '0.65rem' }}>
                                                                            {item.is_active ? 'Active' : 'Inactive'}
                                                                        </span>
                                                                    </td>
                                                                    <td data-label="Actions">
                                                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                                                            <button className="admin-icon-btn" onClick={() => {
                                                                                setHwItemForm({
                                                                                    ...item,
                                                                                    name: item.name || '',
                                                                                    size_spec: item.size_spec || '',
                                                                                    notes: item.notes || '',
                                                                                    length: item.length || '',
                                                                                    min_edge_distance: item.min_edge_distance || '',
                                                                                    tooling_diameter: item.tooling_diameter || '',
                                                                                    base_width: item.base_width || '',
                                                                                    shank: item.shank || '',
                                                                                    major_dia: item.major_dia || '',
                                                                                    minor_dia: item.minor_dia || '',
                                                                                    angle: item.angle || '',
                                                                                    max_hole_diameter: item.max_hole_diameter || '',
                                                                                    is_active: item.is_active !== false
                                                                                });
                                                                                setEditingHwItem(item);
                                                                            }}><Edit2 size={12} /></button>
                                                                            <button className="admin-icon-btn danger" onClick={() => setConfirmDeleteHwItem(item)}><Trash2 size={12} /></button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );

                            return null;
                        })()}
                    </section>

                    <aside className="admin-edit-sidebar">
                        {loading ? <CardSkeleton title="Service Image" height={280} /> : (
                            <div className="admin-edit-card image-upload-card">
                                <h3>Service Image</h3>
                                <div className="admin-image-preview-large">
                                    {service.image_path ? (
                                        <img src={service.image_path} alt="Preview" loading="lazy" decoding="async" />
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
                        )}

                        {loading ? <CardSkeleton title="Metadata" height={100} /> : (
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
                        )}

                        {isHardware && !loading && (
                            <div className="admin-edit-card" style={{ background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <Info size={16} color="#3b82f6" />
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#475569', lineHeight: 1.4 }}>
                                        <strong>Pro Tip:</strong> Hardware items are managed in the main configuration card. These appear as options for the customer in the quote flow.
                                    </p>
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            </main>

            <AnimatePresence>
                {isTapModalOpen && (
                    <div className="admin-modal-overlay">
                        <motion.div
                            className="admin-modal-container"
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        >
                            <div className="admin-modal-header">
                                <h3>{editingTapIndex !== null ? 'Edit Tap Configuration' : 'Add New Tap'}</h3>
                                <button className="modal-close-btn" onClick={() => setIsTapModalOpen(false)}><X size={20} /></button>
                            </div>

                            <div className="admin-modal-body admin-modal-scroll-area" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                                <div className="admin-form-group">
                                    <label>Tap Name</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <Hash size={18} style={{ color: '#94a3b8' }} />
                                        <input
                                            type="text"
                                            value={tempTap.name}
                                            onChange={e => setTempTap(t => ({ ...t, name: e.target.value }))}
                                            placeholder="e.g. M2 x 0.4 Roll Tap"
                                        />
                                    </div>
                                </div>

                                <div className="tap-fields-grid" style={{ marginBottom: '20px' }}>
                                    <div className="option-input-group">
                                        <label><ArrowDown size={10} /> Min Diameter (in)</label>
                                        <input type="number" step="0.0001" value={tempTap.min_diameter} onChange={e => setTempTap(t => ({ ...t, min_diameter: e.target.value }))} placeholder="0.0000" />
                                    </div>
                                    <div className="option-input-group">
                                        <label><ArrowUp size={10} /> Max Diameter (in)</label>
                                        <input type="number" step="0.0001" value={tempTap.max_diameter} onChange={e => setTempTap(t => ({ ...t, max_diameter: e.target.value }))} placeholder="0.0000" />
                                    </div>
                                    <div className="option-input-group">
                                        <label><Maximize size={10} /> Max Depth (in)</label>
                                        <input type="number" step="0.0001" value={tempTap.max_depth} onChange={e => setTempTap(t => ({ ...t, max_depth: e.target.value }))} placeholder="0.0000" />
                                    </div>
                                    <div className="option-input-group">
                                        <label>Price / Hole ($)</label>
                                        <input type="number" step="0.01" value={tempTap.price} onChange={e => setTempTap(t => ({ ...t, price: e.target.value }))} placeholder="0.00" />
                                    </div>
                                </div>

                                <div className="admin-form-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <ArrowDown size={10} /> Min Depth Configuration
                                    </label>
                                    <div className="tap-min-depth-modal-row">
                                        <div className="toggle-switch-group" onClick={() => setTempTap(t => ({ ...t, min_depth: t.min_depth === null ? '0' : null }))}>
                                            <div className={`toggle-switch ${tempTap.min_depth === null ? 'active' : ''}`} style={{ width: '40px', height: '22px' }}>
                                                <div className="toggle-handle" style={{ width: '16px', height: '16px', top: '3px', left: tempTap.min_depth === null ? '21px' : '3px' }} />
                                            </div>
                                            <span>{tempTap.min_depth === null ? 'No Limit' : 'Set Limit'}</span>
                                        </div>
                                        {tempTap.min_depth !== null && (
                                            <input
                                                type="number"
                                                step="0.0001"
                                                value={tempTap.min_depth}
                                                onChange={e => setTempTap(t => ({ ...t, min_depth: e.target.value }))}
                                                placeholder="0.0000"
                                                className="modal-small-input"
                                            />
                                        )}
                                    </div>
                                </div>

                                <div className="admin-form-group">
                                    <label>Additional Notes</label>
                                    <textarea
                                        rows={3}
                                        value={tempTap.notes || ''}
                                        onChange={e => setTempTap(t => ({ ...t, notes: e.target.value }))}
                                        placeholder="Enter any material specific notes or hole size recommendations..."
                                    />
                                </div>
                            </div>

                            <div className="admin-modal-footer">
                                <button className="admin-btn admin-btn-outline" onClick={() => setIsTapModalOpen(false)}>Cancel</button>
                                <button className="admin-btn admin-btn-primary" onClick={saveTap}>
                                    <Check size={18} /> {editingTapIndex !== null ? 'Update Tap' : 'Add Tap'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Single-color add/edit popup */}
            <AnimatePresence>
                {isColorModalOpen && (
                    <div className="admin-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 16 }}
                            style={{ width: '100%', maxWidth: '460px', background: '#ffffff', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
                        >
                            {/* Header */}
                            <div style={{ padding: '24px 28px', borderBottom: '1.5px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: tempColor.color || '#000000', border: '3px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} />
                                    <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                        {editingColorIndex !== null ? 'Edit Color' : 'Add Color'}
                                    </h2>
                                </div>
                                <button onClick={() => setIsColorModalOpen(false)} style={{ width: 32, height: 32, borderRadius: 10, background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <X size={16} color="#64748b" />
                                </button>
                            </div>

                            {/* Body */}
                            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                {/* Color picker + hex */}
                                <div className="option-input-group" style={{ marginBottom: 0 }}>
                                    <label>Color</label>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: tempColor.color || '#000000', border: '3px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', flexShrink: 0, cursor: 'pointer', position: 'relative' }}>
                                            <input type="color" value={tempColor.color || '#000000'} onChange={e => setTempColor(c => ({ ...c, color: e.target.value }))} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                                        </div>
                                        <input type="text" value={tempColor.color || ''} onChange={e => setTempColor(c => ({ ...c, color: e.target.value }))} placeholder="#000000" style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }} />
                                    </div>
                                </div>

                                {/* Name */}
                                <div className="option-input-group" style={{ marginBottom: 0 }}>
                                    <label>Color Name</label>
                                    <input type="text" value={tempColor.name || ''} onChange={e => setTempColor(c => ({ ...c, name: e.target.value }))} placeholder="e.g. Matte Black" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }} />
                                </div>

                                {/* Gloss + Wrinkle row */}
                                {service.title.toLowerCase().includes('powder coat') && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                        <div className="option-input-group" style={{ marginBottom: 0 }}>
                                            <label>Gloss (%)</label>
                                            <input type="number" min="0" max="100" value={tempColor.gloss ?? 50} onChange={e => setTempColor(c => ({ ...c, gloss: parseInt(e.target.value) || 0 }))} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontWeight: 700, fontSize: '0.9rem' }} />
                                        </div>
                                        <div className="option-input-group" style={{ marginBottom: 0 }}>
                                            <label>Wrinkle Finish</label>
                                            <div onClick={() => setTempColor(c => ({ ...c, is_wrinkled: !c.is_wrinkled }))} style={{ height: '44px', borderRadius: '12px', background: tempColor.is_wrinkled ? '#eff6ff' : '#f8fafc', border: tempColor.is_wrinkled ? '2px solid #3b82f6' : '1.5px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', color: tempColor.is_wrinkled ? '#3b82f6' : '#94a3b8', gap: 6 }}>
                                                <div style={{ width: 16, height: 16, borderRadius: 5, background: tempColor.is_wrinkled ? '#3b82f6' : '#cbd5e1', transition: 'all 0.2s' }} />
                                                {tempColor.is_wrinkled ? 'On' : 'Off'}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Price Upcharge */}
                                {service.title.toLowerCase().includes('powder coat') ? (
                                    <div style={{ padding: '16px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '16px', border: '1px solid rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ padding: '8px', background: '#fff', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                            <Zap size={16} color="#6366f1" fill="#6366f1" opacity={0.2} />
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.4 }}>
                                            <strong style={{ color: '#1e293b', display: 'block', marginBottom: '2px' }}>Automated Engine Active</strong>
                                            Pricing for this finish is calculated using the batch logic and oven dimensions.
                                        </div>
                                    </div>
                                ) : (
                                    <div className="option-input-group" style={{ marginBottom: 0 }}>
                                        <label>Price Upcharge ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={tempColor.price ?? 0}
                                            onChange={e => setTempColor(c => ({ ...c, price: parseFloat(e.target.value) || 0 }))}
                                            placeholder="0.00"
                                            style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontWeight: 700, fontSize: '0.9rem' }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div style={{ padding: '16px 28px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button onClick={() => setIsColorModalOpen(false)} style={{ padding: '11px 22px', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: 'white', fontWeight: 700, color: '#64748b', cursor: 'pointer', fontSize: '0.9rem' }}>
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (!tempColor.name) { toast('Color name is required', 'error'); return; }
                                        const updated = [...(service.service_options || [])];
                                        if (editingColorIndex !== null) {
                                            updated[editingColorIndex] = tempColor;
                                        } else {
                                            updated.push(tempColor);
                                        }
                                        setService(s => ({ ...s, service_options: updated }));
                                        setIsColorModalOpen(false);
                                    }}
                                    style={{ padding: '11px 28px', borderRadius: '12px', background: '#1e293b', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem' }}
                                >
                                    {editingColorIndex !== null ? 'Save Changes' : 'Add Color'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

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

                /* New Tap Bar Styles */
                .tap-bar-list {
                    display: flex;
                    flex-direction: column;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    overflow: hidden;
                    background: #ffffff;
                }
                .tap-bar-header {
                    display: grid;
                    grid-template-columns: 1fr 140px 140px 100px 100px;
                    background: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                    padding: 12px 20px;
                    font-size: 0.7rem;
                    font-weight: 800;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .tap-option-bar {
                    display: grid;
                    grid-template-columns: 1fr 140px 140px 100px 100px;
                    padding: 14px 20px;
                    border-bottom: 1px solid #f1f5f9;
                    align-items: center;
                    transition: all 0.2s;
                }
                .tap-option-bar:last-child { border-bottom: none; }
                .tap-option-bar:hover { background: #fdfcff; }
                
                .col-name { display: flex; align-items: center; gap: 8px; }
                .tap-name-label { font-weight: 700; color: #1e293b; font-size: 0.95rem; }
                .tap-notes-indicator { 
                    font-size: 0.65rem; 
                    background: #f1f5f9; 
                    color: #64748b; 
                    padding: 2px 6px; 
                    border-radius: 4px; 
                    cursor: help;
                }
                
                .diam-range, .depth-info { font-family: 'JetBrains Mono', monospace, monospace; font-size: 0.85rem; color: #475569; }
                .price-tag { font-weight: 800; color: #8b5cf6; }
                
                .col-actions { display: flex; gap: 8px; justify-content: flex-end; }
                .tap-action-btn {
                    width: 32px; height: 32px;
                    display: flex; align-items: center; justify-content: center;
                    border-radius: 8px; border: none; cursor: pointer;
                    transition: all 0.2s;
                }
                .tap-action-btn.edit { background: #f5f3ff; color: #8b5cf6; }
                .tap-action-btn.edit:hover { background: #ede9fe; transform: translateY(-1px); }
                .tap-action-btn.delete { background: #fff1f2; color: #fb7185; }
                .tap-action-btn.delete:hover { background: #ffe4e6; transform: translateY(-1px); }

                /* Modal Styles */
                .admin-modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(15, 23, 42, 0.4);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 20px;
                }
                .admin-modal-container {
                    background: #ffffff;
                    border-radius: 24px;
                    width: 100%;
                    max-width: 550px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
                    overflow: hidden;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }
                .admin-modal-header {
                    padding: 24px 30px;
                    background: #ffffff;
                    border-bottom: 1px solid #f1f5f9;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .admin-modal-header h3 { font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0; }
                .modal-close-btn { background: none; border: none; color: #94a3b8; cursor: pointer; transition: color 0.2s; }
                .modal-close-btn:hover { color: #1e293b; }

                .admin-modal-body { padding: 30px; }
                .admin-modal-footer {
                    padding: 20px 30px;
                    background: #f8fafc;
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    border-top: 1px solid #f1f5f9;
                }
                
                .tap-min-depth-modal-row {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    background: #f8fafc;
                    padding: 12px 16px;
                    border-radius: 12px;
                    border: 1.5px solid #e2e8f0;
                }
                .modal-small-input {
                    flex: 1;
                    max-width: 150px;
                    margin: 0 !important;
                    background: white !important;
                }

                @media (max-width: 768px) {
                    .admin-edit-page { padding: 16px 16px 60px; }
                    .admin-edit-top-actions { flex-direction: column; align-items: flex-start; gap: 16px; }
                    .admin-edit-actions-row { width: 100%; display: grid; grid-template-columns: 1fr 1.5fr; gap: 8px; }
                    .admin-edit-actions-row button { width: 100%; justify-content: center; padding: 10px 8px; font-size: 0.8rem; }
                    .admin-edit-grid { grid-template-columns: 1fr; gap: 20px; }
                    .admin-edit-sidebar { order: -1; }
                    .capacity-row { grid-template-columns: 1fr 1fr; gap: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; }
                    .capacity-row.header { display: none; }
                    .capacity-label-cell { grid-column: span 2; font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; margin-bottom: 1px; }
                    .option-item-row { grid-template-columns: 1fr; gap: 16px; position: relative; padding-top: 40px; }
                    .option-remove-btn { position: absolute; top: 12px; right: 12px; }
                    
                    .admin-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
                    .admin-table thead { display: none; }
                    .admin-table tr { display: flex; flexDirection: column; padding: 16px 0; border-bottom: 1px solid #f1f5f9; }
                    .admin-table td { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border: none; text-align: left; }
                    .admin-table td:last-child { display: flex; justify-content: flex-end; }
                    .admin-table td::before { content: attr(data-label); font-size: 11px; font-weight: 800; text-transform: uppercase; color: #94a3b8; margin-right: 12px; }

                    .hw-type-banner { flex-direction: column; align-items: stretch !important; padding: 20px !important; gap: 16px !important; }
                    .hw-type-banner img { width: 48px !important; height: 48px !important; }
                    .hw-type-banner .admin-btn-primary { width: 100%; justify-content: center; }

                    .laser-pricing-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
                    .parent-selection-grid { grid-template-columns: 1fr !important; }

                    .tap-bar-list { overflow-x: auto; -webkit-overflow-scrolling: touch; }
                    .tap-bar-header, .tap-option-bar { min-width: 650px; }
                }

                /* Premium Scrollbar Design */
                .admin-modal-scroll-area::-webkit-scrollbar {
                    width: 6px;
                }
                .admin-modal-scroll-area::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 10px;
                }
                .admin-modal-scroll-area::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 10px;
                    transition: all 0.2s;
                }
                .admin-modal-scroll-area::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
                
                /* Applying to the whole page as well for consistency */
                ::-webkit-scrollbar {
                    width: 8px;
                }
                ::-webkit-scrollbar-track {
                    background: #f8fafc;
                }
                ::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>

            {/* ── Add / Edit Hardware Item Modal ─────────────────────── */}
            <AnimatePresence>
                {editingHwItem !== null && (
                    <motion.div className="admin-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingHwItem(null)}>
                        <motion.div
                            className="admin-modal"
                            style={{ width: '100%', maxWidth: '680px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', background: 'white' }}
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                                        {editingHwItem === 'new' ? 'Add New Hardware' : 'Edit Hardware Item'}
                                    </h3>
                                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>Configure specifications & pricing for {selectedHwType?.name}</p>
                                </div>
                                <button className="modal-close-btn" onClick={() => setEditingHwItem(null)} style={{ padding: '8px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #f1f5f9', cursor: 'pointer', color: '#64748b' }}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="admin-modal-scroll-area" style={{ padding: '32px', maxHeight: '70vh', overflowY: 'auto' }}>
                                {/* Category Banner - Inherited Asset Style */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 20,
                                    padding: '24px',
                                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                    borderRadius: '20px',
                                    border: '1px solid #e2e8f0',
                                    marginBottom: '32px'
                                }}>
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                        <div style={{ width: 72, height: 72, borderRadius: '16px', overflow: 'hidden', border: '2px solid white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                            <img src={selectedHwType?.image_path} alt="category" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                        <div style={{ position: 'absolute', bottom: -6, right: -6, background: '#3b82f6', borderRadius: '10px', padding: '5px', border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                            <Shield size={14} color="white" />
                                        </div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shared Visual Asset</span>
                                        <h4 style={{ margin: '2px 0 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{selectedHwType?.name}</h4>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                                    {/* Name Field */}
                                    <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: '#475569', display: 'block' }}>Hardware Name *</label>
                                        <input
                                            value={hwItemForm.name}
                                            onChange={e => setHwItemForm(p => ({ ...p, name: e.target.value }))}
                                            placeholder="e.g. M4 x 10mm Flush Stud"
                                            style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1.5px solid #e2e8f0', fontSize: '1rem', background: '#fafafa', transition: 'all 0.2s' }}
                                        />
                                    </div>

                                    {/* Spec & Price Grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                        <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                            <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: '#475569', display: 'block' }}>Size / Specification</label>
                                            <input
                                                value={hwItemForm.size_spec}
                                                onChange={e => setHwItemForm(p => ({ ...p, size_spec: e.target.value }))}
                                                placeholder="e.g. M4, 1/4-20"
                                                style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1.5px solid #e2e8f0', fontSize: '0.95rem' }}
                                            />
                                        </div>
                                        <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                            <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: '#475569', display: 'block' }}>Unit Price ($)</label>
                                            <input
                                                type="number"
                                                step="0.0001"
                                                value={hwItemForm.price}
                                                onChange={e => setHwItemForm(p => ({ ...p, price: e.target.value }))}
                                                placeholder="0.0000"
                                                style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1.5px solid #e2e8f0', fontSize: '0.95rem' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Engineering Specifications Grid */}
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '20px' }}>
                                            <div style={{ width: 32, height: 32, borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Layers size={16} color="#3b82f6" />
                                            </div>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>Engineering Specifications</span>
                                            <div style={{ flex: 1, height: '1px', background: '#f1f5f9' }}></div>
                                            <div className="unit-toggle-pills" style={{ marginLeft: '12px' }}>
                                                <button className={`unit-pill ${hwUnit === 'in' ? 'active' : ''}`} onClick={() => setHwUnit('in')}>IN</button>
                                                <button className={`unit-pill ${hwUnit === 'mm' ? 'active' : ''}`} onClick={() => setHwUnit('mm')}>MM</button>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px 32px' }}>
                                            <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 800, marginBottom: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: 7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    <Ruler size={13} /> {selectedHwType?.id === 4 ? `Thickness (A) (${hwUnit})` : selectedHwType?.id === 3 ? `Thickness (T) (${hwUnit})` : `Length (${hwUnit})`}
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.001"
                                                    value={hwUnit === 'mm' ? toMM(hwItemForm.length) : (hwItemForm.length || '')}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setHwItemForm(p => ({ ...p, length: hwUnit === 'mm' ? toIN(val) : val }));
                                                    }}
                                                    placeholder={hwUnit === 'mm' ? "0.00" : ".000"}
                                                    style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', background: 'white' }}
                                                />
                                            </div>

                                            {(selectedHwType?.id === 3 || selectedHwType?.id === 4) && (
                                                <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                                    <label style={{ fontSize: '0.7rem', fontWeight: 800, marginBottom: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: 7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        <Maximize size={13} /> {selectedHwType?.id === 4 ? `Base width (H) (${hwUnit})` : `Outside Dimension (E) (${hwUnit})`}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.001"
                                                        value={hwUnit === 'mm' ? toMM(hwItemForm.base_width) : (hwItemForm.base_width || '')}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setHwItemForm(p => ({ ...p, base_width: hwUnit === 'mm' ? toIN(val) : val }));
                                                        }}
                                                        placeholder={hwUnit === 'mm' ? "0.00" : ".000"}
                                                        style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', background: 'white' }}
                                                    />
                                                </div>
                                            )}

                                            {selectedHwType?.id === 4 && (
                                                <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                                    <label style={{ fontSize: '0.7rem', fontWeight: 800, marginBottom: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: 7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        <Hash size={13} /> Shank
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="1"
                                                        value={hwItemForm.shank || ''}
                                                        onChange={e => setHwItemForm(p => ({ ...p, shank: e.target.value }))}
                                                        placeholder="e.g. 2, 3"
                                                        style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', background: 'white' }}
                                                    />
                                                </div>
                                            )}

                                            <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 800, marginBottom: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: 7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    <Package size={13} /> {selectedHwType?.id === 3 || selectedHwType?.id === 4 ? `Min Centerline to Edge (${hwUnit})` : `Min Edge (${hwUnit})`}
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.001"
                                                    value={hwUnit === 'mm' ? toMM(hwItemForm.min_edge_distance) : (hwItemForm.min_edge_distance || '')}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setHwItemForm(p => ({ ...p, min_edge_distance: hwUnit === 'mm' ? toIN(val) : val }));
                                                    }}
                                                    placeholder={hwUnit === 'mm' ? "0.00" : ".000"}
                                                    style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', background: 'white' }}
                                                />
                                            </div>

                                            <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 800, marginBottom: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: 7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    <Wrench size={13} /> {selectedHwType?.id === 2 ? `Standoff Outer Diameter (${hwUnit})` : `Tooling Diameter (${hwUnit})`}
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.001"
                                                    value={hwUnit === 'mm' ? toMM(hwItemForm.tooling_diameter) : (hwItemForm.tooling_diameter || '')}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setHwItemForm(p => ({ ...p, tooling_diameter: hwUnit === 'mm' ? toIN(val) : val }));
                                                    }}
                                                    placeholder={hwUnit === 'mm' ? "0.00" : ".000"}
                                                    style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', background: 'white' }}
                                                />
                                                {selectedHwType?.id === 2 && (
                                                    <p className="admin-card-tip" style={{ marginTop: '6px', marginBottom: 0 }}>Used as the standoff body diameter in the 3D viewer.</p>
                                                )}
                                            </div>

                                            {/* Countersink-specific fields */}
                                            {selectedHwType?.slug === 'countersink' && (<>
                                                <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                                    <label style={{ fontSize: '0.7rem', fontWeight: 800, marginBottom: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: 7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        <Ruler size={13} /> Major Dia ({hwUnit})
                                                    </label>
                                                    <input
                                                        type="number" step="0.001" min="0"
                                                        value={hwUnit === 'mm' ? toMM(hwItemForm.major_dia) : (hwItemForm.major_dia || '')}
                                                        onChange={e => { const val = e.target.value; setHwItemForm(p => ({ ...p, major_dia: hwUnit === 'mm' ? toIN(val) : val })); }}
                                                        placeholder={hwUnit === 'mm' ? "e.g. 8.13" : "e.g. .320"}
                                                        style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', background: 'white' }}
                                                    />
                                                </div>
                                                <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                                    <label style={{ fontSize: '0.7rem', fontWeight: 800, marginBottom: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: 7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        <Ruler size={13} /> Minor Dia ({hwUnit})
                                                    </label>
                                                    <input
                                                        type="number" step="0.001" min="0"
                                                        value={hwUnit === 'mm' ? toMM(hwItemForm.minor_dia) : (hwItemForm.minor_dia || '')}
                                                        onChange={e => { const val = e.target.value; setHwItemForm(p => ({ ...p, minor_dia: hwUnit === 'mm' ? toIN(val) : val })); }}
                                                        placeholder={hwUnit === 'mm' ? "e.g. 4.17" : "e.g. .164"}
                                                        style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', background: 'white' }}
                                                    />
                                                </div>
                                                <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                                    <label style={{ fontSize: '0.7rem', fontWeight: 800, marginBottom: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: 7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        <Hash size={13} /> Angle (°)
                                                    </label>
                                                    <input
                                                        type="number" step="1" min="1" max="179"
                                                        value={hwItemForm.angle || ''}
                                                        onChange={e => setHwItemForm(p => ({ ...p, angle: e.target.value }))}
                                                        placeholder="e.g. 82 or 90"
                                                        style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', background: 'white' }}
                                                    />
                                                </div>
                                            </>)}

                                            {/* Max Hole Diameter — all types */}
                                            <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 800, marginBottom: '10px', color: '#DC2626', display: 'flex', alignItems: 'center', gap: 7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    <Maximize size={13} /> Max Hole Dia ({hwUnit})
                                                </label>
                                                <input
                                                    type="number" step="0.001" min="0"
                                                    value={hwUnit === 'mm' ? toMM(hwItemForm.max_hole_diameter) : (hwItemForm.max_hole_diameter || '')}
                                                    onChange={e => { const val = e.target.value; setHwItemForm(p => ({ ...p, max_hole_diameter: hwUnit === 'mm' ? toIN(val) : val })); }}
                                                    placeholder="No limit"
                                                    style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #fecaca', fontSize: '0.9rem', background: 'white' }}
                                                />
                                                <p className="admin-card-tip" style={{ marginTop: '6px', marginBottom: 0 }}>Holes larger than this diameter cannot use this item.</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Notes Field */}
                                    <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: '#475569', display: 'block' }}>Notes</label>
                                        <textarea
                                            rows={2}
                                            value={hwItemForm.notes || ''}
                                            onChange={e => setHwItemForm(p => ({ ...p, notes: e.target.value }))}
                                            placeholder="Optional engineering or usage notes..."
                                            style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1.5px solid #e2e8f0', fontSize: '0.95rem', resize: 'vertical', minHeight: '80px', outline: 'none' }}
                                        />
                                    </div>

                                    {/* Visibility Toggle */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', background: '#eff6ff', borderRadius: '16px', border: '1px solid #dbeafe' }}>
                                        <input
                                            type="checkbox"
                                            id="hw-active-check"
                                            checked={hwItemForm.is_active}
                                            onChange={e => setHwItemForm(p => ({ ...p, is_active: e.target.checked }))}
                                            style={{ width: 18, height: 18, cursor: 'pointer' }}
                                        />
                                        <label htmlFor="hw-active-check" style={{ fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', color: '#1e293b' }}>Active Status (Visible to customers)</label>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Actions */}
                            <div style={{ padding: '24px 32px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
                                <button className="admin-btn admin-btn-secondary" onClick={() => setEditingHwItem(null)} disabled={savingHwItem} style={{ padding: '12px 24px', borderRadius: '12px', background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}>
                                    Cancel
                                </button>
                                <button
                                    className="admin-btn admin-btn-primary"
                                    onClick={handleSaveHwItem}
                                    disabled={savingHwItem}
                                    style={{ padding: '12px 32px', borderRadius: '12px', background: '#3b82f6', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)' }}
                                >
                                    {savingHwItem ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                    {savingHwItem ? 'Saving...' : 'Save Item Changes'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Delete Hardware Item Confirm ────────────────────────────── */}
            <AnimatePresence>
                {confirmDeleteHwItem && (
                    <motion.div className="admin-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmDeleteHwItem(null)}>
                        <motion.div className="admin-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                            <div className="admin-modal-header">
                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Delete Item</h3>
                            </div>
                            <div style={{ padding: '20px 24px' }}>
                                <p style={{ margin: 0, color: '#475569', fontSize: '0.9rem' }}>
                                    Are you sure you want to delete <strong>{confirmDeleteHwItem.name}</strong>? This action cannot be undone.
                                </p>
                            </div>
                            <div className="admin-modal-actions">
                                <button className="admin-btn admin-btn-secondary" onClick={() => setConfirmDeleteHwItem(null)}>Cancel</button>
                                <button className="admin-btn admin-btn-danger" onClick={handleDeleteHwItem}>Delete Item</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            <ImageModal src={zoomedImage} alt="Hardware Image" onClose={() => setZoomedImage(null)} />
        </div >
    );
}


