import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, ArrowLeft, Save, ChevronDown, ChevronUp, Check, Zap } from 'lucide-react';
import { fetchMetalConfigs, saveMetalConfig } from '../../../utils/api';
import { useToast } from '../../../context/ToastContext';

const MM_PER_INCH = 25.4;
const toDisplay = (mmVal, unit) => {
    if (mmVal === '' || mmVal === null || mmVal === undefined) return '';
    const n = parseFloat(mmVal);
    if (isNaN(n)) return '';
    return unit === 'inch' ? parseFloat((n / MM_PER_INCH).toFixed(5)) : n;
};
const toMm = (displayVal, unit) => {
    if (displayVal === '' || displayVal === null || displayVal === undefined) return '';
    const n = parseFloat(displayVal);
    if (isNaN(n)) return '';
    return unit === 'inch' ? n * MM_PER_INCH : n;
};

function UnitToggle({ unit, onChange }) {
    return (
        <div className="config-unit-toggle">
            <button className={unit === 'mm' ? 'active' : ''} onClick={() => onChange('mm')}>mm</button>
            <button className={unit === 'inch' ? 'active' : ''} onClick={() => onChange('inch')}>inch</button>
        </div>
    );
}

// Thickness handles are now checkbox-based, so ThicknessTagInput is removed.

