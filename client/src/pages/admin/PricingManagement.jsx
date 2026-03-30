import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';// eslint-disable-line no-unused-vars
import {
    ChevronRight, Save, Loader2, Info, AlertCircle, Check, X,
    Layers, Wrench, Box, DollarSign, ArrowLeft
} from 'lucide-react';
import {
    fetchPricingMetadata, fetchPricingRules, savePricingRules,
    fetchAdminDiscounts, saveDiscountTier, deleteDiscountTier
} from '../../utils/api';
import { useToast } from '../../context/ToastContext';

export default function PricingManagement() {
    const toast = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Metadata
    const [metals, setMetals] = useState([]);
    const [services, setServices] = useState([]);

    // Selection state
    const [selectedMetal, setSelectedMetal] = useState(null);
    const [selectedService, setSelectedService] = useState(null);

    // Pricing Rules for the current selection
    const [rules, setRules] = useState([]);

    // Global Quantity Discounts
    const [discounts, setDiscounts] = useState([]);
    const [loadingDiscounts, setLoadingDiscounts] = useState(false);

    const loadDiscounts = useCallback(async () => {
        try {
            setLoadingDiscounts(true);
            const discRes = await fetchAdminDiscounts();
            setDiscounts(discRes.data || []);
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
        if (selectedMetal && selectedService) {
            const loadRules = async () => {
                try {
                    const { data } = await fetchPricingRules(selectedMetal.id, selectedService.id);
                    const isCNC = selectedService.id === 2;
                    let merged;

                    if (isCNC) {
                        // CNC uses a single 'variable' rule
                        const existing = (data || []).find(r => r.thickness_value === 'variable');
                        merged = [{
                            thickness_value: 'variable',
                            base_price: existing ? existing.base_price : 0,
                            price_per_inch_height: existing ? existing.price_per_inch_height : 0,
                            price_per_inch_length: existing ? existing.price_per_inch_length : 0,
                            price_per_inch_thickness: existing ? existing.price_per_inch_thickness : 0
                        }];
                    } else {
                        // Standard services use the thickness table
                        merged = (selectedMetal.thicknesses || []).map(t => {
                            const existing = (data || []).find(r => r.thickness_value === t.toString());
                            return {
                                thickness_value: t.toString(),
                                base_price: existing ? existing.base_price : 0,
                                price_per_inch_height: existing ? existing.price_per_inch_height : 0,
                                price_per_inch_length: existing ? existing.price_per_inch_length : 0
                            };
                        });
                    }
                    setRules(merged);
                } catch (err) {
                    toast('Failed to load pricing rules: ' + err.message, 'error');
                }
            };
            loadRules();
        } else {
            setRules([]);
        }
    }, [selectedMetal, selectedService, toast]);

    const handleRuleChange = (thickness, field, value) => {
        setRules(prev => prev.map(r =>
            r.thickness_value === thickness
                ? { ...r, [field]: value === '' ? 0 : parseFloat(value) }
                : r
        ));
    };

    const handleSave = async () => {
        if (!selectedMetal || !selectedService) return;
        setSaving(true);
        try {
            await savePricingRules({
                metal_id: selectedMetal.id,
                service_id: selectedService.id,
                rules
            });
            toast('Pricing rules updated successfully', 'success');
        } catch (err) {
            toast('Failed to save pricing: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    // --- Discount Handlers ---
    const handleAddDiscount = () => {
        setDiscounts(prev => [...prev, { min_quantity: 1, discount_percent: 0, is_new: true }]);
    };

    const handleDiscountChange = (index, field, value) => {
        setDiscounts(prev => prev.map((d, i) =>
            i === index ? {
                ...d,
                [field]: value === '' ? 0 : parseFloat(value),
                is_dirty: true
            } : d
        ));
    };

    const handleSaveDiscount = async (e, index) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        const item = discounts[index];
        console.log('Attempting to save discount tier:', item);

        // Data sanitization
        const payload = {
            id: item.id,
            min_quantity: parseInt(item.min_quantity) || 0,
            discount_percent: parseFloat(item.discount_percent) || 0,
            is_active: item.is_active !== false
        };

        try {
            const res = await saveDiscountTier(payload);
            console.log('Save response:', res);
            toast('Discount tier saved successfully', 'success');
            await loadDiscounts();
        } catch (err) {
            console.error('SAVE ERROR:', err);
            toast(`Error: ${err.message}`, 'error');
            alert(`Failed to save: ${err.message}`);
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

    if (loading) {
        return (
            <div className="admin-loading-container">
                <Loader2 className="animate-spin" size={40} />
                <p>Loading pricing data...</p>
            </div>
        );
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
                {selectedMetal && selectedService && (
                    <div className="admin-page-actions">
                        <button
                            className="admin-btn-primary"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {saving ? 'Saving...' : 'Save Configuration'}
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
                                <button type="button" className="add-tier-btn" onClick={handleAddDiscount}>
                                    <span>+ Add New Tier</span>
                                </button>
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
                                                    <th>Minimum Quantity</th>
                                                    <th>Discount Applied</th>
                                                    <th className="actions-cell">Management</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {discounts.map((d, idx) => (
                                                    <tr key={d.id || `new-${idx}`} className="premium-tier-row">
                                                        <td>
                                                            <div className="premium-input-wrapper">
                                                                <input
                                                                    type="number"
                                                                    className="premium-mini-input"
                                                                    value={d.min_quantity}
                                                                    onChange={(e) => handleDiscountChange(idx, 'min_quantity', e.target.value)}
                                                                />
                                                                <span className="input-suffix">Units</span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="premium-input-wrapper discount">
                                                                <input
                                                                    type="number"
                                                                    className="premium-mini-input"
                                                                    value={d.discount_percent}
                                                                    onChange={(e) => handleDiscountChange(idx, 'discount_percent', e.target.value)}
                                                                />
                                                                <span className="input-suffix premium-discount-badge-v2">% OFF</span>
                                                            </div>
                                                        </td>
                                                        <td className="actions-cell">
                                                            <div className="premium-mini-actions">
                                                                {(d.is_new || d.is_dirty) && (
                                                                    <button
                                                                        type="button"
                                                                        className="premium-action-btn save"
                                                                        onClick={(e) => handleSaveDiscount(e, idx)}
                                                                        title="Save Changes"
                                                                    >
                                                                        <Check size={16} />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    className="premium-action-btn delete"
                                                                    onClick={(e) => handleDeleteDiscount(e, d.id, idx)}
                                                                    title="Remove Tier"
                                                                >
                                                                    <X size={16} />
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
                                        <img src={metal.image_path} alt={metal.name} loading="lazy" />
                                    ) : (
                                        <div className="fallback-img"><Box size={32} /></div>
                                    )}
                                    <div className="card-info">
                                        <h3>{metal.name}</h3>
                                        <span className="badge">{metal.thicknesses?.length || 0} Dimensions</span>
                                    </div>
                                    <ChevronRight size={20} />
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ─── STEP 2: SELECT SERVICE ─── */}
                {selectedMetal && !selectedService && (
                    <motion.div
                        className="pricing-step-section"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <div className="pricing-selection-header-banner">
                            <div className="selection-info">
                                <span className="label">Selected Metal:</span>
                                <strong className="value">{selectedMetal.name}</strong>
                            </div>
                        </div>
                        <div className="pricing-section-header mt-8">
                            <Wrench size={24} />
                            <h2>Select a Service</h2>
                        </div>
                        <div className="pricing-list-selection">
                            {services.filter(svc => (selectedMetal.assigned_services || []).includes(svc.id)).length > 0 ? (
                                services
                                    .filter(svc => (selectedMetal.assigned_services || []).includes(svc.id))
                                    .map(svc => (
                                        <button
                                            key={svc.id}
                                            className="pricing-list-item"
                                            onClick={() => setSelectedService(svc)}
                                        >
                                            <div className="svc-icon-box">
                                                {svc.is_production ? <Layers size={20} /> : <Wrench size={20} />}
                                            </div>
                                            <div className="svc-info">
                                                <h3 style={{ color: '#1e293b' }}>{svc.title}</h3>
                                                <p style={{ color: '#64748b' }}>{svc.description}</p>
                                            </div>
                                            <ChevronRight size={20} />
                                        </button>
                                    ))
                            ) : (
                                <div className="no-services-placeholder">
                                    <AlertCircle size={32} />
                                    <p>No services are currently assigned to this metal.</p>
                                    <button
                                        className="admin-btn-secondary mt-4"
                                        onClick={() => navigate(`/admin/metals/${selectedMetal.slug}`)}
                                    >
                                        Configure Metal Services
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* ─── STEP 3: CONFIGURE RULES ─── */}
                {selectedMetal && selectedService && (
                    <motion.div
                        className="pricing-step-section"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="pricing-selection-header-banner multi">
                            <div className="selection-info">
                                <span className="label">Metal:</span>
                                <strong className="value">{selectedMetal.name}</strong>
                            </div>
                            <div className="selection-separator"><ChevronRight size={16} /></div>
                            <div className="selection-info">
                                <span className="label">Service:</span>
                                <strong className="value">{selectedService.title}</strong>
                            </div>
                        </div>

                        <div className="pricing-table-container admin-card">
                            <div className="admin-section-header">
                                <DollarSign size={20} />
                                <h3>{selectedService.id === 2 ? 'CNC 3D Dimension Pricing' : 'Price Parameters per Thickness'}</h3>
                                <div className="info-tooltip">
                                    <Info size={14} />
                                    <span>
                                        {selectedService.id === 2
                                            ? 'Formula: (Base + (Width * $W) + (Length * $L) + (Actual Thickness * $T))'
                                            : 'Formula: (Base + (Width * $W) + (Length * $L))'}
                                    </span>
                                </div>
                            </div>

                            <div className="pricing-table-scroll">
                                {selectedService.id === 2 ? (
                                    <div className="cnc-variable-pricing-grid">
                                        <div className="pricing-input-group">
                                            <label>Base Price / Setup ($)</label>
                                            <div className="price-input-wrapper">
                                                <span>$</span>
                                                <input
                                                    type="number"
                                                    value={rules[0]?.base_price || 0}
                                                    onChange={(e) => handleRuleChange('variable', 'base_price', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="pricing-input-group">
                                            <label>Price per Inch Width ($)</label>
                                            <div className="price-input-wrapper">
                                                <span>$</span>
                                                <input
                                                    type="number"
                                                    value={rules[0]?.price_per_inch_height || 0}
                                                    onChange={(e) => handleRuleChange('variable', 'price_per_inch_height', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="pricing-input-group">
                                            <label>Price per Inch Length ($)</label>
                                            <div className="price-input-wrapper">
                                                <span>$</span>
                                                <input
                                                    type="number"
                                                    value={rules[0]?.price_per_inch_length || 0}
                                                    onChange={(e) => handleRuleChange('variable', 'price_per_inch_length', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="pricing-input-group">
                                            <label>Price per Inch Thickness ($)</label>
                                            <div className="price-input-wrapper">
                                                <span>$</span>
                                                <input
                                                    type="number"
                                                    value={rules[0]?.price_per_inch_thickness || 0}
                                                    onChange={(e) => handleRuleChange('variable', 'price_per_inch_thickness', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <table className="pricing-config-table">
                                        <thead>
                                            <tr>
                                                <th>Thickness (in)</th>
                                                <th>Base Price ($)</th>
                                                <th>$ / Inch (Width)</th>
                                                <th>$ / Inch (Length)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rules.map((rule) => (
                                                <tr key={rule.thickness_value}>
                                                    <td className="thickness-cell">
                                                        <strong>{rule.thickness_value}&quot;</strong>
                                                    </td>
                                                    <td>
                                                        <div className="price-input-wrapper">
                                                            <span>$</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={rule.base_price}
                                                                onChange={(e) => handleRuleChange(rule.thickness_value, 'base_price', e.target.value)}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="price-input-wrapper">
                                                            <span>$</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={rule.price_per_inch_height}
                                                                onChange={(e) => handleRuleChange(rule.thickness_value, 'price_per_inch_height', e.target.value)}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="price-input-wrapper">
                                                            <span>$</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={rule.price_per_inch_length}
                                                                onChange={(e) => handleRuleChange(rule.thickness_value, 'price_per_inch_length', e.target.value)}
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>

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
                    gap: 16px;
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
                .premium-empty-state p {
                    max-width: 300px;
                    font-size: 14px;
                    line-height: 1.5;
                }
                .mb-12 { margin-bottom: 48px; }
            `}</style>
        </div>
    );
}
