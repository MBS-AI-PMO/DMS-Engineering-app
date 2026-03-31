import React, { useState } from 'react';
import { X, Check, Trash2, Plus, Info } from 'lucide-react';

export default function DiscountModal({ isOpen, onClose, onSave, tier }) {
    const [quantities, setQuantities] = useState(Array.isArray(tier?.quantities) ? tier.quantities : []);
    const [newQty, setNewQty] = useState('');
    const [percent, setPercent] = useState(tier?.discount_percent || 0);
    const [isActive, setIsActive] = useState(tier?.is_active !== false);

    const handleAddQty = (e) => {
        if (e) e.preventDefault();
        const val = parseInt(newQty);
        if (val > 0 && !quantities.includes(val)) {
            setQuantities([...quantities].sort((a, b) => a - b).concat(val).sort((a, b) => a - b));
            setNewQty('');
        }
    };

    const handleRemoveQty = (qty) => {
        setQuantities(quantities.filter(q => q !== qty));
    };

    const handleSave = () => {
        if (quantities.length === 0) {
            alert('Please add at least one quantity.');
            return;
        }
        onSave({
            id: tier?.id,
            quantities,
            discount_percent: parseFloat(percent),
            is_active: isActive
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="admin-modal-backdrop">
            <div className="admin-modal-content max-w-md">
                <header className="admin-modal-header">
                    <div>
                        <h2>{tier ? 'Edit Volume Tier' : 'Add New Tier'}</h2>
                        <p>Configure a discount percentage for a set of quantities.</p>
                    </div>
                    <button className="close-btn" onClick={onClose}><X size={20} /></button>
                </header>

                <div className="admin-modal-body">
                    <div className="admin-form-group">
                        <label>Discount Percentage (%)</label>
                        <div className="premium-input-wrapper discount" style={{ width: '100% !important' }}>
                            <input
                                type="number"
                                className="premium-mini-input"
                                value={percent}
                                onChange={e => setPercent(e.target.value)}
                                placeholder="0"
                                min="0"
                                max="100"
                            />
                            <span className="input-suffix premium-discount-badge-v2">% OFF</span>
                        </div>
                    </div>

                    <div className="admin-form-group">
                        <label>Application Quantities (discrete values)</label>
                        <div className="qty-tags-list">
                            {quantities.map(q => (
                                <span key={q} className="qty-tag">
                                    {q} Units
                                    <button onClick={() => handleRemoveQty(q)}><X size={12} /></button>
                                </span>
                            ))}
                        </div>
                        <div className="qty-add-wrapper">
                            <input
                                type="number"
                                value={newQty}
                                onChange={e => setNewQty(e.target.value)}
                                onKeyPress={e => e.key === 'Enter' && handleAddQty()}
                                placeholder="Enter quantity..."
                            />
                            <button onClick={handleAddQty} className="add-qty-inline-btn">
                                <Plus size={16} />
                                Add
                            </button>
                        </div>
                        <p className="admin-card-tip">
                            <Info size={12} />
                            The discount will apply when the order quantity meets or exceeds any of these triggers.
                        </p>
                    </div>

                    <div className="admin-toggle-group">
                        <label className="switch-label">
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={e => setIsActive(e.target.checked)}
                            />
                            <span className="slider round"></span>
                            Status: {isActive ? 'Active' : 'Inactive'}
                        </label>
                    </div>
                </div>

                <footer className="admin-modal-footer">
                    <button className="admin-btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="admin-btn-primary" onClick={handleSave}>
                        <Check size={18} />
                        {tier ? 'Update Tier' : 'Create Tier'}
                    </button>
                </footer>
            </div>

            <style>{`
                .qty-tags-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-bottom: 12px;
                    min-height: 38px;
                }
                .qty-tag {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: #f1f5f9;
                    color: #475569;
                    padding: 6px 12px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 700;
                    border: 1px solid #e2e8f0;
                }
                .qty-tag button {
                    background: transparent;
                    border: none;
                    color: #94a3b8;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                }
                .qty-tag button:hover { color: #ef4444; }

                .qty-add-wrapper {
                    display: flex;
                    gap: 8px;
                }
                .qty-add-wrapper input {
                    flex: 1;
                    padding: 10px 14px;
                    border-radius: 10px;
                    border: 2px solid #e2e8f0;
                    outline: none;
                }
                .qty-add-wrapper input:focus { border-color: #3b82f6; }
                .add-qty-inline-btn {
                    padding: 0 16px;
                    background: #f8fafc;
                    border: 2px solid #e2e8f0;
                    border-radius: 10px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-weight: 700;
                    color: #475569;
                }
                .add-qty-inline-btn:hover { background: #f1f5f9; border-color: #94a3b8; }
            `}</style>
        </div>
    );
}
