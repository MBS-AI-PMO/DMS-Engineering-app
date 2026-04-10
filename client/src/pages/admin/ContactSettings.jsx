import { useState, useEffect } from 'react';
import { Save, Phone, Mail, MapPin, Linkedin, Facebook, Instagram, Loader2, Trash2 } from 'lucide-react';
import { fetchSettings, updateSetting, fetchMetals } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

export default function ContactSettings() {
    const [settings, setSettings] = useState({
        footer_contact: { phone: '', email: '', address: '' },
        social_links: [],
        top_metals: []
    });
    const [allMetals, setAllMetals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const toast = useToast();

    useEffect(() => {
        Promise.all([fetchSettings(), fetchMetals()])
            .then(([data, metals]) => {
                if (data.footer_contact || data.social_links || data.top_metals) {
                    setSettings(prev => ({
                        ...prev,
                        footer_contact: data.footer_contact || prev.footer_contact,
                        social_links: data.social_links || prev.social_links,
                        top_metals: data.top_metals || prev.top_metals
                    }));
                }
                setAllMetals(Array.isArray(metals) ? metals : []);
            })
            .catch(err => toast('Failed to load settings: ' + err.message, 'error'))
            .finally(() => setLoading(false));
    }, [toast]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateSetting('footer_contact', settings.footer_contact);
            await updateSetting('social_links', settings.social_links);
            await updateSetting('top_metals', settings.top_metals);
            toast('Settings saved successfully', 'success');
        } catch (err) {
            toast('Failed to save: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const addTopMetal = (slug) => {
        if (!slug) return;
        const metal = allMetals.find(m => m.slug === slug);
        if (!metal) return;
        if ((settings.top_metals || []).some(m => m.slug === slug)) return; // no duplicates
        setSettings(prev => ({
            ...prev,
            top_metals: [...(prev.top_metals || []), { name: metal.name, slug: metal.slug }]
        }));
    };

    const removeTopMetal = (index) => {
        setSettings(prev => ({ ...prev, top_metals: prev.top_metals.filter((_, i) => i !== index) }));
    };

    const updateContact = (field, value) => {
        setSettings(prev => ({
            ...prev,
            footer_contact: { ...prev.footer_contact, [field]: value }
        }));
    };

    const updateSocial = (index, value) => {
        const newSocials = [...settings.social_links];
        newSocials[index] = { ...newSocials[index], url: value };
        setSettings(prev => ({ ...prev, social_links: newSocials }));
    };

    const toggleSocial = (index) => {
        const newSocials = [...settings.social_links];
        newSocials[index] = { ...newSocials[index], enabled: !newSocials[index].enabled };
        setSettings(prev => ({ ...prev, social_links: newSocials }));
    };

    // Metals not yet added
    const availableMetals = allMetals.filter(
        m => !(settings.top_metals || []).some(tm => tm.slug === m.slug)
    );

    const FieldSkeleton = ({ height = 42 }) => (
        <div className="skeleton-box" style={{ width: '100%', height }} />
    );

    return (
        <div className="admin-page text-navy">
            <div className="admin-page-header">
                <div>
                    <h1 className="admin-page-title">Contact & Footer Settings</h1>
                    <p className="admin-page-subtitle">Update your site's contact information and social links</p>
                </div>
                <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 size={18} className="spin" /> : <Save size={18} />}
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <div className="admin-form-container" style={{ maxWidth: 800 }}>
                {/* Contact Info */}
                <div className="admin-section-card">
                    <div className="admin-section-header">
                        <h3 className="admin-section-title">Footer Contact Info</h3>
                    </div>
                    <div className="admin-form-grid">
                        <div className="admin-form-group">
                            <label><Phone size={14} /> Phone Number</label>
                            {loading ? <FieldSkeleton /> : (
                                <input type="text" value={settings.footer_contact.phone}
                                    onChange={e => updateContact('phone', e.target.value)}
                                    placeholder="+1 (555) 000-0000" />
                            )}
                        </div>
                        <div className="admin-form-group">
                            <label><Mail size={14} /> Email Address</label>
                            {loading ? <FieldSkeleton /> : (
                                <input type="email" value={settings.footer_contact.email}
                                    onChange={e => updateContact('email', e.target.value)}
                                    placeholder="info@dms-metals.com" />
                            )}
                        </div>
                        <div className="admin-form-group full-width">
                            <label><MapPin size={14} /> Physical Address</label>
                            {loading ? <FieldSkeleton /> : (
                                <input type="text" value={settings.footer_contact.address}
                                    onChange={e => updateContact('address', e.target.value)}
                                    placeholder="1234 Metal St, Precision City" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Top Metals */}
                <div className="admin-section-card" style={{ marginTop: 24 }}>
                    <div className="admin-section-header">
                        <div>
                            <h3 className="admin-section-title">Top Metals (Footer)</h3>
                            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                                Shown in the "Top Metals" column of the site footer.
                            </p>
                        </div>
                    </div>

                    {/* Picker dropdown */}
                    {!loading && availableMetals.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: 4 }}>
                            <select
                                defaultValue=""
                                onChange={e => { addTopMetal(e.target.value); e.target.value = ''; }}
                                style={{ flex: 1, padding: '9px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, color: '#0f172a', background: '#f8fafc', cursor: 'pointer', outline: 'none' }}
                            >
                                <option value="" disabled>+ Select a metal to add…</option>
                                {availableMetals.map(m => (
                                    <option key={m.slug} value={m.slug}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Selected metals list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {loading ? [1, 2, 3].map(i => (
                            <div key={i} className="skeleton-box" style={{ height: 44, borderRadius: 10 }} />
                        )) : (settings.top_metals || []).length === 0 ? (
                            <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '20px 0', margin: 0 }}>
                                No metals added yet. Select from the dropdown above.
                            </p>
                        ) : (settings.top_metals || []).map((metal, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                                    <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{metal.name}</span>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', fontFamily: 'monospace' }}>{metal.slug}</span>
                                </div>
                                <button onClick={() => removeTopMetal(i)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Social Links */}
                <div className="admin-section-card" style={{ marginTop: 24 }}>
                    <div className="admin-section-header">
                        <h3 className="admin-section-title">Social Media Links</h3>
                    </div>
                    <div className="admin-social-list">
                        {loading ? [1, 2, 3].map(i => (
                            <div key={i} className="admin-social-row">
                                <div className="skeleton-box" style={{ width: 40, height: 40, borderRadius: 10 }} />
                                <div className="admin-form-group" style={{ flex: 1, marginBottom: 0 }}>
                                    <FieldSkeleton />
                                </div>
                                <div className="skeleton-box" style={{ width: 60, height: 40, borderRadius: 8 }} />
                            </div>
                        )) : settings.social_links.map((social, i) => (
                            <div key={social.platform} className="admin-social-row">
                                <div className="admin-social-icon-wrapper">
                                    {social.platform === 'linkedin' && <Linkedin size={20} />}
                                    {social.platform === 'facebook' && <Facebook size={20} />}
                                    {social.platform === 'instagram' && <Instagram size={20} />}
                                </div>
                                <div className="admin-form-group" style={{ flex: 1, marginBottom: 0 }}>
                                    <input type="text" value={social.url}
                                        onChange={e => updateSocial(i, e.target.value)}
                                        placeholder={`https://${social.platform}.com/...`} />
                                </div>
                                <div className="admin-social-toggle">
                                    <label className="switch">
                                        <input type="checkbox" checked={social.enabled} onChange={() => toggleSocial(i)} />
                                        <span className="slider round"></span>
                                    </label>
                                    <span style={{ fontSize: 12, color: '#64748b' }}>
                                        {social.enabled ? 'Enabled' : 'Disabled'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style>{`
                .admin-social-row { display:flex; align-items:center; gap:16px; padding:16px; background:#f8fafc; border-radius:12px; margin-bottom:12px; border:1px solid #e2e8f0; }
                .admin-social-icon-wrapper { width:40px; height:40px; background:#fff; border-radius:10px; display:flex; align-items:center; justify-content:center; color:#6366f1; box-shadow:0 2px 8px rgba(0,0,0,0.04); }
                .admin-social-toggle { display:flex; flex-direction:column; align-items:center; gap:4px; min-width:60px; }
                .switch { position:relative; display:inline-block; width:34px; height:20px; }
                .switch input { opacity:0; width:0; height:0; }
                .slider { position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:#ccc; transition:.4s; }
                .slider:before { position:absolute; content:""; height:14px; width:14px; left:3px; bottom:3px; background-color:white; transition:.4s; }
                input:checked + .slider { background-color:#6366f1; }
                input:checked + .slider:before { transform:translateX(14px); }
                .slider.round { border-radius:20px; }
                .slider.round:before { border-radius:50%; }
            `}</style>
        </div>
    );
}
