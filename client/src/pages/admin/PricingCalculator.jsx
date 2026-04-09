import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { Calculator, Info, ArrowRight, Save, Hash, Loader2 } from 'lucide-react';
import { fetchSettings, updateSetting } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

const UNITS = [
    { label: 'Inch', value: 'inch', sign: 'in' },
    { label: 'MM', value: 'mm', sign: 'mm' },
    { label: 'Feet', value: 'feet', sign: 'ft' },
];

const FIELDS = [
    { key: 'width', label: 'Width' },
    { key: 'length', label: 'Length' },
    { key: 'cost', label: 'Sheet Cost', unit: '$' },
    { key: 'markup', label: 'Markup', unit: '%' },
];

const ROWS = [
    { label: 'Per sq %U%', rawKey: 'perSqIn', muKey: 'perSqInMu', dec: 4 },
    { label: 'Per %U% of width', rawKey: 'perInWidth', muKey: 'perInWidthMu', dec: 4 },
    { label: 'Per %U% of length', rawKey: 'perInLength', muKey: 'perInLengthMu', dec: 4 },
    { label: 'Total Cost', rawKey: 'total', muKey: 'totalMu', dec: 2 },
];

export default function PricingCalculator() {
    const toast = useToast();
    const [calc, setCalc] = useState({ width: '', length: '', cost: '', markup: '' });
    const [unit, setUnit] = useState('inch');
    const [globalMarkup, setGlobalMarkup] = useState(10);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [saving, setSaving] = useState(false);

    // Fetch global markup on mount
    useEffect(() => {
        fetchSettings()
            .then(data => {
                if (data.general_markup !== undefined) {
                    setGlobalMarkup(data.general_markup);
                    // Initialize calculator markup with global markup if not already set
                    setCalc(prev => ({ ...prev, markup: prev.markup || data.general_markup.toString() }));
                }
            })
            .catch(err => toast('Failed to load global markup: ' + err.message, 'error'))
            .finally(() => setLoadingSettings(false));
    }, [toast]);

    const handleSaveGlobalMarkup = async () => {
        setSaving(true);
        try {
            await updateSetting('general_markup', globalMarkup);
            toast('Global markup saved successfully', 'success');
        } catch (err) {
            toast('Failed to save: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    // Unit conversion factors relative to Inch
    const factors = { inch: 1, mm: 25.4, feet: 1 / 12 };

    const handleUnitChange = (newUnit) => {
        if (newUnit === unit) return;
        const fromFactor = factors[unit];
        const toFactor = factors[newUnit];
        const ratio = toFactor / fromFactor;

        setCalc(prev => ({
            ...prev,
            width: prev.width ? (parseFloat(prev.width) * ratio).toFixed(3) : '',
            length: prev.length ? (parseFloat(prev.length) * ratio).toFixed(3) : '',
        }));
        setUnit(newUnit);
    };

    const results = useMemo(() => {
        const w = parseFloat(calc.width), l = parseFloat(calc.length);
        const c = parseFloat(calc.cost);
        const m = parseFloat(calc.markup) || 0;
        if (!w || !l || !c || w <= 0 || l <= 0 || c <= 0) return null;

        const area = w * l, mul = 1 + m / 100;
        return {
            perSqIn: c / area, perSqInMu: (c / area) * mul,
            perInWidth: c / w, perInWidthMu: (c / w) * mul,
            perInLength: c / l, perInLengthMu: (c / l) * mul,
            total: c, totalMu: c * mul,
        };
    }, [calc]);

    const currentUnit = UNITS.find(u => u.value === unit);

    return (
        <div className="admin-page">
            <header className="admin-page-header">
                <div>
                    <h1 className="admin-page-title">Pricing Calculator</h1>
                    <p className="admin-page-subtitle">Calculate material costs and markups in real-time</p>
                </div>
            </header>

            <motion.div
                className="price-calc-wrapper"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="price-calc-card premium">
                    {/* Unit Toggle Section */}
                    <div className="price-calc-unit-header">
                        <label className="price-calc-header-label">
                            <Calculator size={16} /> Measurement Unit
                        </label>
                        <div className="unit-segmented-control">
                            {UNITS.map((u) => (
                                <button
                                    key={u.value}
                                    className={`unit-btn ${unit === u.value ? 'active' : ''}`}
                                    onClick={() => handleUnitChange(u.value)}
                                >
                                    {unit === u.value && (
                                        <motion.div
                                            layoutId="unit-pill"
                                            className="unit-pill-bg"
                                            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                                        />
                                    )}
                                    <span className="unit-label">{u.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Inputs Grid */}
                    <div className="price-calc-inputs-grid">
                        {FIELDS.map(({ key, label, unit: fieldUnit }) => (
                            <div className="price-calc-field-v2" key={key}>
                                <label>{label}</label>
                                <div className="price-calc-input-group">
                                    <span className="addon">{fieldUnit || currentUnit.sign}</span>
                                    <input
                                        type="number" min="0" step="any"
                                        placeholder="0.00"
                                        value={calc[key]}
                                        onChange={e => setCalc(p => ({ ...p, [key]: e.target.value }))}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Results Section */}
                    <AnimatePresence mode="wait">
                        {results ? (
                            <motion.div
                                key="results"
                                className="price-calc-results-v2"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                <div className="results-header">
                                    <div className="results-title">Calculated Unit Costs</div>
                                    <div className="results-legend">
                                        <div className="legend-item"><div className="dot" /> Base Price</div>
                                        <div className="legend-item"><div className="dot mu" /> Final Price</div>
                                    </div>
                                </div>

                                <div className="results-table-v2">
                                    <div className="thead-v2">
                                        <div className="th">Metric</div>
                                        <div className="th">Base Cost</div>
                                        <div className="th text-right">With Markup ({calc.markup || 0}%)</div>
                                    </div>
                                    <div className="tbody-v2">
                                        {ROWS.map(({ label, rawKey, muKey, dec }) => (
                                            <motion.div
                                                className="tr-v2"
                                                key={label}
                                                layout
                                            >
                                                <div className="td label-cell">
                                                    {label.replace(/%U%/g, currentUnit.value)}
                                                </div>
                                                <div className="td value-cell">
                                                    <span className="currency">$</span>
                                                    {results[rawKey].toFixed(dec)}
                                                </div>
                                                <div className="td value-cell mu-cell text-right">
                                                    <ArrowRight size={14} className="arrow-icon" />
                                                    <span className="currency">$</span>
                                                    {results[muKey].toFixed(dec)}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                                <div className="results-footer">
                                    <Info size={14} /> Values calculated based on {currentUnit.label} measurements.
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="empty"
                                className="price-calc-empty-v2"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                            >
                                <div className="empty-icon shadow">?</div>
                                <p>Enter dimensions and costs to reveal pricing metrics.</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Global Pricing Settings Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="price-calc-card premium"
                    style={{ marginTop: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', padding: 0 }}
                >
                    <div className="calc-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', background: '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ padding: '8px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '10px' }}>
                                <Save size={20} style={{ color: '#6366f1', display: 'block' }} />
                            </div>
                            <h2 className="calc-card-title" style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: 0 }}>Global Pricing Settings</h2>
                        </div>
                        <button
                            onClick={handleSaveGlobalMarkup}
                            className="calc-save-btn"
                            disabled={saving}
                            style={{
                                padding: '10px 20px',
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)',
                                transition: 'all 0.2s ease',
                                opacity: saving ? 0.7 : 1
                            }}
                        >
                            {saving ? <Loader2 size={18} className="spin" /> : <Save size={18} />}
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>

                    <div className="calc-card-body" style={{ padding: '24px', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ maxWidth: '400px' }}>
                            <div className="calc-input-group">
                                <label className="calc-input-label" style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>
                                    General Markup (%)
                                </label>
                                {loadingSettings ? (
                                    <div className="skeleton-box" style={{ width: '100%', height: '48px', borderRadius: '12px' }} />
                                ) : (
                                    <div className="input-with-unit" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="number"
                                            className="calc-input-field"
                                            value={globalMarkup}
                                            onChange={(e) => setGlobalMarkup(parseFloat(e.target.value) || 0)}
                                            placeholder="10"
                                            style={{
                                                width: '100%',
                                                padding: '12px 16px',
                                                paddingRight: '45px',
                                                fontSize: '16px',
                                                fontWeight: '500',
                                                color: '#1e293b',
                                                background: '#fff',
                                                border: '2px solid #e2e8f0',
                                                borderRadius: '12px',
                                                outline: 'none',
                                                transition: 'all 0.2s ease'
                                            }}
                                        />
                                        <span style={{
                                            position: 'absolute',
                                            right: '16px',
                                            fontSize: '16px',
                                            fontWeight: '600',
                                            color: '#94a3b8'
                                        }}>%</span>
                                    </div>
                                )}
                                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '10px', lineHeight: '1.5', display: 'flex', alignItems: 'start', gap: '6px' }}>
                                    <Info size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                                    This is the default profit margin multiplier applied to all instant pricing calculations across the platform.
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </div>
    );
}

