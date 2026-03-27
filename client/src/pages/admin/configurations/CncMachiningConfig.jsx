import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wrench, ArrowLeft, Save, Check } from 'lucide-react';
import { fetchCncConfig, saveCncConfig } from '../../../utils/api';
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

function SizingRow({ label, minKey, maxKey, values, onChange, unit }) {
    return (
        <div className="config-sizing-row">
            <span className="config-axis-label">{label}</span>
            <div className="config-sizing-pair">
                <div className="config-sizing-field">
                    <label>Min</label>
                    <div className="config-sizing-input-wrap">
                        <input
                            type="number"
                            min="0"
                            step={unit === 'inch' ? '0.001' : '0.1'}
                            value={toDisplay(values[minKey], unit)}
                            onChange={e => onChange(minKey, toMm(e.target.value, unit))}
                            placeholder="0"
                        />
                        <span className="config-unit">{unit}</span>
                    </div>
                </div>
                <div className="config-sizing-sep">—</div>
                <div className="config-sizing-field">
                    <label>Max</label>
                    <div className="config-sizing-input-wrap">
                        <input
                            type="number"
                            min="0"
                            step={unit === 'inch' ? '0.001' : '0.1'}
                            value={toDisplay(values[maxKey], unit)}
                            onChange={e => onChange(maxKey, toMm(e.target.value, unit))}
                            placeholder="∞"
                        />
                        <span className="config-unit">{unit}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function CncMachiningConfig() {
    const navigate = useNavigate();
    const toast = useToast();

    const [config, setConfig] = useState({ min_x: '', max_x: '', min_y: '', max_y: '', min_z: '', max_z: '' });
    const [metals, setMetals] = useState([]);
    const [assignedIds, setAssignedIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [unit, setUnit] = useState('mm');

    useEffect(() => {
        fetchCncConfig()
            .then(data => {
                const c = data.config || {};
                setConfig({
                    min_x: c.min_x ?? '', max_x: c.max_x ?? '',
                    min_y: c.min_y ?? '', max_y: c.max_y ?? '',
                    min_z: c.min_z ?? '', max_z: c.max_z ?? '',
                });
                setMetals(data.metals || []);
                setAssignedIds(new Set((data.metals || []).filter(m => m.assigned).map(m => m.id)));
            })
            .catch(() => toast('Failed to load CNC config', 'error'))
            .finally(() => setLoading(false));
    }, []);

    const handleSizing = (key, val) => setConfig(c => ({ ...c, [key]: val }));

    const toggleMetal = (id) => {
        setAssignedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveCncConfig({
                ...config,
                metal_ids: Array.from(assignedIds),
            });
            toast('CNC Machining configuration saved', 'success');
        } catch (err) {
            toast(err.message || 'Failed to save', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="admin-loading-inline"><div className="admin-loading-spinner" /><span>Loading…</span></div>;

    return (
        <div className="admin-list-page">
            <header className="admin-page-header">
                <div className="config-page-header-left">
                    <button className="config-back-btn" onClick={() => navigate('/admin/configurations')}>
                        <ArrowLeft size={16} />
                    </button>
                    <div className="config-page-title-icon" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                        <Wrench size={20} />
                    </div>
                    <div>
                        <h1 className="admin-page-title">CNC Machining</h1>
                        <p className="admin-page-subtitle">Global sizing limits and assigned metals</p>
                    </div>
                </div>
                <button className="config-save-btn" onClick={handleSave} disabled={saving}>
                    {saving ? <span className="config-btn-spinner" /> : <Save size={16} />}
                    Save Configuration
                </button>
            </header>

            <div className="config-sections-grid">
                {/* Sizing */}
                <motion.div className="config-section-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                    <div className="config-section-header">
                        <div className="config-section-header-row">
                            <div>
                                <h2>Sizing Limits</h2>
                                <p>Define the minimum and maximum workpiece dimensions for CNC Machining.</p>
                            </div>
                            <UnitToggle unit={unit} onChange={setUnit} />
                        </div>
                    </div>
                    <div className="config-sizing-grid">
                        <SizingRow label="X" minKey="min_x" maxKey="max_x" values={config} onChange={handleSizing} unit={unit} />
                        <SizingRow label="Y" minKey="min_y" maxKey="max_y" values={config} onChange={handleSizing} unit={unit} />
                        <SizingRow label="Z" minKey="min_z" maxKey="max_z" values={config} onChange={handleSizing} unit={unit} />
                    </div>
                </motion.div>

                {/* Metal assignment */}
                <motion.div className="config-section-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <div className="config-section-header">
                        <h2>Available Metals</h2>
                        <p>Select which metals can be processed via CNC Machining.</p>
                        <span className="config-assigned-count">{assignedIds.size} of {metals.length} selected</span>
                    </div>
                    <div className="config-metal-toggle-list">
                        {metals.map(metal => (
                            <button
                                key={metal.id}
                                className={`config-metal-toggle-item ${assignedIds.has(metal.id) ? 'selected' : ''}`}
                                onClick={() => toggleMetal(metal.id)}
                            >
                                <div className="config-metal-toggle-check">
                                    {assignedIds.has(metal.id) && <Check size={12} />}
                                </div>
                                <span className="config-metal-toggle-name">{metal.name}</span>
                            </button>
                        ))}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
