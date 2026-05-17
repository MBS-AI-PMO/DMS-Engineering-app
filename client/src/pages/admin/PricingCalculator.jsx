import { useState, useEffect } from 'react';
import { Save, Loader2, Check, Wrench, Layers, Grid } from 'lucide-react';
import { fetchSettings, updateSetting } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

export default function PricingCalculator() {
    const toast = useToast();
    const [settings, setSettings] = useState({
        inside_labor_markup: 0,
        material_markup: 0,
        overhead_markup: 0,
        general_markup: 0,
        markup_enabled_services: [] // Array of service titles or IDs
    });
    const [allServices, setAllServices] = useState([]);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [saving, setSaving] = useState(false);

    // Fetch global settings and services on mount
    useEffect(() => {
        const load = async () => {
            setLoadingSettings(true);
            try {
                const [data, svcs] = await Promise.all([
                    fetchSettings(),
                    fetch('/api/services').then(res => res.json())
                ]);

                const newSettings = {
                    inside_labor_markup: data.inside_labor_markup !== undefined ? data.inside_labor_markup : 0,
                    material_markup: data.material_markup !== undefined ? data.material_markup : 0,
                    overhead_markup: data.overhead_markup !== undefined ? data.overhead_markup : 0,
                    general_markup: data.general_markup !== undefined ? data.general_markup : 0,
                    markup_enabled_services: Array.isArray(data.markup_enabled_services) ? data.markup_enabled_services : []
                };
                setSettings(newSettings);
                setAllServices(svcs.data || []);
            } catch (err) {
                toast('Failed to load settings: ' + err.message, 'error');
            } finally {
                setLoadingSettings(false);
            }
        };
        load();
    }, [toast]);

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await Promise.all([
                updateSetting('inside_labor_markup', settings.inside_labor_markup),
                updateSetting('material_markup', settings.material_markup),
                updateSetting('overhead_markup', settings.overhead_markup),
                updateSetting('general_markup', settings.general_markup),
                updateSetting('markup_enabled_services', settings.markup_enabled_services),
            ]);
            toast('Pricing settings saved successfully', 'success');
        } catch (err) {
            toast('Failed to save: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const toggleServiceMarkup = (serviceTitle) => {
        setSettings(prev => {
            const current = [...(prev.markup_enabled_services || [])];
            const idx = current.indexOf(serviceTitle);
            if (idx >= 0) current.splice(idx, 1);
            else current.push(serviceTitle);
            return { ...prev, markup_enabled_services: current };
        });
    };

    return (
        <div className="admin-page">
            <header className="admin-page-header">
                <div>
                    <h1 className="admin-page-title">Markups</h1>
                    <p className="admin-page-subtitle">Configure global labor and material markups</p>
                </div>
            </header>

            <div className="price-calc-wrapper">
                {/* Global Pricing Settings Card */}
                <div
                    className="price-calc-card premium"
                    style={{ border: '1px solid #e2e8f0', overflow: 'hidden', padding: 0 }}
                >
                    <div className="calc-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', background: '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ padding: '8px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '10px' }}>
                                <Save size={20} style={{ color: '#6366f1', display: 'block' }} />
                            </div>
                            <h2 className="calc-card-title" style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: 0 }}>Markups</h2>
                        </div>
                        <button
                            onClick={handleSaveSettings}
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
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '40px' }}>

                            {/* LABOR SECTION */}
                            <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                                    <div style={{ padding: '6px', background: '#e0e7ff', color: '#4338ca', borderRadius: '8px' }}>
                                        <Wrench size={16} />
                                    </div>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Labor Markups</h3>
                                </div>

                                <div className="calc-input-group" style={{ marginBottom: '32px' }}>
                                    <label className="calc-input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', color: '#475569', marginBottom: '12px' }}>
                                        Inside Labor Markup (%)
                                    </label>
                                    {loadingSettings ? (
                                        <div className="skeleton-box" style={{ width: '100%', height: '48px', borderRadius: '12px' }} />
                                    ) : (
                                        <div className="input-with-unit" style={{ position: 'relative', display: 'flex', alignItems: 'center', maxWidth: '400px' }}>
                                            <input
                                                type="number"
                                                className="calc-input-field"
                                                value={settings.inside_labor_markup}
                                                onChange={(e) => setSettings(p => ({ ...p, inside_labor_markup: parseFloat(e.target.value) || 0 }))}
                                                placeholder="0"
                                                style={{
                                                    width: '100%',
                                                    padding: '12px 16px',
                                                    paddingRight: '45px',
                                                    fontSize: '16px',
                                                    fontWeight: '600',
                                                    color: '#1e293b',
                                                    background: '#f8fafc',
                                                    border: '2px solid #e2e8f0',
                                                    borderRadius: '12px',
                                                    outline: 'none',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            />
                                            <span style={{ position: 'absolute', right: '16px', fontSize: '16px', fontWeight: '600', color: '#94a3b8' }}>%</span>
                                        </div>
                                    )}
                                </div>

                                <div style={{ paddingTop: '24px', borderTop: '1px dashed #e2e8f0' }}>
                                    <label className="calc-input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: '#64748b', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Apply Labor Markup To:
                                    </label>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                        gap: '10px'
                                    }}>
                                        {allServices.map(svc => (
                                            <div
                                                key={svc.id}
                                                onClick={() => toggleServiceMarkup(svc.title)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    padding: '10px 14px',
                                                    background: (settings.markup_enabled_services || []).includes(svc.title) ? '#f5f7ff' : '#fff',
                                                    border: '1.5px solid',
                                                    borderColor: (settings.markup_enabled_services || []).includes(svc.title) ? '#6366f1' : '#e2e8f0',
                                                    borderRadius: '10px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <div style={{
                                                    width: '18px',
                                                    height: '18px',
                                                    borderRadius: '5px',
                                                    border: '2px solid',
                                                    borderColor: (settings.markup_enabled_services || []).includes(svc.title) ? '#6366f1' : '#cbd5e1',
                                                    background: (settings.markup_enabled_services || []).includes(svc.title) ? '#6366f1' : 'transparent',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'white'
                                                }}>
                                                    {(settings.markup_enabled_services || []).includes(svc.title) && <Check size={12} />}
                                                </div>
                                                <span style={{
                                                    fontSize: '13px',
                                                    fontWeight: '600',
                                                    color: (settings.markup_enabled_services || []).includes(svc.title) ? '#1e293b' : '#64748b'
                                                }}>
                                                    {svc.title}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* MATERIAL SECTION */}
                            <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                                    <div style={{ padding: '6px', background: '#fffbeb', color: '#d97706', borderRadius: '8px' }}>
                                        <Layers size={16} />
                                    </div>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Material Markups</h3>
                                </div>

                                <div className="calc-input-group">
                                    <label className="calc-input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', color: '#475569', marginBottom: '12px' }}>
                                        Global Material Markup (%)
                                    </label>
                                    {loadingSettings ? (
                                        <div className="skeleton-box" style={{ width: '100%', height: '48px', borderRadius: '12px' }} />
                                    ) : (
                                        <div className="input-with-unit" style={{ position: 'relative', display: 'flex', alignItems: 'center', maxWidth: '400px' }}>
                                            <input
                                                type="number"
                                                className="calc-input-field"
                                                value={settings.material_markup}
                                                onChange={(e) => setSettings(p => ({ ...p, material_markup: parseFloat(e.target.value) || 0 }))}
                                                placeholder="0"
                                                style={{
                                                    width: '100%',
                                                    padding: '12px 16px',
                                                    paddingRight: '45px',
                                                    fontSize: '16px',
                                                    fontWeight: '600',
                                                    color: '#1e293b',
                                                    background: '#f8fafc',
                                                    border: '2px solid #e2e8f0',
                                                    borderRadius: '12px',
                                                    outline: 'none',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            />
                                            <span style={{ position: 'absolute', right: '16px', fontSize: '16px', fontWeight: '600', color: '#94a3b8' }}>%</span>
                                        </div>
                                    )}
                                    <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                                        This markup is applied automatically to all material costs.
                                    </p>
                                </div>
                            </div>

                            {/* GLOBAL PRICING SECTION */}
                            <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                                    <div style={{ padding: '6px', background: '#eef2ff', color: '#4f46e5', borderRadius: '8px' }}>
                                        <Grid size={16} />
                                    </div>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Global Pricing Markups</h3>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
                                    <div className="calc-input-group">
                                        <label className="calc-input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', color: '#475569', marginBottom: '12px' }}>
                                            Overhead Markup (%)
                                        </label>
                                        {loadingSettings ? (
                                            <div className="skeleton-box" style={{ width: '100%', height: '48px', borderRadius: '12px' }} />
                                        ) : (
                                            <div className="input-with-unit" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                <input
                                                    type="number"
                                                    className="calc-input-field"
                                                    value={settings.overhead_markup}
                                                    onChange={(e) => setSettings(p => ({ ...p, overhead_markup: parseFloat(e.target.value) || 0 }))}
                                                    placeholder="0"
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px',
                                                        paddingRight: '45px',
                                                        fontSize: '16px',
                                                        fontWeight: '600',
                                                        color: '#1e293b',
                                                        background: '#f8fafc',
                                                        border: '2px solid #e2e8f0',
                                                        borderRadius: '12px',
                                                        outline: 'none',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                />
                                                <span style={{ position: 'absolute', right: '16px', fontSize: '16px', fontWeight: '600', color: '#94a3b8' }}>%</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="calc-input-group">
                                        <label className="calc-input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', color: '#475569', marginBottom: '12px' }}>
                                            General Markup (%)
                                        </label>
                                        {loadingSettings ? (
                                            <div className="skeleton-box" style={{ width: '100%', height: '48px', borderRadius: '12px' }} />
                                        ) : (
                                            <div className="input-with-unit" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                <input
                                                    type="number"
                                                    className="calc-input-field"
                                                    value={settings.general_markup}
                                                    onChange={(e) => setSettings(p => ({ ...p, general_markup: parseFloat(e.target.value) || 0 }))}
                                                    placeholder="0"
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px',
                                                        paddingRight: '45px',
                                                        fontSize: '16px',
                                                        fontWeight: '600',
                                                        color: '#1e293b',
                                                        background: '#f8fafc',
                                                        border: '2px solid #e2e8f0',
                                                        borderRadius: '12px',
                                                        outline: 'none',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                />
                                                <span style={{ position: 'absolute', right: '16px', fontSize: '16px', fontWeight: '600', color: '#94a3b8' }}>%</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <p style={{ margin: '14px 0 0 0', fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                                    These markups apply to the total estimated cost after raw material, inside processing, outside processing, and components are added.
                                </p>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
