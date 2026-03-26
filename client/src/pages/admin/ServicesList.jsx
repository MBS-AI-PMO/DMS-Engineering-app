/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, Save, X, Search, Upload } from 'lucide-react';
import { fetchServices, createService, updateService, deleteService, fetchServicesWithUsage, uploadServiceImage } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import ImageModal from '../../components/admin/ImageModal';

const empty = { title: '', description: '', image_path: '', display_order: 0 };

export default function ServicesList() {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(empty);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [zoomedImage, setZoomedImage] = useState(null);
    const [uploading, setUploading] = useState(false);
    const toast = useToast();

    useEffect(() => {
        fetchServicesWithUsage()
            .then(setServices)
            .catch(() => {
                // Fallback to basic services if usage endpoint unavailable
                fetchServices().then(setServices).catch(console.error);
            })
            .finally(() => setLoading(false));
    }, []);

    const filtered = services.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase())
    );

    const openNew = () => { setEditing('new'); setForm(empty); };
    const openEdit = (svc) => { setEditing(svc); setForm({ ...svc }); };
    const closeEdit = () => { setEditing(null); setForm(empty); };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (editing === 'new') {
                const { data } = await createService(form);
                setServices(prev => [...prev, data]);
            } else {
                const { data } = await updateService(editing.id, form);
                setServices(prev => prev.map(s => s.id === data.id ? data : s));
            }
            closeEdit();
            toast(editing === 'new' ? 'Service created' : 'Service updated', 'success');
        } catch (err) {
            toast('Save failed: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteService(id);
            setServices(prev => prev.filter(s => s.id !== id));
            setConfirmDelete(null);
            toast('Service deleted', 'success');
        } catch (err) {
            toast('Delete failed: ' + err.message, 'error');
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const { data } = await uploadServiceImage(file);
            setForm(f => ({ ...f, image_path: data.path }));
            toast('Image uploaded successfully', 'success');
        } catch (err) {
            toast('Upload failed: ' + err.message, 'error');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <h1 className="admin-page-title">Services</h1>
                <button className="admin-btn-primary" onClick={openNew}>
                    <Plus size={16} /> Add Service
                </button>
            </div>

            <div className="admin-search-bar">
                <Search size={16} />
                <input
                    type="text"
                    placeholder="Search services..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {loading ? (
                [...Array(6)].map((_, i) => <div key={i} className="skeleton skeleton-table-row" />)
            ) : (
                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Description</th>
                                <th>Image</th>
                                <th>Metals</th>
                                <th>Order</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(svc => (
                                <tr key={svc.id}>
                                    <td><strong>{svc.title}</strong></td>
                                    <td className="table-cell-muted">{svc.description?.substring(0, 60)}{svc.description?.length > 60 ? '...' : ''}</td>
                                    <td>
                                        {svc.image_path ? (
                                            <img
                                                src={svc.image_path}
                                                alt={svc.title}
                                                className="table-thumb"
                                                onClick={() => setZoomedImage({ src: svc.image_path, title: svc.title })}
                                            />
                                        ) : (
                                            <span className="table-cell-muted">—</span>
                                        )}
                                    </td>
                                    <td>
                                        <span style={{
                                            background: parseInt(svc.metal_count) > 0 ? '#ecfdf5' : '#f3f4f6',
                                            color: parseInt(svc.metal_count) > 0 ? '#065f46' : '#6b7280',
                                            borderRadius: 12,
                                            padding: '2px 8px',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                        }}>
                                            {svc.metal_count != null ? svc.metal_count : '—'}
                                        </span>
                                    </td>
                                    <td>{svc.display_order}</td>
                                    <td>
                                        <div className="table-actions">
                                            <button className="admin-icon-btn" onClick={() => openEdit(svc)}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button className="admin-icon-btn danger" onClick={() => setConfirmDelete(svc)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filtered.length === 0 && <div className="admin-empty">No services found.</div>}
                </div>
            )}

            {/* Edit / New modal */}
            <AnimatePresence>
                {editing !== null && (
                    <motion.div className="admin-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeEdit}>
                        <motion.div className="admin-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                            <div className="admin-modal-header">
                                <h3>{editing === 'new' ? 'New Service' : 'Edit Service'}</h3>
                                <button className="admin-icon-btn" onClick={closeEdit}><X size={16} /></button>
                            </div>
                            <div className="admin-form-group">
                                <label>Title</label>
                                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Service title" />
                            </div>
                            <div className="admin-form-group">
                                <label>Description</label>
                                <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Service description" />
                            </div>
                            <div className="admin-form-group">
                                <label>Image Path & Upload</label>
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="text"
                                                value={form.image_path}
                                                onChange={e => setForm(f => ({ ...f, image_path: e.target.value }))}
                                                placeholder="/uploads/services/service-1.png"
                                                style={{ flex: 1 }}
                                            />
                                            <label className="admin-btn-secondary" style={{ cursor: 'pointer', height: '42px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Upload size={16} />
                                                {uploading ? '...' : 'Upload'}
                                                <input
                                                    type="file"
                                                    style={{ display: 'none' }}
                                                    onChange={handleFileUpload}
                                                    accept="image/*"
                                                    disabled={uploading}
                                                />
                                            </label>
                                        </div>
                                        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                                            Select a file to upload or enter a custom path.
                                        </p>
                                    </div>
                                    {form.image_path && (
                                        <div
                                            className="table-thumb-preview"
                                            style={{
                                                width: '60px',
                                                height: '60px',
                                                borderRadius: '8px',
                                                overflow: 'hidden',
                                                border: '1px solid #e2e8f0',
                                                background: '#f8fafc',
                                                flexShrink: 0,
                                                cursor: 'zoom-in'
                                            }}
                                            onClick={() => setZoomedImage({ src: form.image_path, title: 'Preview' })}
                                        >
                                            <img
                                                src={form.image_path}
                                                alt="Preview"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="admin-form-group">
                                <label>Display Order</label>
                                <input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} />
                            </div>
                            <div className="admin-modal-actions">
                                <button className="admin-btn-secondary" onClick={closeEdit}><X size={14} /> Cancel</button>
                                <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>
                                    <Save size={14} /> {saving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete confirmation */}
            <AnimatePresence>
                {confirmDelete && (
                    <motion.div className="admin-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmDelete(null)}>
                        <motion.div className="admin-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                            <h3>Delete "{confirmDelete.title}"?</h3>
                            <p>This action cannot be undone.</p>
                            <div className="admin-modal-actions">
                                <button className="admin-btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
                                <button className="admin-btn-danger" onClick={() => handleDelete(confirmDelete.id)}>Delete</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <ImageModal
                src={zoomedImage?.src}
                alt={zoomedImage?.title}
                onClose={() => setZoomedImage(null)}
            />
        </div>
    );
}
