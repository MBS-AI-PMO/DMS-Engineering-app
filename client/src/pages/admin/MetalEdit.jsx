/* eslint-disable no-unused-vars */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Save, ArrowLeft, ChevronDown, ChevronRight, Code, FormInput, Upload } from 'lucide-react';
import { fetchMetalBySlug, fetchCategories, fetchServices, createMetal, updateMetal, uploadMetalImage } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import ImageModal from '../../components/admin/ImageModal';

const TABS = ['Quick Look', 'Specifications', 'About', 'Services', 'FAQs'];

const SPEC_SECTIONS = [
    { key: 'generalDetails', label: 'General Details', fields: ['label', 'inch', 'mm'] },
    { key: 'laserCuttingSpecs', label: 'Laser Cutting', fields: ['label', 'inch', 'mm'] },
    { key: 'bendingSpecs', label: 'Bending', fields: ['label', 'inch', 'mm'] },
    { key: 'countersinkSpecs', label: 'Countersink', fields: ['label', 'inch', 'mm'] },
    { key: 'deburringSpecs', label: 'Deburring', fields: ['label', 'inch', 'mm'] },
    { key: 'dimpleSpecs', label: 'Dimple', fields: ['label', 'inch', 'mm'] },
    { key: 'hardwareSpecs', label: 'Hardware', fields: ['label', 'inch', 'mm'] },
    { key: 'platingSpecs', label: 'Plating', fields: ['label', 'inch', 'mm'] },
    { key: 'powderCoatingSpecs', label: 'Powder Coating', fields: ['label', 'inch', 'mm'] },
    { key: 'tappingSpecs', label: 'Tapping', fields: ['label', 'inch', 'mm'] },
    { key: 'tumbleSpecs', label: 'Tumble', fields: ['label', 'inch', 'mm'] },
    { key: 'anodizingSpecs', label: 'Anodizing', fields: ['label', 'inch', 'mm'] },
    { key: 'properties', label: 'Properties', fields: ['label', 'value'] },
];

const emptyMetal = {
    name: '',
    category_id: '',
    thickness: '',
    description: '',
    image_path: '',
    quick_look: { thicknesses: [], cutSizes: [], tolerance: '' },
    specifications: {},
    thickness_specs: {},
    about_section: null,
    services: [],
    faqs: [],
    custom_fields: {},
};

// ── Showcase Editor for thicknesses ──────────────────────
function ShowcaseEditor({ images = [], onChange, onUpload, onZoom }) {
    return (
        <div className="admin-showcase-editor">
            <div className="admin-section-header">
                <h4>Showcase Images</h4>
                <label className="admin-btn-primary" style={{ cursor: 'pointer', fontSize: 12, padding: '6px 12px' }}>
                    <Plus size={14} /> Add Image
                    <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={async e => {
                            const file = e.target.files[0];
                            if (!file) return;
                            const path = await onUpload(file);
                            if (path) onChange([...images, path]);
                        }}
                    />
                </label>
            </div>
            <div className="admin-showcase-grid">
                {images.map((img, i) => (
                    <div key={i} className="admin-showcase-item">
                        <div
                            className="admin-image-field-preview showcase-thumb"
                            style={{ cursor: 'zoom-in' }}
                            onClick={() => onZoom({ src: img, title: `Showcase Image ${i + 1}` })}
                        >
                            <img src={img} alt={`Showcase ${i}`} />
                            <button
                                className="admin-showcase-remove"
                                onClick={e => {
                                    e.stopPropagation();
                                    onChange(images.filter((_, idx) => idx !== i));
                                }}
                                title="Remove Image"
                            >
                                <Plus size={16} style={{ transform: 'rotate(45deg)' }} />
                            </button>
                        </div>
                    </div>
                ))}
                {images.length === 0 && (
                    <p className="admin-empty-hint">No showcase images added yet.</p>
                )}
            </div>
        </div>
    );
}

