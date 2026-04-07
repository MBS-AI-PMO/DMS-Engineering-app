import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { Calculator, Info, ArrowRight } from 'lucide-react';

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
    const [calc, setCalc] = useState({ width: '', length: '', cost: '', markup: '' });
    const [unit, setUnit] = useState('inch');

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
            </motion.div>
        </div>
    );
}

