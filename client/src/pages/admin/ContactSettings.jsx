import { useState, useEffect, useRef } from 'react';
import { Save, Phone, Mail, MapPin, Linkedin, Facebook, Instagram, Loader2, Trash2, UploadCloud, Image as ImageIcon } from 'lucide-react';
import { fetchSettings, updateSetting, fetchMetals, uploadSettingLogo } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

export default function ContactSettings() {
    const [settings, setSettings] = useState({
        footer_contact: { phone: '', email: '', address: '' },
        social_links: [],
        top_metals: [],
        navbar_logo: '',
        footer_logo: '',
        site_logo: '',
        hero_image: ''
    });
    const [uploading, setUploading] = useState({ navbar: false, footer: false, site: false, hero: false });
    const navbarInputRef = useRef(null);
    const footerInputRef = useRef(null);
    const siteInputRef = useRef(null);
    const heroInputRef = useRef(null);
    const [allMetals, setAllMetals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const toast = useToast();

    useEffect(() => {
        Promise.all([fetchSettings(), fetchMetals()])
            .then(([data, metals]) => {
                setSettings(prev => ({
                    ...prev,
                    footer_contact: data.footer_contact || prev.footer_contact,
                    social_links: data.social_links || prev.social_links,
                    top_metals: data.top_metals || prev.top_metals,
                    navbar_logo: data.navbar_logo || '',
                    footer_logo: data.footer_logo || '',
                    site_logo: data.site_logo || '',
                    hero_image: data.hero_image || ''
                }));
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

    const handleLogoUpload = async (key, file) => {
        if (!file) return;
        const uploadKey = key.split('_')[0]; // navbar, footer, site
        setUploading(prev => ({ ...prev, [uploadKey]: true }));
        try {
            const logoPath = await uploadSettingLogo(key, file);
            setSettings(prev => ({ ...prev, [key]: logoPath }));
            toast(`${key.replace('_', ' ')} updated successfully`, 'success');
        } catch (err) {
            toast(`Failed to upload logo: ${err.message}`, 'error');
        } finally {
            setUploading(prev => ({ ...prev, [uploadKey]: false }));
        }
    };

    const removeLogo = async (key) => {
        try {
            await updateSetting(key, '');
            setSettings(prev => ({ ...prev, [key]: '' }));
            toast(`${key.replace('_', ' ')} removed`, 'success');
        } catch (err) {
            toast(`Failed to remove logo: ${err.message}`, 'error');
        }
    };

    const resolveImagePreview = (value) => {
        if (!value) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'object') {
            return value.avif || value.webp || value.jpg || value.jpeg || value.png || value.src || '';
        }
        return '';
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

            <div className="admin-form-container" style={{ maxWidth: 1100 }}>
                <div className="admin-settings-grid">
                    <div className="admin-settings-main">
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

                    <div className="admin-settings-side">
                        {/* Logo Management */}
                        <div className="admin-section-card">
                            <div className="admin-section-header">
                                <h3 className="admin-section-title">Website Logos</h3>
                                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                                    Update site logos. PNG, SVG, or WebP.
                                </p>
                            </div>

                            <div className="logo-upload-vertical">
                                {/* Navbar Logo */}
                                <div className="logo-upload-item">
                                    <label>Navbar Logo (H: 64px)</label>
                                    <div className="logo-preview-box">
                                        {settings.navbar_logo ? (
                                            <div className="preview-container">
                                                <img src={settings.navbar_logo} alt="Navbar Logo" />
                                                <button className="remove-logo-btn" onClick={() => removeLogo('navbar_logo')}><Trash2 size={14} /></button>
                                            </div>
                                        ) : (
                                            <div className="empty-preview" onClick={() => navbarInputRef.current?.click()}>
                                                <UploadCloud size={24} />
                                                <span>Upload Navbar Logo</span>
                                            </div>
                                        )}
                                        {uploading.navbar && <div className="upload-overlay"><Loader2 className="spin" /></div>}
                                    </div>
                                    <input type="file" ref={navbarInputRef} hidden onChange={e => handleLogoUpload('navbar_logo', e.target.files[0])} accept="image/*" />
                                    <button className="admin-btn-secondary full-width" onClick={() => navbarInputRef.current?.click()} disabled={uploading.navbar}>
                                        <UploadCloud size={16} /> Choose Image
                                    </button>
                                </div>

                                {/* Footer Logo */}
                                <div className="logo-upload-item">
                                    <label>Footer Logo (H: 70px)</label>
                                    <div className="logo-preview-box dark">
                                        {settings.footer_logo ? (
                                            <div className="preview-container">
                                                <img src={settings.footer_logo} alt="Footer Logo" />
                                                <button className="remove-logo-btn" onClick={() => removeLogo('footer_logo')}><Trash2 size={14} /></button>
                                            </div>
                                        ) : (
                                            <div className="empty-preview" onClick={() => footerInputRef.current?.click()}>
                                                <UploadCloud size={24} />
                                                <span>Upload Footer Logo</span>
                                            </div>
                                        )}
                                        {uploading.footer && <div className="upload-overlay"><Loader2 className="spin" /></div>}
                                    </div>
                                    <input type="file" ref={footerInputRef} hidden onChange={e => handleLogoUpload('footer_logo', e.target.files[0])} accept="image/*" />
                                    <button className="admin-btn-secondary full-width" onClick={() => footerInputRef.current?.click()} disabled={uploading.footer}>
                                        <UploadCloud size={16} /> Choose Image
                                    </button>
                                </div>

                                {/* Site Logo */}
                                <div className="logo-upload-item">
                                    <label>Site Identity / Favicon</label>
                                    <div className="logo-preview-box small">
                                        {settings.site_logo ? (
                                            <div className="preview-container">
                                                <img src={settings.site_logo} alt="Site Logo" />
                                                <button className="remove-logo-btn" onClick={() => removeLogo('site_logo')}><Trash2 size={14} /></button>
                                            </div>
                                        ) : (
                                            <div className="empty-preview" onClick={() => siteInputRef.current?.click()}>
                                                <ImageIcon size={24} />
                                                <span>Upload Icon</span>
                                            </div>
                                        )}
                                        {uploading.site && <div className="upload-overlay"><Loader2 className="spin" /></div>}
                                    </div>
                                    <input type="file" ref={siteInputRef} hidden onChange={e => handleLogoUpload('site_logo', e.target.files[0])} accept="image/*" />
                                    <button className="admin-btn-secondary full-width" onClick={() => siteInputRef.current?.click()} disabled={uploading.site}>
                                        <UploadCloud size={16} /> Choose Icon
                                    </button>
                                </div>

                                {/* Hero Image */}
                                <div className="logo-upload-item">
                                    <label>Homepage Hero Image (Auto-Optimized)</label>
                                    <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 8px' }}>
                                        Upload once. It is automatically optimized to AVIF/WebP/JPG and saved in DB under hero_image.
                                    </p>
                                    <div className="logo-preview-box" style={{ height: 150 }}>
                                        {resolveImagePreview(settings.hero_image) ? (
                                            <div className="preview-container">
                                                <img src={resolveImagePreview(settings.hero_image)} alt="Hero" style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                                                <button className="remove-logo-btn" onClick={() => removeLogo('hero_image')}><Trash2 size={14} /></button>
                                            </div>
                                        ) : (
                                            <div className="empty-preview" onClick={() => heroInputRef.current?.click()}>
                                                <ImageIcon size={24} />
                                                <span>Upload Hero Image</span>
                                            </div>
                                        )}
                                        {uploading.hero && <div className="upload-overlay"><Loader2 className="spin" /></div>}
                                    </div>
                                    <input type="file" ref={heroInputRef} hidden onChange={e => handleLogoUpload('hero_image', e.target.files[0])} accept="image/*" />
                                    <button className="admin-btn-secondary full-width" onClick={() => heroInputRef.current?.click()} disabled={uploading.hero}>
                                        <UploadCloud size={16} /> Choose Hero Image
                                    </button>
                                </div>
                            </div>
                        </div>
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
                .slider.round:before { border-radius: 50%; }

                .admin-settings-grid { display: grid; grid-template-columns: 1fr 340px; gap: 24px; align-items: start; }
                .admin-settings-side { position: sticky; top: 24px; }
                
                .logo-upload-vertical { display: flex; flex-direction: column; gap: 24px; margin-top: 16px; }
                .logo-upload-item { display: flex; flex-direction: column; gap: 8px; }
                .logo-upload-item label { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
                .logo-preview-box { height: 110px; background: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 12px; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; transition: all 0.2s; }
                .logo-preview-box.dark { background: #0f172a; border-color: #1e293b; }
                .logo-preview-box.small { height: 90px; width: 90px; margin: 0 auto; }
                .logo-preview-box:hover { border-color: #6366f1; background: #f1f5f9; }
                .logo-preview-box.dark:hover { background: #1e293b; }
                .empty-preview { display: flex; flex-direction: column; align-items: center; gap: 6px; color: #94a3b8; cursor: pointer; text-align: center; padding: 10px; }
                .empty-preview span { font-size: 10px; font-weight: 700; text-transform: uppercase; }
                .preview-container { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 12px; position: relative; }
                .preview-container img { max-width: 100%; max-height: 100%; object-fit: contain; }
                .remove-logo-btn { position: absolute; top: 6px; right: 6px; background: rgba(239, 68, 68, 0.9); color: white; border: none; width: 22px; height: 22px; border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; z-index: 10; }
                .remove-logo-btn:hover { background: #ef4444; transform: scale(1.1); }
                .upload-overlay { position: absolute; inset: 0; background: rgba(255, 255, 255, 0.8); display: flex; align-items: center; justify-content: center; color: #6366f1; z-index: 5; }
                .logo-preview-box.dark .upload-overlay { background: rgba(15, 23, 42, 0.8); }
                .full-width { width: 100%; }

                @media (max-width: 1024px) {
                    .admin-settings-grid { grid-template-columns: 1fr; }
                    .admin-settings-side { position: static; }
                }
            `}</style>
        </div>
    );
}