// ── Reusable spec section editor ─────────────────────────
function SpecSectionEditor({ sectionKey, label, fields, data, onChange }) {
    const [open, setOpen] = useState(false);
    const rows = data[sectionKey] || [];

    const setRows = (newRows) => {
        onChange({ ...data, [sectionKey]: newRows });
    };

    const addRow = () => {
        const empty = {};
        fields.forEach(f => { empty[f] = ''; });
        setRows([...rows, empty]);
    };

    const updateRow = (i, field, val) => {
        const copy = rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
        setRows(copy);
    };

    const removeRow = (i) => {
        setRows(rows.filter((_, idx) => idx !== i));
    };

    return (
        <div className="spec-section-editor" style={{ marginBottom: 12 }}>
            <button className="spec-section-toggle" onClick={() => setOpen(!open)}>
                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span>{label}</span>
                <span className="spec-section-count">{rows.length} row{rows.length !== 1 ? 's' : ''}</span>
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div className="spec-section-body">
                            {rows.length > 0 && (
                                <div className="spec-header-row">
                                    {fields.map(f => (
                                        <span key={f} className="spec-header-cell">{f.charAt(0).toUpperCase() + f.slice(1)}</span>
                                    ))}
                                    <span className="spec-header-cell" style={{ width: 40 }}></span>
                                </div>
                            )}
                            {rows.map((row, i) => (
                                <div key={i} className="spec-row">
                                    {fields.map(f => (
                                        <input
                                            key={f}
                                            type="text"
                                            placeholder={f}
                                            value={row[f] || ''}
                                            onChange={e => updateRow(i, f, e.target.value)}
                                            className="spec-row-input"
                                        />
                                    ))}
                                    <button className="admin-icon-btn danger" onClick={() => removeRow(i)}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                            <button className="admin-btn-ghost spec-add-row" onClick={addRow}>
                                <Plus size={14} /> Add Row
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Main Component ───────────────────────────────────────
export default function MetalEdit() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const isNew = !slug;
    const toast = useToast();

    const [metal, setMetal] = useState(emptyMetal);
    const [categories, setCategories] = useState([]);
    const [allServices, setAllServices] = useState([]);
    const [activeTab, setActiveTab] = useState('Quick Look');
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [rawJsonMode, setRawJsonMode] = useState({});
    const [zoomedImage, setZoomedImage] = useState(null);
    const [selectedThicknessIdx, setSelectedThicknessIdx] = useState(0);
    const [selectedServicesThicknessIdx, setSelectedServicesThicknessIdx] = useState(0);

    useEffect(() => {
        fetchCategories().then(setCategories).catch(err => toast('Failed to load categories: ' + err.message, 'error'));
        fetchServices().then(setAllServices).catch(err => toast('Failed to load services: ' + err.message, 'error'));
        if (!isNew) {
            fetchMetalBySlug(slug)
                .then(data => setMetal({
                    name: data.name || '',
                    category_id: data.category_id || '',
                    thickness: data.thickness || '',
                    description: data.description || '',
                    image_path: data.image_path || '',
                    quick_look: data.quick_look || emptyMetal.quick_look,
                    specifications: data.specifications || {},
                    thickness_specs: data.thickness_specs || {},
                    about_section: data.about_section || null,
                    services: data.services || [],
                    faqs: data.faqs || [],
                    custom_fields: data.custom_fields || {},
                }))
                .catch(err => toast('Failed to load metal details: ' + err.message, 'error'))
                .finally(() => setLoading(false));
        }
    }, [slug, isNew, toast]);

    const set = useCallback((key, value) => setMetal(prev => ({ ...prev, [key]: value })), []);

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            if (isNew) {
                await createMetal(metal);
            } else {
                await updateMetal(slug, metal);
            }
            toast('Metal saved successfully', 'success');
            navigate('/admin/metals');
        } catch (err) {
            setError(err.message);
            toast('Save failed: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    // Custom fields helpers
    const addCustomField = () => {
        const key = `field_${Date.now()}`;
        set('custom_fields', { ...metal.custom_fields, [key]: { label: '', value: '', tab: 'Quick Look' } });
    };
    const updateCustomField = (key, prop, val) => {
        set('custom_fields', {
            ...metal.custom_fields,
            [key]: { ...metal.custom_fields[key], [prop]: val }
        });
    };
    const removeCustomField = (key) => {
        const cf = { ...metal.custom_fields };
        delete cf[key];
        set('custom_fields', cf);
    };

    // FAQ helpers
    const addFaq = () => set('faqs', [...metal.faqs, { question: '', answer: '' }]);
    const updateFaq = (i, prop, val) => {
        const faqs = [...metal.faqs];
        faqs[i] = { ...faqs[i], [prop]: val };
        set('faqs', faqs);
    };
    const removeFaq = (i) => set('faqs', metal.faqs.filter((_, idx) => idx !== i));

    // Quick Look helpers
    const ql = metal.quick_look || { thicknesses: [], cutSizes: [], tolerance: '' };

    const setQL = (newQL) => set('quick_look', newQL);

    const addThickness = () => {
        setQL({ ...ql, thicknesses: [...(ql.thicknesses || []), { value: '', metric: '' }] });
    };
    const updateThickness = (i, field, val) => {
        const arr = [...(ql.thicknesses || [])];
        arr[i] = { ...arr[i], [field]: val };
        setQL({ ...ql, thicknesses: arr });
    };
    const removeThickness = (i) => {
        setQL({ ...ql, thicknesses: (ql.thicknesses || []).filter((_, idx) => idx !== i) });
    };

    const addCutSize = () => {
        setQL({ ...ql, cutSizes: [...(ql.cutSizes || []), { label: '', size: '', action: 'Instant Pricing', type: 'solid' }] });
    };
    const updateCutSize = (i, field, val) => {
        const arr = [...(ql.cutSizes || [])];
        arr[i] = { ...arr[i], [field]: val };
        setQL({ ...ql, cutSizes: arr });
    };
    const removeCutSize = (i) => {
        setQL({ ...ql, cutSizes: (ql.cutSizes || []).filter((_, idx) => idx !== i) });
    };

    // Thickness specs helpers
    const thicknesses = ql.thicknesses || [];
    const currentThicknessKey = thicknesses[selectedThicknessIdx]?.value || '';
    const currentThicknessSpecs = metal.thickness_specs?.[currentThicknessKey] || {};

    const setCurrentThicknessSpecs = (newSpecs) => {
        if (!currentThicknessKey) return;
        set('thickness_specs', { ...metal.thickness_specs, [currentThicknessKey]: newSpecs });
    };

    const toggleRawJson = (section) => {
        setRawJsonMode(prev => ({ ...prev, [section]: !prev[section] }));
    };

    if (loading) return <div className="admin-page"><div className="skeleton skeleton-card" style={{ height: 400 }} /></div>;

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <button className="admin-btn-ghost" onClick={() => navigate('/admin/metals')}>
                    <ArrowLeft size={16} /> Back
                </button>
                <h1 className="admin-page-title">{isNew ? 'New Metal' : `Edit: ${metal.name}`}</h1>
                <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>
                    <Save size={16} /> {saving ? 'Saving...' : 'Save'}
                </button>
            </div>

            {error && <div className="admin-error-banner">{error}</div>}

            {/* Base fields */}
            <div className="admin-form-grid">
                <div className="admin-form-group">
                    <label>Name</label>
                    <input type="text" value={metal.name} onChange={e => set('name', e.target.value)} />
                </div>
                <div className="admin-form-group">
                    <label>Category</label>
                    <select value={metal.category_id} onChange={e => set('category_id', e.target.value)}>
                        <option value="">— Select —</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="admin-form-group">
                    <label>Thickness range</label>
                    <input type="text" value={metal.thickness} onChange={e => set('thickness', e.target.value)} placeholder={'e.g. 7 thicknesses: 0.030" - 0.125"'} />
                </div>
                <div className="admin-form-group">
                    <label>Image</label>
                    <div className="admin-image-field">
                        {metal.image_path && (
                            <div
                                className="admin-image-field-preview"
                                style={{ cursor: 'zoom-in' }}
                                onClick={() => setZoomedImage({ src: metal.image_path, title: metal.name })}
                            >
                                <img
                                    src={metal.image_path}
                                    alt={metal.name}
                                    onError={e => { e.target.style.display = 'none'; }}
                                />
                            </div>
                        )}
                        <div className="admin-image-field-actions">
                            <label className="admin-btn-ghost" style={{ cursor: 'pointer' }}>
                                <Upload size={14} /> {metal.image_path ? 'Change Image' : 'Upload Image'}
                                <input
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={async e => {
                                        const file = e.target.files[0];
                                        if (!file) return;
                                        try {
                                            const { data } = await uploadMetalImage(file);
                                            set('image_path', data.image_path);
                                        } catch (err) {
                                            toast('Image upload failed: ' + err.message, 'error');
                                        }
                                    }}
                                />
                            </label>
                            {metal.image_path && (
                                <input
                                    type="text"
                                    value={metal.image_path}
                                    onChange={e => set('image_path', e.target.value)}
                                    placeholder="/uploads/metals/..."
                                    style={{ flex: 1, fontSize: 12 }}
                                />
                            )}
                        </div>
                    </div>
                </div>
                <div className="admin-form-group full-width">
                    <label>Description</label>
                    <textarea rows={3} value={metal.description} onChange={e => set('description', e.target.value)} />
                </div>
            </div>

            {/* 5 Tabs */}
            <div className="admin-editor-tabs">
                {TABS.map(tab => (
                    <button
                        key={tab}
                        className={`admin-tab-btn ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab}
                        {activeTab === tab && (
                            <motion.div className="admin-tab-indicator" layoutId="admin-tab-indicator"
                                transition={{ type: 'spring', stiffness: 350, damping: 30 }} />
                        )}
                    </button>
                ))}
            </div>

            <div className="admin-tab-panel">
                {/* ── Quick Look Tab ── */}
                {activeTab === 'Quick Look' && (
                    <div className="admin-structured-editor">
                        <div className="admin-form-group">
                            <label>Tolerance</label>
                            <input
                                type="text"
                                value={ql.tolerance || ''}
                                onChange={e => setQL({ ...ql, tolerance: e.target.value })}
                                placeholder='e.g. +/- .005"'
                            />
                        </div>

                        {/* Thicknesses */}
                        <div className="admin-repeatable-section">
                            <div className="admin-section-header">
                                <h4>Thicknesses</h4>
                                <button className="admin-btn-ghost" onClick={addThickness}>
                                    <Plus size={14} /> Add Thickness
                                </button>
                            </div>
                            {(ql.thicknesses || []).length > 0 && (
                                <div className="spec-header-row">
                                    <span className="spec-header-cell">Value (inch)</span>
                                    <span className="spec-header-cell">Metric (mm)</span>
                                    <span className="spec-header-cell" style={{ width: 40 }}></span>
                                </div>
                            )}
                            {(ql.thicknesses || []).map((t, i) => (
                                <div key={i} className="spec-row">
                                    <input
                                        type="text"
                                        value={t.value || ''}
                                        onChange={e => updateThickness(i, 'value', e.target.value)}
                                        placeholder='.025"'
                                        className="spec-row-input"
                                    />
                                    <input
                                        type="text"
                                        value={t.metric || ''}
                                        onChange={e => updateThickness(i, 'metric', e.target.value)}
                                        placeholder='.64mm'
                                        className="spec-row-input"
                                    />
                                    <button className="admin-icon-btn danger" onClick={() => removeThickness(i)}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Cut Sizes */}
                        <div className="admin-repeatable-section">
                            <div className="admin-section-header">
                                <h4>Cut Sizes</h4>
                                <button className="admin-btn-ghost" onClick={addCutSize}>
                                    <Plus size={14} /> Add Cut Size
                                </button>
                            </div>
                            {(ql.cutSizes || []).length > 0 && (
                                <div className="spec-header-row">
                                    <span className="spec-header-cell">Label</span>
                                    <span className="spec-header-cell">Size</span>
                                    <span className="spec-header-cell">Action</span>
                                    <span className="spec-header-cell">Type</span>
                                    <span className="spec-header-cell" style={{ width: 40 }}></span>
                                </div>
                            )}
                            {(ql.cutSizes || []).map((cs, i) => (
                                <div key={i} className="spec-row">
                                    <input
                                        type="text"
                                        value={cs.label || ''}
                                        onChange={e => updateCutSize(i, 'label', e.target.value)}
                                        placeholder='A'
                                        className="spec-row-input"
                                    />
                                    <input
                                        type="text"
                                        value={cs.size || ''}
                                        onChange={e => updateCutSize(i, 'size', e.target.value)}
                                        placeholder='.25" x .375" min'
                                        className="spec-row-input"
                                    />
                                    <select
                                        value={cs.action || 'Instant Pricing'}
                                        onChange={e => updateCutSize(i, 'action', e.target.value)}
                                        className="spec-row-input"
                                    >
                                        <option value="Instant Pricing">Instant Pricing</option>
                                        <option value="Custom Quote">Custom Quote</option>
                                    </select>
                                    <select
                                        value={cs.type || 'solid'}
                                        onChange={e => updateCutSize(i, 'type', e.target.value)}
                                        className="spec-row-input"
                                    >
                                        <option value="solid">Solid</option>
                                        <option value="outline">Outline</option>
                                    </select>
                                    <button className="admin-icon-btn danger" onClick={() => removeCutSize(i)}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Raw JSON fallback */}
                        <button className="admin-btn-ghost raw-json-toggle" onClick={() => toggleRawJson('quickLook')}>
                            <Code size={14} /> {rawJsonMode.quickLook ? 'Hide' : 'Show'} Raw JSON
                        </button>
                        {rawJsonMode.quickLook && (
                            <textarea
                                className="admin-raw-json"
                                rows={10}
                                value={JSON.stringify(metal.quick_look, null, 2)}
                                onChange={e => {
                                    try { set('quick_look', JSON.parse(e.target.value)); } catch { /* invalid json */ }
                                }}
                            />
                        )}
                    </div>
                )}

                {/* ── Specifications Tab ── */}
                {activeTab === 'Specifications' && (
                    <div className="admin-structured-editor">
                        {/* Mode toggle */}
                        <div className="spec-mode-toggle">
                            <button
                                className={`admin-btn-ghost ${!rawJsonMode.specs ? 'active' : ''}`}
                                onClick={() => setRawJsonMode(prev => ({ ...prev, specs: false }))}
                            >
                                <FormInput size={14} /> Structured
                            </button>
                            <button
                                className={`admin-btn-ghost ${rawJsonMode.specs ? 'active' : ''}`}
                                onClick={() => setRawJsonMode(prev => ({ ...prev, specs: true }))}
                            >
                                <Code size={14} /> Raw JSON
                            </button>
                        </div>

                        {rawJsonMode.specs ? (
                            <div className="admin-json-editor">
                                <p className="admin-field-hint">Base Specifications (JSON)</p>
                                <textarea
                                    rows={12}
                                    value={JSON.stringify(metal.specifications, null, 2)}
                                    onChange={e => {
                                        try { set('specifications', JSON.parse(e.target.value)); } catch { /* invalid json */ }
                                    }}
                                />
                                <p className="admin-field-hint">Per-thickness Specs (JSON)</p>
                                <textarea
                                    rows={12}
                                    value={JSON.stringify(metal.thickness_specs, null, 2)}
                                    onChange={e => {
                                        try { set('thickness_specs', JSON.parse(e.target.value)); } catch { /* invalid json */ }
                                    }}
                                />
                            </div>
                        ) : (
                            <>
                                {/* Available Services */}
                                <div className="admin-form-group">
                                    <label>Available Services (comma-separated)</label>
                                    <input
                                        type="text"
                                        value={(metal.specifications?.availableServices || []).join(', ')}
                                        onChange={e => {
                                            const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                            set('specifications', { ...metal.specifications, availableServices: arr });
                                        }}
                                        placeholder="Laser Cutting, Bending, Anodizing..."
                                    />
                                </div>

                                {/* Base Spec Sections */}
                                <h3 className="spec-group-title">Base Specifications</h3>
                                {SPEC_SECTIONS.map(section => (
                                    <SpecSectionEditor
                                        key={section.key}
                                        sectionKey={section.key}
                                        label={section.label}
                                        fields={section.fields}
                                        data={metal.specifications || {}}
                                        onChange={newSpecs => set('specifications', newSpecs)}
                                    />
                                ))}

                                {/* Per-Thickness Overrides */}
                                {thicknesses.length > 0 && (
                                    <>
                                        <h3 className="spec-group-title" style={{ marginTop: 32 }}>Per-Thickness Overrides</h3>
                                        <div className="admin-thickness-tabs">
                                            {thicknesses.map((t, i) => (
                                                <button
                                                    key={i}
                                                    className={`admin-thickness-tab-btn ${selectedThicknessIdx === i ? 'active' : ''}`}
                                                    onClick={() => setSelectedThicknessIdx(i)}
                                                >
                                                    {t.value || `Thickness ${i + 1}`}
                                                </button>
                                            ))}
                                        </div>
                                        {currentThicknessKey && (
                                            <div className="thickness-override-editor">
                                                <p className="admin-field-hint">
                                                    Override specs for thickness: <strong>{currentThicknessKey}</strong>
                                                    <br />Only add sections that differ from base specs.
                                                </p>
                                                <ShowcaseEditor
                                                    images={currentThicknessSpecs.showcaseImages}
                                                    onChange={imgs => setCurrentThicknessSpecs({ ...currentThicknessSpecs, showcaseImages: imgs })}
                                                    onZoom={setZoomedImage}
                                                    onUpload={async file => {
                                                        try {
                                                            const { data } = await uploadMetalImage(file);
                                                            return data.image_path;
                                                        } catch (err) {
                                                            toast('Upload failed: ' + err.message, 'error');
                                                            return null;
                                                        }
                                                    }}
                                                />

                                                <h4 className="spec-group-subtitle" style={{ marginTop: 20, fontSize: 13, color: '#475569' }}>Service & Property Overrides</h4>
                                                {SPEC_SECTIONS.map(section => (
                                                    <SpecSectionEditor
                                                        key={`${currentThicknessKey}-${section.key}`}
                                                        sectionKey={section.key}
                                                        label={section.label}
                                                        fields={section.fields}
                                                        data={currentThicknessSpecs}
                                                        onChange={setCurrentThicknessSpecs}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'About' && (
                    <div className="admin-structured-editor">
                        {/* ── Basic About Fields ── */}
                        <div className="admin-repeatable-section">
                            <div className="admin-section-header">
                                <h4>About Content</h4>
                            </div>
                            <div className="admin-form-grid">
                                <div className="admin-form-group full-width">
                                    <label>Title</label>
                                    <input
                                        type="text"
                                        value={metal.about_section?.title || ''}
                                        onChange={e => set('about_section', { ...(metal.about_section || {}), title: e.target.value })}
                                    />
                                </div>
                                <div className="admin-form-group full-width">
                                    <label>Text</label>
                                    <textarea
                                        rows={4}
                                        value={metal.about_section?.text || ''}
                                        onChange={e => set('about_section', { ...(metal.about_section || {}), text: e.target.value })}
                                    />
                                </div>
                                <div className="admin-form-group full-width">
                                    <label>About Image & Upload</label>
                                    <div className="admin-image-field">
                                        {metal.about_section?.image && (
                                            <div
                                                className="admin-image-field-preview"
                                                style={{ cursor: 'zoom-in' }}
                                                onClick={() => setZoomedImage({ src: metal.about_section.image, title: 'About Image Preview' })}
                                            >
                                                <img
                                                    src={metal.about_section.image}
                                                    alt="About Preview"
                                                    onError={e => { e.target.style.display = 'none'; }}
                                                />
                                            </div>
                                        )}
                                        <div className="admin-image-field-actions">
                                            <label className="admin-btn-ghost" style={{ cursor: 'pointer' }}>
                                                <Upload size={14} /> {metal.about_section?.image ? 'Change Image' : 'Upload Image'}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    onChange={async e => {
                                                        const file = e.target.files[0];
                                                        if (!file) return;
                                                        try {
                                                            const { data } = await uploadMetalImage(file);
                                                            set('about_section', { ...(metal.about_section || {}), image: data.image_path });
                                                            toast('About image uploaded successfully', 'success');
                                                        } catch (err) {
                                                            toast('Upload failed: ' + err.message, 'error');
                                                        }
                                                    }}
                                                />
                                            </label>
                                            <input
                                                type="text"
                                                value={metal.about_section?.image || ''}
                                                onChange={e => set('about_section', { ...(metal.about_section || {}), image: e.target.value })}
                                                placeholder="/uploads/metals/about-metal-1.jpg"
                                                style={{ flex: 1, fontSize: 12 }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Feature Chart ── */}
                        <div className="admin-repeatable-section">
                            <div className="admin-section-header">
                                <h4>Feature Chart</h4>
                                <button className="admin-btn-ghost" onClick={() => {
                                    const chart = metal.about_section?.featureChart || [];
                                    set('about_section', { ...(metal.about_section || {}), featureChart: [...chart, { label: '', rating: 3 }] });
                                }}>
                                    <Plus size={14} /> Add Feature
                                </button>
                            </div>
                            {(metal.about_section?.featureChart || []).map((feat, i) => (
                                <div key={i} className="spec-row" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <input
                                        className="spec-row-input"
                                        placeholder="Feature label"
                                        value={feat.label}
                                        onChange={e => {
                                            const chart = [...(metal.about_section?.featureChart || [])];
                                            chart[i] = { ...chart[i], label: e.target.value };
                                            set('about_section', { ...(metal.about_section || {}), featureChart: chart });
                                        }}
                                    />
                                    <select
                                        className="spec-row-input"
                                        value={feat.rating}
                                        style={{ maxWidth: 80 }}
                                        onChange={e => {
                                            const chart = [...(metal.about_section?.featureChart || [])];
                                            chart[i] = { ...chart[i], rating: Number(e.target.value) };
                                            set('about_section', { ...(metal.about_section || {}), featureChart: chart });
                                        }}
                                    >
                                        {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v} / 5</option>)}
                                    </select>
                                    <button className="admin-icon-btn danger" onClick={() => {
                                        const chart = [...(metal.about_section?.featureChart || [])];
                                        chart.splice(i, 1);
                                        set('about_section', { ...(metal.about_section || {}), featureChart: chart });
                                    }}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* ── Capabilities ── */}
                        <div className="admin-repeatable-section">
                            <div className="admin-section-header">
                                <h4>Capabilities</h4>
                            </div>
                            <div className="admin-form-grid">
                                <div className="admin-form-group full-width">
                                    <label>Capabilities Title</label>
                                    <input
                                        type="text"
                                        value={metal.about_section?.capabilities?.title || ''}
                                        onChange={e => set('about_section', {
                                            ...(metal.about_section || {}),
                                            capabilities: { ...(metal.about_section?.capabilities || {}), title: e.target.value }
                                        })}
                                    />
                                </div>
                                <div className="admin-form-group full-width">
                                    <label>Capabilities Text</label>
                                    <textarea
                                        rows={3}
                                        value={metal.about_section?.capabilities?.text || ''}
                                        onChange={e => set('about_section', {
                                            ...(metal.about_section || {}),
                                            capabilities: { ...(metal.about_section?.capabilities || {}), text: e.target.value }
                                        })}
                                    />
                                </div>
                            </div>
                            <div className="admin-section-header" style={{ marginTop: 12 }}>
                                <h4>Capability Items</h4>
                                <button className="admin-btn-ghost" onClick={() => {
                                    const items = metal.about_section?.capabilities?.items || [];
                                    set('about_section', {
                                        ...(metal.about_section || {}),
                                        capabilities: { ...(metal.about_section?.capabilities || {}), items: [...items, ''] }
                                    });
                                }}>
                                    <Plus size={14} /> Add Item
                                </button>
                            </div>
                            {(metal.about_section?.capabilities?.items || []).map((item, i) => (
                                <div key={i} className="spec-row" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <input
                                        className="spec-row-input"
                                        value={item}
                                        onChange={e => {
                                            const items = [...(metal.about_section?.capabilities?.items || [])];
                                            items[i] = e.target.value;
                                            set('about_section', {
                                                ...(metal.about_section || {}),
                                                capabilities: { ...(metal.about_section?.capabilities || {}), items }
                                            });
                                        }}
                                    />
                                    <button className="admin-icon-btn danger" onClick={() => {
                                        const items = [...(metal.about_section?.capabilities?.items || [])];
                                        items.splice(i, 1);
                                        set('about_section', {
                                            ...(metal.about_section || {}),
                                            capabilities: { ...(metal.about_section?.capabilities || {}), items }
                                        });
                                    }}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Raw JSON fallback */}
                        <button className="admin-btn-ghost raw-json-toggle" onClick={() => toggleRawJson('about')}>
                            <Code size={14} /> {rawJsonMode.about ? 'Hide' : 'Show'} Raw JSON
                        </button>
                        {rawJsonMode.about && (
                            <textarea
                                className="admin-raw-json"
                                rows={10}
                                value={JSON.stringify(metal.about_section, null, 2)}
                                onChange={e => {
                                    try { set('about_section', JSON.parse(e.target.value)); } catch { /* invalid json */ }
                                }}
                            />
                        )}
                    </div>
                )}

                {activeTab === 'Services' && (
                    <div className="admin-structured-editor">
                        {/* ── Metal-level Services ── */}
                        <div className="admin-repeatable-section">
                            <div className="admin-section-header">
                                <h4>Metal-level Services</h4>
                            </div>
                            <p className="admin-field-hint" style={{ margin: '0 0 10px' }}>
                                Services available for this metal across all thicknesses.
                            </p>
                            <div className="admin-services-grid">
                                {allServices.map(svc => {
                                    const checked = (metal.services || []).some(id => Number(id) === Number(svc.id));
                                    return (
                                        <label key={svc.id} className={`admin-service-checkbox ${checked ? 'checked' : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => {
                                                    const arr = metal.services || [];
                                                    set('services', checked
                                                        ? arr.filter(id => Number(id) !== Number(svc.id))
                                                        : [...arr, svc.id]
                                                    );
                                                }}
                                            />
                                            <span>{svc.title}</span>
                                        </label>
                                    );
                                })}
                                {allServices.length === 0 && (
                                    <p className="admin-empty-hint">No services found. Create services first.</p>
                                )}
                            </div>
                        </div>

                        {/* ── Per-Thickness Services ── */}
                        {thicknesses.length > 0 && (
                            <div className="admin-repeatable-section">
                                <div className="admin-section-header">
                                    <h4>Per-Thickness Services</h4>
                                </div>
                                <p className="admin-field-hint" style={{ margin: '0 0 10px' }}>
                                    Override available services for each thickness. Leave empty to inherit metal-level services.
                                </p>
                                <div className="admin-thickness-tabs">
                                    {thicknesses.map((t, i) => (
                                        <button
                                            key={i}
                                            className={`admin-thickness-tab-btn ${selectedServicesThicknessIdx === i ? 'active' : ''}`}
                                            onClick={() => setSelectedServicesThicknessIdx(i)}
                                        >
                                            {t.value || `Thickness ${i + 1}`}
                                        </button>
                                    ))}
                                </div>
                                {(() => {
                                    const t = thicknesses[selectedServicesThicknessIdx];
                                    if (!t) return null;
                                    const thicknessServices = t.services || [];
                                    return (
                                        <div className="admin-services-grid">
                                            {allServices.map(svc => {
                                                const checked = thicknessServices.some(id => Number(id) === Number(svc.id));
                                                return (
                                                    <label key={svc.id} className={`admin-service-checkbox ${checked ? 'checked' : ''}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => {
                                                                const newServices = checked
                                                                    ? thicknessServices.filter(id => Number(id) !== Number(svc.id))
                                                                    : [...thicknessServices, svc.id];
                                                                updateThickness(selectedServicesThicknessIdx, 'services', newServices);
                                                            }}
                                                        />
                                                        <span>{svc.title}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Raw JSON fallback */}
                        <button className="admin-btn-ghost raw-json-toggle" onClick={() => toggleRawJson('services')}>
                            <Code size={14} /> {rawJsonMode.services ? 'Hide' : 'Show'} Raw JSON
                        </button>
                        {rawJsonMode.services && (
                            <textarea
                                className="admin-raw-json"
                                rows={4}
                                value={JSON.stringify(metal.services, null, 2)}
                                onChange={e => {
                                    try { set('services', JSON.parse(e.target.value)); } catch { /* invalid json */ }
                                }}
                            />
                        )}
                    </div>
                )}

                {activeTab === 'FAQs' && (
                    <div className="admin-faqs-editor">
                        {metal.faqs.map((faq, i) => (
                            <div key={i} className="admin-faq-row">
                                <div className="admin-form-group full-width">
                                    <label>Question {i + 1}</label>
                                    <input
                                        type="text"
                                        value={faq.question}
                                        onChange={e => updateFaq(i, 'question', e.target.value)}
                                    />
                                </div>
                                <div className="admin-form-group full-width">
                                    <label>Answer</label>
                                    <textarea
                                        rows={3}
                                        value={faq.answer}
                                        onChange={e => updateFaq(i, 'answer', e.target.value)}
                                    />
                                </div>
                                <button className="admin-icon-btn danger" onClick={() => removeFaq(i)}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        <button className="admin-btn-ghost" onClick={addFaq}>
                            <Plus size={16} /> Add FAQ
                        </button>
                    </div>
                )}
            </div>

            {/* Custom Fields */}
            <div className="admin-custom-fields">
                <div className="admin-section-header">
                    <h3>Custom Fields</h3>
                    <button className="admin-btn-ghost" onClick={addCustomField}>
                        <Plus size={16} /> Add Custom Field
                    </button>
                </div>
                {Object.entries(metal.custom_fields).map(([key, field]) => (
                    <div key={key} className="admin-custom-field-row">
                        <input
                            type="text"
                            placeholder="Label"
                            value={field.label}
                            onChange={e => updateCustomField(key, 'label', e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder="Value"
                            value={field.value}
                            onChange={e => updateCustomField(key, 'value', e.target.value)}
                        />
                        <select
                            value={field.tab}
                            onChange={e => updateCustomField(key, 'tab', e.target.value)}
                        >
                            {TABS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button className="admin-icon-btn danger" onClick={() => removeCustomField(key)}>
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
                {Object.keys(metal.custom_fields).length === 0 && (
                    <p className="admin-empty-hint">No custom fields yet.</p>
                )}
            </div>

            <ImageModal
                src={zoomedImage?.src}
                alt={zoomedImage?.title}
                onClose={() => setZoomedImage(null)}
            />
        </div>
    );
}
