import React, { useState } from 'react';
import { X, Check, Plus, Info, Zap } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

/**
 * VolumeDiscountModal - A fresh, stable rebuild for managing pricing tiers.
 * Replaces the previous DiscountModal to resolve persistent rendering crashes.
 */
export default function VolumeDiscountModal({ isOpen, onClose, onSave, tier, isSaving }) {
    const [quantities, setQuantities] = useState(Array.isArray(tier?.quantities) ? [...tier.quantities] : []);
    const [newQty, setNewQty] = useState('');
    const [percent, setPercent] = useState(tier?.discount_percent || 0);
    const [isActive, setIsActive] = useState(tier?.is_active !== false);
    const toast = useToast();

    if (!isOpen) return null;

    const handleAddQty = (e) => {
        if (e) e.preventDefault();
        const input = newQty.trim();
        if (!input) return;

        let addedValues = [];
        if (input.includes('-')) {
            const [startStr, endStr] = input.split('-').map(s => s.trim());
            const start = parseInt(startStr);
            const end = parseInt(endStr);

            if (!isNaN(start) && !isNaN(end) && end >= start) {
                // Prevent accidental massive arrays for stability
                const rangeSize = end - start + 1;
                if (rangeSize > 500) {
                    toast('Range too large. Please keep it under 500 units.', 'error');
                    return;
                }
                for (let i = start; i <= end; i++) addedValues.push(i);
            }
        } else if (input.endsWith('+')) {
            const val = parseInt(input.slice(0, -1).trim());
            if (!isNaN(val) && val > 0) addedValues.push(val);
        } else {
            const val = parseInt(input);
            if (!isNaN(val) && val > 0) addedValues.push(val);
        }

        if (addedValues.length > 0) {
            const next = Array.from(new Set([...quantities, ...addedValues])).sort((a, b) => a - b);
            setQuantities(next);
            setNewQty('');
        }
    };

    const handleRemoveQty = (qty) => {
        setQuantities(quantities.filter(q => q !== qty));
    };

    const handleSave = () => {
        if (quantities.length === 0) {
            toast('Please add at least one quantity trigger.', 'error');
            return;
        }
        onSave({
            id: tier?.id,
            quantities,
            discount_percent: parseFloat(percent),
            is_active: isActive
        });
        // We do NOT call onClose() here anymore, because handleSaveDiscount in parent will do it OR 
        // we wait for the parent to finish saving. Actually, standard pattern is to close after success.
        // The parent currently does NOT close it automatically.
    };

    return (
        <div className="vdm-backdrop" onClick={isSaving ? null : onClose}>
            <div className="vdm-modal-content" onClick={e => e.stopPropagation()}>
                {/* Header Section */}
                <header className="vdm-header">
                    <div className="vdm-title-group">
                        <div className="vdm-icon-bg">
                            <Zap size={20} className="vdm-icon-glow" />
                        </div>
                        <div>
                            <h2>{tier ? 'Edit Discount Tier' : 'Add Discount Tier'}</h2>
                            <p>Configure automated price reductions for volume orders.</p>
                        </div>
                    </div>
                    <button className="vdm-close-btn" onClick={onClose} disabled={isSaving}>
                        <X size={20} />
                    </button>
                </header>

                {/* Form Body */}
                <div className="vdm-body">
                    {/* Discount Percentage */}
                    <div className="vdm-field">
                        <label>Discount Percentage (%)</label>
                        <div className="vdm-input-row">
                            <div className="vdm-percent-input-wrapper">
                                <input
                                    type="number"
                                    value={percent}
                                    onChange={e => setPercent(e.target.value)}
                                    placeholder="0"
                                    min="0"
                                    max="100"
                                    disabled={isSaving}
                                />
                                <span className="vdm-suffix">% OFF</span>
                            </div>
                        </div>
                    </div>

                    {/* Quantity Triggers */}
                    <div className="vdm-field">
                        <label>Quantity Triggers (Units)</label>
                        <div className="vdm-qty-tags">
                            {quantities.length > 0 ? (
                                quantities.map(q => (
                                    <div key={q} className="vdm-tag">
                                        <span>{q} Units</span>
                                        <button onClick={() => handleRemoveQty(q)} disabled={isSaving}><X size={12} /></button>
                                    </div>
                                ))
                            ) : (
                                <p className="vdm-empty-hint">No quantity triggers added yet.</p>
                            )}
                        </div>

                        <div className="vdm-add-qty-row">
                            <input
                                type="text"
                                value={newQty}
                                onChange={e => setNewQty(e.target.value)}
                                onKeyPress={e => e.key === 'Enter' && handleAddQty()}
                                placeholder="e.g. 50 or 10-25"
                                disabled={isSaving}
                            />
                            <button onClick={handleAddQty} className="vdm-add-inline-btn" disabled={isSaving}>
                                <Plus size={16} />
                                <span>Add Trigger</span>
                            </button>
                        </div>
                        <p className="vdm-field-hint">
                            <Info size={12} />
                            The discount applies when order quantity meets or exceeds these values. Use "500+" for infinity.
                        </p>
                    </div>

                    {/* Status Toggle */}
                    <div className="vdm-toggle-field">
                        <span className="vdm-toggle-label">Tier Status: <strong>{isActive ? 'Active' : 'Inactive'}</strong></span>
                        <button
                            className={`vdm-toggle-btn ${isActive ? 'active' : ''}`}
                            onClick={() => setIsActive(!isActive)}
                            disabled={isSaving}
                        >
                            <div className="vdm-toggle-slider" />
                        </button>
                    </div>
                </div>

                {/* Footer Actions */}
                <footer className="vdm-footer">
                    <button className="vdm-btn-secondary" onClick={onClose} disabled={isSaving}>Cancel</button>
                    <button className="vdm-btn-primary" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <div className="animate-spin" style={{ width: 18, height: 18, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} />
                        ) : (
                            <Check size={18} />
                        )}
                        <span>{isSaving ? 'Processing...' : (tier ? 'Update Configuration' : 'Create Configuration')}</span>
                    </button>
                </footer>

                {/* Scoped Styles for Maximum Stability */}
                <style>{`
                    .vdm-backdrop {
                        position: fixed;
                        top: 0; left: 0; right: 0; bottom: 0;
                        background: rgba(15, 23, 42, 0.6);
                        backdrop-filter: blur(8px);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 9999;
                        animation: vdmFadeIn 0.2s ease-out;
                    }
                    .vdm-modal-content {
                        background: white;
                        width: 100%;
                        max-width: 480px;
                        border-radius: 24px;
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
                        overflow: hidden;
                        border: 1px solid rgba(255,255,255,0.1);
                        animation: vdmSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    }
                    @keyframes vdmFadeIn { from { opacity: 0; } to { opacity: 1; } }
                    @keyframes vdmSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

                    .vdm-header {
                        padding: 24px 32px;
                        border-bottom: 1px solid #f1f5f9;
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        background: #f8fafc;
                    }
                    .vdm-title-group { display: flex; gap: 16px; align-items: center; }
                    .vdm-icon-bg {
                        width: 44px; height: 44px;
                        background: #eff6ff;
                        color: #3b82f6;
                        border-radius: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .vdm-header h2 { margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; }
                    .vdm-header p { margin: 4px 0 0 0; font-size: 13px; color: #64748b; }
                    .vdm-close-btn { 
                        background: white; border: 1px solid #e2e8f0; border-radius: 8px; 
                        padding: 6px; cursor: pointer; color: #94a3b8; transition: all 0.2s;
                    }
                    .vdm-close-btn:hover { color: #ef4444; border-color: #fecaca; }

                    .vdm-body { padding: 32px; display: flex; flex-direction: column; gap: 24px; }
                    .vdm-field label { display: block; font-size: 13px; font-weight: 700; color: #475569; margin-bottom: 8px; }
                    
                    .vdm-percent-input-wrapper {
                        display: flex; align-items: center; gap: 12px;
                        background: white; border: 2px solid #e2e8f0;
                        padding: 6px 12px; border-radius: 12px; overflow: hidden; justify-content: space-between;
                        transition: all 0.2s;
                    }
                    .vdm-percent-input-wrapper:focus-within {
                        border-color: #3b82f6; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
                    }
                    .vdm-percent-input-wrapper input {
                        border: none; background: transparent; outline: none;
                        font-size: 20px; font-weight: 800; color: #0f172a; width: 80px;
                    }
                    .vdm-suffix { 
                        background: #eff6ff; color: #3b82f6; padding: 4px 10px; 
                        border-radius: 8px; font-size: 11px; font-weight: 900;
                    }

                    .vdm-qty-tags { 
                        display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;
                        max-height: 240px; overflow-y: auto;
                        min-height: 42px; padding: 12px; background: #f8fafc; border: 1.5px dashed #e2e8f0; border-radius: 12px;
                    }
                    .vdm-qty-tags::-webkit-scrollbar { width: 6px; }
                    .vdm-qty-tags::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
                    .vdm-qty-tags::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                    .vdm-qty-tags::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                    .vdm-tag {
                        display: flex; align-items: center; gap: 8px;
                        background: white; border: 1px solid #e2e8f0; border-radius: 8px;
                        padding: 6px 12px; font-size: 12px; font-weight: 700; color: #475569;
                        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                    }
                    .vdm-tag button { background: transparent; border: none; padding: 0; cursor: pointer; color: #94a3b8; display: flex; }
                    .vdm-tag button:hover { color: #ef4444; }
                    .vdm-empty-hint { font-size: 12px; color: #94a3b8; font-style: italic; margin: auto; }

                    .vdm-add-qty-row { display: flex; gap: 10px; }
                    .vdm-add-qty-row input {
                        flex: 1; padding: 12px 16px; border-radius: 12px; border: 2px solid #e2e8f0;
                        background: white; color: #0f172a; font-weight: 600;
                        outline: none; font-size: 14px; transition: all 0.2s;
                    }
                    .vdm-add-qty-row input:focus { border-color: #3b82f6; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1); }
                    .vdm-add-inline-btn {
                        padding: 0 20px; background: #3b82f6; color: white; border: none;
                        border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 700;
                        display: flex; align-items: center; gap: 8px; transition: all 0.2s;
                        box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
                    }
                    .vdm-add-inline-btn:hover { background: #2563eb; transform: translateY(-1px); }

                    .vdm-field-hint { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #94a3b8; margin-top: 8px; }

                    .vdm-toggle-field {
                        display: flex; justify-content: space-between; align-items: center;
                        padding: 16px; background: #f8fafc; border-radius: 16px; border: 1px solid #f1f5f9;
                    }
                    .vdm-toggle-label { font-size: 14px; color: #475569; }
                    .vdm-toggle-btn {
                        width: 44px; height: 24px; border-radius: 100px; background: #e2e8f0;
                        border: none; cursor: pointer; position: relative; transition: all 0.2s;
                    }
                    .vdm-toggle-btn.active { background: #22c55e; }
                    .vdm-toggle-slider {
                        position: absolute; top: 4px; left: 4px; width: 16px; height: 16px;
                        background: white; border-radius: 50%; transition: transform 0.2s;
                    }
                    .vdm-toggle-btn.active .vdm-toggle-slider { transform: translateX(20px); }

                    .vdm-footer {
                        padding: 24px 32px; background: #f8fafc; border-top: 1px solid #f1f5f9;
                        display: flex; justify-content: flex-end; gap: 12px;
                    }
                    .vdm-btn-secondary {
                        padding: 12px 24px; background: white; border: 1.5px solid #e2e8f0;
                        color: #475569; border-radius: 12px; cursor: pointer; font-weight: 700; font-size: 13px;
                    }
                    .vdm-btn-primary {
                        padding: 12px 28px; background: #3b82f6; border: none;
                        color: white; border-radius: 12px; cursor: pointer; font-weight: 700; font-size: 13px;
                        display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
                        transition: all 0.2s;
                    }
                    .vdm-btn-primary:hover { background: #2563eb; transform: translateY(-1px); }
                `}</style>
            </div>
        </div>
    );
}
