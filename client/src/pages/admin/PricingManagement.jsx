import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';// eslint-disable-line no-unused-vars
import {
    ChevronRight, Save, Loader2, Info, AlertCircle, Check,
    Layers, Wrench, Box, DollarSign, ArrowLeft
} from 'lucide-react';
import { fetchPricingMetadata, fetchPricingRules, savePricingRules } from '../../utils/api';
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

    useEffect(() => {
        const loadMetadata = async () => {
            try {
                const { data } = await fetchPricingMetadata();
                setMetals(data.metals || []);
                setServices(data.services || []);
            } catch (err) {
                toast('Failed to load metadata: ' + err.message, 'error');
            } finally {
                setLoading(false);
            }
        };
        loadMetadata();
    }, [toast]);

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
                                        <img src={metal.image_path} alt={metal.name} />
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
                .admin-loading-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 400px;
                    color: #64748b;
                    gap: 16px;
                }
            `}</style>
        </div>
    );
}