function MetalRow({ metal, onSave, unit }) {
    const toast = useToast();
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        min_x: metal.min_x ?? '',
        max_x: metal.max_x ?? '',
        min_y: metal.min_y ?? '',
        max_y: metal.max_y ?? '',
        available_thicknesses: Array.isArray(metal.available_thicknesses) ? metal.available_thicknesses : [],
    });

    const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

    const handleSave = async () => {
        setSaving(true);
        try {
            const result = await saveMetalConfig(metal.id, form);
            toast(`${metal.name} config saved`, 'success');
            onSave(metal.id, result);
            setOpen(false);
        } catch (err) {
            toast(err.message || 'Failed to save', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Parse thickness list: metric field gives mm value, value field gives inch label
    const allPotentialThicknesses = (metal.quick_look?.thicknesses || [])
        .map(t => ({
            mmVal: parseFloat(t.metric),   // "3.18mm" → 3.18
            inchLabel: t.value,            // ".125\""
        }))
        .filter(t => !isNaN(t.mmVal) && t.mmVal > 0);

    const toggleThickness = (mmVal) => {
        setForm(prev => {
            const current = prev.available_thicknesses;
            const exists = current.some(t => Math.abs(t - mmVal) < 0.0001);
            const next = exists
                ? current.filter(t => Math.abs(t - mmVal) >= 0.0001)
                : [...current, mmVal].sort((a, b) => a - b);
            return { ...prev, available_thicknesses: next };
        });
    };

    return (
        <div className="config-metal-config-row">
            <button className="config-metal-config-header" onClick={() => setOpen(o => !o)}>
                <div className="config-metal-config-left">
                    <div className={`config-sheet-dot ${metal.is_sheet_cuttable ? 'active' : ''}`} title={metal.is_sheet_cuttable ? 'Sheet cuttable' : 'Not sheet cuttable'} />
                    <span className="config-metal-config-name">{metal.name}</span>
                    {form.available_thicknesses.length > 0 && (
                        <span className="config-thickness-count">{form.available_thicknesses.length} thickness{form.available_thicknesses.length !== 1 ? 'es' : ''}</span>
                    )}
                    {metal.is_sheet_cuttable && <span className="config-auto-badge">sheet cuttable</span>}
                </div>
                {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        className="config-metal-config-body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="config-metal-fields-grid">
                            {/* Sizing */}
                            <div className="config-metal-sizing-group">
                                <h4 className="config-metal-group-title">Sizing ({unit})</h4>
                                {[
                                    ['X', 'Width', 'min_x', 'max_x'],
                                    ['Y', 'Length', 'min_y', 'max_y'],
                                ].map(([axis, label, minK, maxK]) => (
                                    <div key={axis} className="config-metal-sizing-item">
                                        <div className="config-axis-info">
                                            <span className="config-axis-letter">{axis}</span>
                                            <span className="config-axis-text">{label}</span>
                                        </div>
                                        <div className="config-sizing-input-group">
                                            <div className="config-input-with-label">
                                                <small>Min</small>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step={unit === 'inch' ? '0.001' : '0.1'}
                                                    value={toDisplay(form[minK], unit)}
                                                    onChange={e => f(minK, toMm(e.target.value, unit))}
                                                    placeholder="0.000"
                                                />
                                            </div>
                                            <span className="config-sizing-range-sep">to</span>
                                            <div className="config-input-with-label">
                                                <small>Max</small>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step={unit === 'inch' ? '0.001' : '0.1'}
                                                    value={toDisplay(form[maxK], unit)}
                                                    onChange={e => f(maxK, toMm(e.target.value, unit))}
                                                    placeholder="0.000"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Thicknesses */}
                            <div className="config-metal-thickness-group">
                                <h4 className="config-metal-group-title">Available Thicknesses</h4>
                                <p className="config-metal-group-hint">Select the thicknesses that should be available for this metal.</p>

                                <div className="config-thickness-checkbox-grid">
                                    {allPotentialThicknesses.map(t => {
                                        const isSelected = form.available_thicknesses.some(v => Math.abs(v - t.mmVal) < 0.0001);
                                        return (
                                            <button
                                                key={t.mmVal}
                                                className={`config-thickness-checkbox-item ${isSelected ? 'selected' : ''}`}
                                                onClick={() => toggleThickness(t.mmVal)}
                                            >
                                                <div className="config-thickness-checkbox-check">
                                                    {isSelected && <Check size={10} />}
                                                </div>
                                                <span className="config-thickness-checkbox-label">
                                                    {unit === 'inch' ? t.inchLabel : `${t.mmVal} mm`}
                                                </span>
                                            </button>
                                        );
                                    })}
                                    {allPotentialThicknesses.length === 0 && (
                                        <p className="config-no-thicknesses">No thickness data found for this metal.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="config-metal-config-footer">
                            <button className="config-metal-cancel-btn" onClick={() => setOpen(false)}>Cancel</button>
                            <button className="config-metal-save-btn" onClick={handleSave} disabled={saving}>
                                {saving ? <span className="config-btn-spinner" /> : <Save size={14} />}
                                Save
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function MetalsConfig() {
    const navigate = useNavigate();
    const toast = useToast();
    const [metals, setMetals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [unit, setUnit] = useState('mm');

    useEffect(() => {
        fetchMetalConfigs()
            .then(data => setMetals(data || []))
            .catch(() => toast('Failed to load metal configs', 'error'))
            .finally(() => setLoading(false));
    }, [toast]);

    const handleMetalSave = (id, updated) => {
        setMetals(prev => prev.map(m => m.id === id ? { ...m, ...updated } : m));
    };

    const filtered = metals.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
    const configured = metals.filter(m => m.config_id).length;
    const sheetCuttable = metals.filter(m => m.is_sheet_cuttable).length;

    if (loading) return <div className="admin-loading-inline"><div className="admin-loading-spinner" /><span>Loading…</span></div>;

    return (
        <div className="admin-list-page">
            <header className="admin-page-header">
                <div className="config-page-header-left">
                    <button className="config-back-btn" onClick={() => navigate('/admin/configurations')}>
                        <ArrowLeft size={16} />
                    </button>
                    <div className="config-page-title-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                        <Layers size={20} />
                    </div>
                    <div>
                        <h1 className="admin-page-title">Metal Sizing & Thicknesses</h1>
                        <p className="admin-page-subtitle">Configure per-metal sizing limits and available thicknesses</p>
                    </div>
                </div>
                <UnitToggle unit={unit} onChange={setUnit} />
            </header>

            {/* Stats */}
            <div className="config-metals-stats">
                <div className="config-metals-stat">
                    <strong>{metals.length}</strong><span>Total Metals</span>
                </div>
                <div className="config-metals-stat">
                    <strong>{configured}</strong><span>Configured</span>
                </div>
                <div className="config-metals-stat configured">
                    <Zap size={13} />
                    <strong>{sheetCuttable}</strong><span>Sheet Cuttable</span>
                </div>
            </div>

            {/* Search */}
            <div className="customers-search-bar" style={{ marginBottom: '12px' }}>
                <input
                    type="text"
                    placeholder="Search metals…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ paddingLeft: '12px' }}
                />
            </div>

            <div className="config-metals-list">
                {filtered.map((metal, i) => (
                    <motion.div
                        key={metal.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.015 }}
                    >
                        <MetalRow metal={metal} onSave={handleMetalSave} unit={unit} />
                    </motion.div>
                ))}
                {filtered.length === 0 && (
                    <div className="admin-empty-state"><Layers size={36} /><p>No metals match your search.</p></div>
                )}
            </div>
        </div>
    );
}
