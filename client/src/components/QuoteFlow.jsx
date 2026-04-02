import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import { fetchCategories, fetchMetals } from '../utils/api';

const STEPS = ['Category', 'Metal', 'Thickness'];

/**
 * QuoteFlow — multi-step guided modal
 * Props:
 *   isOpen        {boolean}
 *   onClose       {function}
 *   modelDimensions  {object|null}  { width, height, depth } in inches — from uploaded STEP/DXF
 */
export default function QuoteFlow({ isOpen, onClose, modelDimensions = null }) {
    const [step, setStep] = useState(0);
    const [categories, setCategories] = useState([]);
    const [metals, setMetals] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedMetal, setSelectedMetal] = useState(null);
    const [selectedThickness, setSelectedThickness] = useState(null);
    const [loading, setLoading] = useState(false);

    // Fetch categories on open
    useEffect(() => {
        if (!isOpen) return;
        setStep(0);
        setSelectedCategory(null);
        setSelectedMetal(null);
        setSelectedThickness(null);
        fetchCategories().then(setCategories).catch(console.error);
    }, [isOpen]);

    // Fetch metals when category chosen
    useEffect(() => {
        if (!selectedCategory) return;
        setLoading(true);
        fetchMetals(selectedCategory.name)
            .then(setMetals)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [selectedCategory]);

    const isThicknessAvailable = (thickness) => {
        if (!modelDimensions || !thickness.maxPartSize) return true;
        const { width, height } = modelDimensions;
        const [maxW, maxH] = thickness.maxPartSize.split('x').map(s => parseFloat(s));
        return width <= maxW && height <= maxH;
    };

    const handleSelectCategory = (cat) => {
        setSelectedCategory(cat);
        setStep(1);
    };

    const handleSelectMetal = (metal) => {
        setSelectedMetal(metal);
        setStep(2);
    };

    const handleSelectThickness = (thickness) => {
        if (!isThicknessAvailable(thickness)) return;
        setSelectedThickness(thickness);
    };

    const handleFinish = () => {
        onClose({ category: selectedCategory, metal: selectedMetal, thickness: selectedThickness });
    };

    const thicknesses = selectedMetal?.quick_look?.thicknesses || selectedMetal?.quickLook?.thicknesses || [];

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="quote-flow-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => onClose(null)}
                >
                    <motion.div
                        className="quote-flow-modal"
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="quote-flow-header">
                            <div className="quote-flow-steps">
                                {STEPS.map((s, i) => (
                                    <div key={s} className={`qf-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
                                        <span className="qf-step-num">{i < step ? '✓' : i + 1}</span>
                                        <span className="qf-step-label">{s}</span>
                                        {i < STEPS.length - 1 && <ChevronRight size={14} className="qf-step-sep" />}
                                    </div>
                                ))}
                            </div>
                            <button className="admin-icon-btn" onClick={() => onClose(null)}>
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="quote-flow-body">
                            <AnimatePresence mode="wait">
                                {step === 0 && (
                                    <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                        <h2 className="qf-title">Select Material Category</h2>
                                        <div className="qf-grid">
                                            {categories.map(cat => (
                                                <button
                                                    key={cat.id}
                                                    className="qf-option-card"
                                                    onClick={() => handleSelectCategory(cat)}
                                                >
                                                    <span className="qf-option-name">{cat.name}</span>
                                                    <ChevronRight size={16} />
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

                                {step === 1 && (
                                    <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                        <h2 className="qf-title">Select Metal</h2>
                                        <p className="qf-subtitle">{selectedCategory?.name}</p>
                                        {loading ? (
                                            <div className="qf-loading">Loading metals…</div>
                                        ) : (
                                            <div className="qf-grid">
                                                {metals.map(m => (
                                                    <button
                                                        key={m.id}
                                                        className="qf-option-card"
                                                        onClick={() => handleSelectMetal(m)}
                                                    >
                                                        {m.image_path && <img src={m.image_path} alt="" className="qf-thumb" loading="lazy" decoding="async" />}
                                                        <span className="qf-option-name">{m.name}</span>
                                                        <ChevronRight size={16} />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {step === 2 && (
                                    <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                        <h2 className="qf-title">Select Thickness</h2>
                                        <p className="qf-subtitle">{selectedMetal?.name}</p>
                                        <div className="qf-thickness-list">
                                            {thicknesses.map((t, i) => {
                                                const available = isThicknessAvailable(t);
                                                return (
                                                    <button
                                                        key={i}
                                                        className={`qf-thickness-option ${!available ? 'unavailable' : ''} ${selectedThickness === t ? 'selected' : ''}`}
                                                        onClick={() => handleSelectThickness(t)}
                                                        disabled={!available}
                                                        title={!available && modelDimensions
                                                            ? `Part size ${modelDimensions.width}" × ${modelDimensions.height}" exceeds max ${t.maxPartSize}`
                                                            : undefined}
                                                    >
                                                        <span className="qf-thickness-val">{t.value}</span>
                                                        <span className="qf-thickness-metric">{t.metric}</span>
                                                        {!available && (
                                                            <span className="qf-unavail-badge">
                                                                <AlertTriangle size={14} /> Size limit
                                                            </span>
                                                        )}
                                                        {available && selectedThickness === t && (
                                                            <CheckCircle size={16} className="qf-check" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Footer */}
                        <div className="quote-flow-footer">
                            {step > 0 && (
                                <button className="admin-btn-secondary" onClick={() => setStep(s => s - 1)}>
                                    <ChevronLeft size={16} /> Back
                                </button>
                            )}
                            {step === 2 && selectedThickness && (
                                <button className="admin-btn-primary" onClick={handleFinish}>
                                    Get Quote <ChevronRight size={16} />
                                </button>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}