import React, { Component, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';// eslint-disable-line no-unused-vars
import {
    ChevronRight, Save, Loader2, Info, AlertCircle, Check, X,
    Layers, Wrench, Box, DollarSign, ArrowLeft, Trash2
} from 'lucide-react';
import {
    fetchPricingMetadata, updateMetal,
    fetchAdminDiscounts, saveDiscountTier, deleteDiscountTier
} from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import PricingSkeleton from '../../components/admin/PricingSkeleton';
import VolumeDiscountModal from '../../components/admin/modals/VolumeDiscountModal';

export default function PricingManagement() {
    const toast = useToast();
    const navigate = useNavigate(); // eslint-disable-line no-unused-vars
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Metadata
    const [metals, setMetals] = useState([]);
    const [services, setServices] = useState([]); // eslint-disable-line no-unused-vars

    // Selection state
    const [selectedMetal, setSelectedMetal] = useState(null);
    const [selectedService, setSelectedService] = useState(null);

    // Pricing Rules for the current selection
    const [rules, setRules] = useState([]);

    // Global Quantity Discounts
    const [discounts, setDiscounts] = useState([]);
    const [loadingDiscounts, setLoadingDiscounts] = useState(false);
    const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
    const [discountDisplayMode, setDiscountDisplayMode] = useState('range'); // 'range' or 'unit'
    const [selectedDiscountTier, setSelectedDiscountTier] = useState(null);

    const loadDiscounts = useCallback(async () => {
        try {
            setLoadingDiscounts(true);
            const discRes = await fetchAdminDiscounts();
            // fetchAdminDiscounts() returns the array directly
            setDiscounts(discRes || []);
        } catch (err) {
            toast('Failed to load discounts: ' + err.message, 'error');
        } finally {
            setLoadingDiscounts(false);
        }
    }, [toast]);

    useEffect(() => {
        const loadMetadata = async () => {
            try {
                const { data } = await fetchPricingMetadata();
                setMetals(data.metals || []);
                setServices(data.services || []);

                await loadDiscounts();
            } catch (err) {
                toast('Failed to load metadata: ' + err.message, 'error');
            } finally {
                setLoading(false);
            }
        };
        loadMetadata();
    }, [toast, loadDiscounts]);

    useEffect(() => {
        if (selectedMetal) {
            // Initializing rules from the metal's own pricing_config
            const config = selectedMetal.pricing_config || {};
            // Support both old and new metadata structure
            const thicknessData = selectedMetal.quick_look?.thicknesses || selectedMetal.thicknesses || [];

            const merged = thicknessData.map(t => {
                // Handle both object {value, label} and legacy string formats
                const val = typeof t === 'object' ? t.value : t.toString();
                const lbl = typeof t === 'object' ? t.label : (t.toString() + '"');
                return {
                    thickness_value: val,
                    label: lbl,
                    price_per_sq_inch: config[val] || 0
                };
            });

            setRules(merged);
        } else {
            setRules([]);
        }
    }, [selectedMetal]);

    const handleRuleChange = (thickness, field, value) => {
        setRules(prev => prev.map(r =>
            r.thickness_value === thickness
                ? { ...r, [field]: value === '' ? 0 : parseFloat(value) }
                : r
        ));
    };

    const handleSave = async () => {
        if (!selectedMetal) return;
        setSaving(true);
        try {
            // Convert array back to object for storage
            const newConfig = {};
            rules.forEach(r => {
                newConfig[r.thickness_value] = r.price_per_sq_inch;
            });

            await updateMetal(selectedMetal.slug, {
                ...selectedMetal,
                pricing_config: newConfig
            });

            toast('Material pricing updated successfully', 'success');
        } catch (err) {
            toast('Failed to save material pricing: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    // --- Discount Handlers ---
    const handleAddDiscount = () => {
        setSelectedDiscountTier(null);
        setIsDiscountModalOpen(true);
    };

    const handleEditDiscount = (tier) => {
        setSelectedDiscountTier(tier);
        setIsDiscountModalOpen(true);
    };

    const handleSaveDiscount = async (data) => {
        setSaving(true);
        try {
            await saveDiscountTier(data);
            toast('Discount tier saved successfully', 'success');
            await loadDiscounts();
        } catch (err) {
            toast(`Error: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteDiscount = async (e, id, index) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        console.log('Attempting to delete tier:', id, index);
        if (!id) {
            console.log('Removing unsaved local tier');
            setDiscounts(prev => prev.filter((_, i) => i !== index));
            return;
        }

        if (!window.confirm('Are you sure you want to delete this volume discount tier?')) return;

        try {
            const res = await deleteDiscountTier(id);
            console.log('Delete response:', res);
            toast('Discount tier deleted', 'success');
            await loadDiscounts();
        } catch (err) {
            console.error('DELETE ERROR:', err);
            toast(`Delete failed: ${err.message}`, 'error');
            alert(`Failed to delete: ${err.message}`);
        }
    };

    // Helper to format quantity arrays as ranges (e.g. 10-15)
    // Now accepts allDiscounts to identify the global max trigger for infinity representation (e.g. 500+)
    const getRangeString = (nums, allDiscounts = []) => {
        if (!Array.isArray(nums) || !nums.length) return 'No triggers';
        const sorted = [...nums].sort((a, b) => a - b);

        // Find global max to determine if we should use the "+" infinity marker
        const globalMax = allDiscounts.length > 0
            ? Math.max(...allDiscounts.flatMap(d => Array.isArray(d.quantities) ? d.quantities : []))
            : 0;

        const ranges = [];
        let start = sorted[0];
        let prev = start;

        for (let i = 1; i <= sorted.length; i++) {
            const current = sorted[i];
            if (current === prev + 1) {
                prev = current;
            } else {
                // If the end of this range is the global maximum, mark it as infinity
                if (prev === globalMax && globalMax > 0) {
                    ranges.push(`${start}+`);
                } else {
                    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
                }
                start = current;
                prev = start;
            }
        }
        return ranges.join(', ');
    };

    if (loading) {
        return <PricingSkeleton />;
    }

    return (
        <div className="admin-page pricing-management-page">
            <header className="admin-page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {(selectedMetal || selectedService) && (
                        <button
                            className="admin-icon-btn"
                            onClick={() => {
                                if (selectedService) setSelectedService(null);
                                else setSelectedMetal(null);
                            }}
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div>
                        <h1 className="admin-page-title">Pricing Management</h1>
                        <p className="admin-page-subtitle">Configure per-inch pricing rules for your catalog.</p>
                    </div>
                </div>
                {selectedMetal && (
                    <div className="admin-page-actions">
                        <button
                            className="admin-btn-primary"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {saving ? 'Saving...' : 'Save Material Prices'}
                        </button>
                    </div>
                )}
            </header>

            <div className="pricing-flow-container">
                {/* ─── STEP 1: SELECT METAL ─── */}
                {!selectedMetal && (
                    <motion.div
                        className="pricing-step-section"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        {/* PREMIUM GLOBAL DISCOUNTS SECTION */}
                        <div className="admin-card volume-discounts-premium-card mb-12">
                            <div className="premium-card-header">
                                <div className="header-info">
                                    <div className="icon-badge">
                                        <DollarSign size={22} />
                                    </div>
                                    <div>
                                        <h3>Volume Pricing Tiers</h3>
                                        <p>Configure global percentage discounts based on order quantity.</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <div className="display-toggle-group" style={{
                                        background: '#ecf2f8', padding: '4px', borderRadius: '10px',
                                        display: 'flex', gap: '4px', border: '1px solid #e2e8f0'
                                    }}>
                                        <button
                                            type="button"
                                            className={`toggle-tab ${discountDisplayMode === 'range' ? 'active' : ''}`}
                                            onClick={() => setDiscountDisplayMode('range')}
                                            style={{
                                                padding: '6px 14px', fontSize: '11px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                                background: discountDisplayMode === 'range' ? '#fff' : 'transparent',
                                                boxShadow: discountDisplayMode === 'range' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                                color: discountDisplayMode === 'range' ? '#3b82f6' : '#64748b', fontWeight: '800',
                                                transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.02em'
                                            }}
                                        >Range View</button>
                                        <button
                                            type="button"
                                            className={`toggle-tab ${discountDisplayMode === 'unit' ? 'active' : ''}`}
                                            onClick={() => setDiscountDisplayMode('unit')}
                                            style={{
                                                padding: '6px 14px', fontSize: '11px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                                background: discountDisplayMode === 'unit' ? '#fff' : 'transparent',
                                                boxShadow: discountDisplayMode === 'unit' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                                color: discountDisplayMode === 'unit' ? '#3b82f6' : '#64748b', fontWeight: '800',
                                                transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.02em'
                                            }}
                                        >Unit View</button>
                                    </div>
                                    <button type="button" className="add-tier-btn" onClick={handleAddDiscount}>
                                        <span>+ Add New Tier</span>
                                    </button>
                                </div>
                            </div>

                            <div className="premium-discounts-content">
                                {loadingDiscounts ? (
                                    <div className="mini-loader"><Loader2 className="animate-spin" size={24} /></div>
                                ) : discounts.length === 0 ? (
                                    <div className="premium-empty-state">
                                        <Info size={32} />
                                        <p>No volume discounts configured yet. Build your first tier to reward bulk orders.</p>
                                    </div>
                                ) : (
                                    <div className="premium-table-container">
                                        <table className="premium-discounts-table">
                                            <thead>
                                                <tr>
                                                    <th>Quantity Triggers</th>
                                                    <th>Discount Applied</th>
                                                    <th className="actions-cell">Management</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {discounts.map((d, idx) => (
                                                    <tr key={d.id || `new-${idx}`} className="premium-tier-row">
                                                        <td>
                                                            <div className="premium-qty-list-display">
                                                                {discountDisplayMode === 'range' ? (
                                                                    <span className="trigger-badge" style={{ background: '#f8fafc', color: '#1e293b', padding: '6px 12px', border: '1.5px solid #e2e8f0' }}>
                                                                        {getRangeString(d.quantities, discounts)} Units
                                                                    </span>
                                                                ) : (
                                                                    d.quantities?.map(q => (
                                                                        <span key={q} className="trigger-badge">{q} Units</span>
                                                                    ))
                                                                )}
                                                                {!d.is_active && <span className="inactive-badge">Inactive</span>}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="discount-value-display">
                                                                <span className="premium-discount-badge-v2">{d.discount_percent}% OFF</span>
                                                            </div>
                                                        </td>
                                                        <td className="actions-cell">
                                                            <div className="premium-mini-actions">
                                                                <button
                                                                    type="button"
                                                                    className="premium-action-btn edit"
                                                                    onClick={() => handleEditDiscount(d)}
                                                                    title="Edit Tier"
                                                                >
                                                                    <ChevronRight size={16} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="premium-action-btn delete"
                                                                    onClick={(e) => handleDeleteDiscount(e, d.id, idx)}
                                                                    title="Remove Tier"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pricing-section-header">
                            <Box size={24} />
                            <h2>Select a Metal</h2>
                        </div>
                        <div className="pricing-grid-selection">
                            {metals.map(metal => (
                                <button
                                    key={metal.id}
                                    className="pricing-selection-card"
                                    onClick={() => setSelectedMetal(metal)}
                                >
                                    {metal.image_path ? (
                                        <img src={metal.image_path} alt={metal.name} loading="lazy" decoding="async" />
                                    ) : (
                                        <div className="fallback-img"><Box size={32} /></div>
                                    )}
                                    <div className="card-info">
                                        <h3>{metal.name}</h3>
                                        {(metal.quick_look?.thicknesses || []).length > 0 ? (
                                            <span className="badge">{(metal.quick_look?.thicknesses || []).length} Thicknesses</span>
                                        ) : (
                                            <span className="badge" style={{ background: '#fee2e2', color: '#991b1b' }}>Configure Catalog</span>
                                        )}
                                    </div>
                                    <ChevronRight size={20} />
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
                {/* ─── STEP 2: CONFIGURE RULES ─── */}
                {selectedMetal && (
                    <motion.div
                        className="pricing-step-section"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="pricing-selection-header-banner multi">
                            <div className="selection-info">
                                <span className="label">Selected Metal:</span>
                                <strong className="value">{selectedMetal.name}</strong>
                            </div>
                        </div>

                        <div className="pricing-table-container admin-card">
                            <div className="admin-section-header">
                                <DollarSign size={20} />
                                <h3>Thickness-Based Material Pricing</h3>
                                <div className="info-tooltip">
                                    <Info size={14} />
                                    <span>Set the raw material cost per square inch ($/sq-in) for each thickness. Manufacturing costs are set in the Services section.</span>
                                </div>
                            </div>

                            <div className="pricing-table-scroll">
                                <table className="pricing-config-table">
                                    <thead>
                                        <tr>
                                            <th>Thickness Label</th>
                                            <th>Value (in)</th>
                                            <th>Price per Square Inch ($/sq-in)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rules.map((rule) => (
                                            <tr key={rule.thickness_value}>
                                                <td><span className="thickness-badge">{rule.label || rule.thickness_value}</span></td>
                                                <td><span className="thickness-val">{rule.thickness_value}&quot;</span></td>
                                                <td>
                                                    <div className="price-input-wrapper" style={{ maxWidth: '200px' }}>
                                                        <span>$</span>
                                                        <input
                                                            type="number"
                                                            step="0.001"
                                                            value={rule.price_per_sq_inch}
                                                            onChange={(e) => handleRuleChange(rule.thickness_value, 'price_per_sq_inch', e.target.value)}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
            <VolumeDiscountModal
                key={isDiscountModalOpen ? (selectedDiscountTier?.id || 'new') : 'closed'}
                isOpen={isDiscountModalOpen}
                onClose={() => setIsDiscountModalOpen(false)}
                onSave={handleSaveDiscount}
                tier={selectedDiscountTier}
            />

            <style>{`
                .pricing-management-page {
                    padding-bottom: 80px;        
                }   
                .selection-separator {
                    color: #94a3b8;
                    display: flex;
                    align-items: center;    
                }
                .pricing-selection-header-banner {
                    display: flex;
                    gap: 16px;
                    background: #f8fafc;
                    padding: 16px 24px;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    margin-bottom: 24px;
                }
                .pricing-selection-header-banner.multi {
                    align-items: center;
                    background: #f1f5f9;
                }
                .selection-info {
                    display: flex;
                    flex-direction: column;
                }
                .selection-info .label {
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #64748b;
                    letter-spacing: 0.05em;
                }
                .selection-info .value {
                    font-size: 16px;
                    color: #1e293b;
                }

                .pricing-section-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 24px;
                    color: #1e293b;
                }
                .pricing-section-header h2 {
                    font-size: 20px;
                    font-weight: 800;
                }

                .pricing-grid-selection {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 16px;
                }
                .pricing-selection-card {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    background: white;
                    border: 1px solid #e2e8f0;
                    padding: 16px;
                    border-radius: 16px;
                    cursor: pointer;
                    text-align: left;
                    transition: all 0.2s;
                }
                .pricing-selection-card:hover {
                    border-color: #3b82f6;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.08);
                    transform: translateY(-2px);
                }
                .pricing-selection-card img, .fallback-img {
                    width: 60px;
                    height: 60px;
                    border-radius: 10px;
                    object-fit: cover;
                    background: #f1f5f9;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #94a3b8;
                }
                .pricing-selection-card .card-info {
                    flex: 1;
                }
                .pricing-selection-card h3 {
                    font-size: 15px;
                    font-weight: 700;
                    margin-bottom: 4px;
                    color: #1e293b;
                }
                .badge {
                    font-size: 11px;
                    background: #f1f5f9;
                    color: #475569;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-weight: 700;
                }

                .pricing-list-selection {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .pricing-list-item {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    padding: 20px;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    cursor: pointer;
                    text-align: left;
                    transition: all 0.2s;
                }
                .pricing-list-item:hover {
                    border-color: #3b82f6;
                    background: #f8fafc;
                }
                .svc-icon-box {
                    width: 48px;
                    height: 48px;
                    background: #f1f5f9;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #3b82f6;
                }
                .svc-info {
                    flex: 1;
                }
                .svc-info h3 {
                    font-size: 16px;
                    font-weight: 700;
                    margin-bottom: 2px;
                }
                .svc-info p {
                    font-size: 13px;
                    color: #64748b;
                }

                .no-services-placeholder {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 60px;
                    background: #f8fafc;
                    border: 2px dashed #e2e8f0;
                    border-radius: 20px;
                    color: #64748b;
                    text-align: center;
                }
                .no-services-placeholder p {
                    margin-top: 12px;
                    font-weight: 600;
                }
                .mt-4 { margin-top: 16px; }

                .pricing-table-container {
                    padding: 24px;
                    background: white;
                }
                .info-tooltip {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: #eff6ff;
                    color: #2563eb;
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    margin-left: 16px;
                }
                .pricing-table-scroll {
                    overflow-x: auto;
                    padding: 4px;
                }

                .cnc-variable-pricing-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 24px;
                    padding: 24px 0;
                }
                .pricing-input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .pricing-input-group label {
                    font-size: 13px;
                    font-weight: 600;
                    color: #475569;
                }

                .pricing-config-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 16px;
                }
                .pricing-config-table th {
                    text-align: left;
                    padding: 12px;
                    font-size: 12px;
                    text-transform: uppercase;
                    color: #94a3b8;
                    letter-spacing: 0.05em;
                    border-bottom: 2px solid #f1f5f9;
                }
                .pricing-config-table td {
                    padding: 16px 12px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .thickness-cell {
                    font-size: 14px;
                    color: #1e293b;
                }
                .price-input-wrapper {
                    display: flex;
                    align-items: center;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 0 10px;
                    max-width: 150px;
                    transition: all 0.2s;
                }
                .price-input-wrapper:focus-within {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                    background: white;
                }
                .price-input-wrapper span {
                    color: #94a3b8;
                    font-weight: 700;
                    font-size: 14px;
                }
                .price-input-wrapper input {
                    width: 100%;
                    border: none;
                    background: transparent;
                    padding: 8px;
                    font-weight: 700;
                    color: #1e293b;
                    outline: none;
                }

                .volume-discounts-premium-card {
                    background: white;
                    border-radius: 20px;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
                    overflow: hidden;
                    margin-bottom: 48px;
                }
                .premium-card-header {
                    padding: 32px;
                    background: #f8fafc;
                    border-bottom: 1px solid #f1f5f9;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .header-info {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                }
                .icon-badge {
                    width: 48px;
                    height: 48px;
                    background: #eff6ff;
                    color: #3b82f6;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .premium-card-header h3 {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 800;
                    color: #0f172a;
                }
                .premium-card-header p {
                    margin: 4px 0 0 0;
                    font-size: 13px;
                    color: #64748b;
                }
                .add-tier-btn {
                    padding: 10px 20px;
                    background: white;
                    border: 1.5px solid #e2e8f0;
                    color: #0f172a;
                    font-weight: 700;
                    font-size: 13px;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .add-tier-btn:hover {
                    border-color: #0f172a;
                    background: #f8fafc;
                    transform: translateY(-1px);
                }
                .premium-discounts-content {
                    padding: 0;
                }
                .premium-table-container {
                    width: 100%;
                }
                .premium-discounts-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .premium-discounts-table th {
                    text-align: left;
                    padding: 16px 32px;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #94a3b8;
                    font-weight: 800;
                    background: white;
                }
                .premium-tier-row {
                    transition: background 0.2s;
                    border-top: 1px solid #f1f5f9;
                }
                .premium-tier-row:hover {
                    background: #fcfcfc;
                }
                .premium-tier-row td {
                    padding: 16px 32px;
                    vertical-align: middle;
                }
                .premium-input-wrapper {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: white !important;
                    border: 2px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 4px 10px;
                    width: 240px !important;
                    transition: all 0.2s;
                }
                .premium-input-wrapper:focus-within {
                    border-color: #2563eb;
                    background: white !important;
                }
                .premium-mini-input {
                    background: transparent !important;
                    border: none !important;
                    outline: none !important;
                    font-size: 16px !important;
                    font-weight: 800 !important;
                    color: #0f172a !important;
                    padding: 8px !important;
                    flex: 1 !important;
                    min-width: 80px !important;
                    text-align: left !important;
                }
                /* Hide arrows/spinners */
                .premium-mini-input::-webkit-outer-spin-button,
                .premium-mini-input::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                .premium-mini-input[type=number] {
                    -moz-appearance: textfield;
                }
                .input-suffix {
                    font-size: 11px !important;
                    font-weight: 800 !important;
                    color: #64748b !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.05em !important;
                    padding: 4px 8px !important;
                }
                .input-suffix.premium-discount-badge-v2 {
                    color: #1e40af !important;
                    background: #dbeafe !important;
                    border-radius: 8px !important;
                    min-width: 75px !important;
                    text-align: center !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    font-size: 11px !important;
                    font-weight: 900 !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                }
                .actions-cell {
                    text-align: center;
                    width: 120px;
                }
                .premium-mini-actions {
                    display: flex;
                    justify-content: center;
                    gap: 12px;
                }
                .premium-action-btn {
                    width: 38px;
                    height: 38px;
                    border-radius: 10px;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .premium-action-btn.save {
                    background: #f0fdf4;
                    color: #16a34a;
                }
                .premium-action-btn.save:hover {
                    background: #16a34a;
                    color: white;
                    transform: scale(1.1);
                }
                .premium-action-btn.delete {
                    background: #fff1f2;
                    color: #e11d48;
                }
                .premium-action-btn.delete:hover {
                    background: #e11d48;
                    color: white;
                    transform: scale(1.1);
                }
                .premium-empty-state {
                    padding: 64px 32px;
                    text-align: center;
                    color: #94a3b8;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 16px;
                }
                .premium-qty-list-display {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                .trigger-badge {
                    background: #f1f5f9;
                    color: #475569;
                    padding: 4px 10px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 800;
                    border: 1px solid #e2e8f0;
                }
                .inactive-badge {
                    background: #fef2f2;
                    color: #991b1b;
                    padding: 4px 10px;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 800;
                    text-transform: uppercase;
                }
                .premium-action-btn.edit {
                    background: #eff6ff;
                    color: #3b82f6;
                }
                .premium-action-btn.edit:hover {
                    background: #3b82f6;
                    color: white;
                    transform: translateX(3px);
                }
            `}</style>
        </div>
    );
}

function PricingRow({ rule, onChange }) {
    const [localBase, setLocalBase] = useState(rule.base_price);
    const [localW, setLocalW] = useState(rule.price_per_inch_height);
    const [localL, setLocalL] = useState(rule.price_per_inch_length);

    useEffect(() => {
        setLocalBase(rule.base_price);
        setLocalW(rule.price_per_inch_height);
        setLocalL(rule.price_per_inch_length);
    }, [rule]);

    const handleBlur = (field, value) => {
        onChange(rule.thickness_value, field, value);
    };

    return (
        <tr className="premium-tier-row">
            <td className="thickness-cell">
                <strong>{rule.thickness_value}&quot;</strong>
            </td>
            <td>
                <div className="price-input-wrapper">
                    <span>$</span>
                    <input
                        type="number"
                        step="0.01"
                        className="premium-mini-input"
                        style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', fontWeight: 700 }}
                        value={localBase}
                        onChange={(e) => setLocalBase(e.target.value)}
                        onBlur={(e) => handleBlur('base_price', e.target.value)}
                    />
                </div>
            </td>
            <td>
                <div className="price-input-wrapper">
                    <span>$</span>
                    <input
                        type="number"
                        step="0.01"
                        className="premium-mini-input"
                        style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', fontWeight: 700 }}
                        value={localW}
                        onChange={(e) => setLocalW(e.target.value)}
                        onBlur={(e) => handleBlur('price_per_inch_height', e.target.value)}
                    />
                </div>
            </td>
            <td>
                <div className="price-input-wrapper">
                    <span>$</span>
                    <input
                        type="number"
                        step="0.01"
                        className="premium-mini-input"
                        style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', fontWeight: 700 }}
                        value={localL}
                        onChange={(e) => setLocalL(e.target.value)}
                        onBlur={(e) => handleBlur('price_per_inch_length', e.target.value)}
                    />
                </div>
            </td>
        </tr>
    );
}
