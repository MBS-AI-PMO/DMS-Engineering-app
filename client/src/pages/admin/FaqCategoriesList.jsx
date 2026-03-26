import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { fetchFaqCategories, createFaqCategory, updateFaqCategory, deleteFaqCategory } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

const empty = { name: '', slug: '', description: '', display_order: 0 };

export default function FaqCategoriesList() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(empty);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [saving, setSaving] = useState(false);
    const toast = useToast();

    useEffect(() => {
        fetchFaqCategories()
            .then(setCategories)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const openNew = () => { setEditing('new'); setForm(empty); };
    const openEdit = (cat) => { setEditing(cat); setForm({ ...cat }); };
    const closeEdit = () => { setEditing(null); setForm(empty); };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (editing === 'new') {
                const { data } = await createFaqCategory(form);
                setCategories(prev => [...prev, data]);
            } else {
                const { data } = await updateFaqCategory(editing.id, form);
                setCategories(prev => prev.map(c => c.id === data.id ? data : c));
            }
            closeEdit();
        } catch (err) {
            toast('Save failed: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteFaqCategory(id);
            setCategories(prev => prev.filter(c => c.id !== id));
            setConfirmDelete(null);
        } catch (err) {
            toast('Delete failed: ' + err.message, 'error');
        }
    };

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <h1 className="admin-page-title">FAQ Categories</h1>
                <button className="admin-btn-primary" onClick={openNew}>
                    <Plus size={16} /> Add Category
                </button>
            </div>

            {loading ? (
                [...Array(4)].map((_, i) => <div key={i} className="skeleton skeleton-table-row" />)
            ) : (
                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Slug</th>
                                <th>Order</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map(cat => (
                                <tr key={cat.id}>
                                    <td>{cat.name}</td>
                                    <td className="table-cell-muted">{cat.slug}</td>
                                    <td>{cat.display_order}</td>
                                    <td>
                                        <div className="table-actions">
                                            <button className="admin-icon-btn" onClick={() => openEdit(cat)}><Edit2 size={16} /></button>
                                            <button className="admin-icon-btn danger" onClick={() => setConfirmDelete(cat)}><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {categories.length === 0 && <div className="admin-empty">No FAQ categories yet.</div>}
                </div>
            )}

            <AnimatePresence>
                {editing !== null && (
                    <motion.div className="admin-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeEdit}>
                        <motion.div className="admin-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                            <div className="admin-modal-header">
                                <h3>{editing === 'new' ? 'New FAQ Category' : 'Edit FAQ Category'}</h3>
                                <button className="admin-icon-btn" onClick={closeEdit}><X size={16} /></button>
                            </div>
                            <div className="admin-form-group">
                                <label>Name</label>
                                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                            </div>
                            <div className="admin-form-group">
                                <label>Slug</label>
                                <input type="text" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
                            </div>
                            <div className="admin-form-group">
                                <label>Description</label>
                                <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                            </div>
                            <div className="admin-form-group">
                                <label>Display Order</label>
                                <input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} />
                            </div>
                            <div className="admin-modal-actions">
                                <button className="admin-btn-secondary" onClick={closeEdit}><X size={14} /> Cancel</button>
                                <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>
                                    <Save size={14} /> {saving ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {confirmDelete && (
                    <motion.div className="admin-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmDelete(null)}>
                        <motion.div className="admin-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                            <h3>Delete "{confirmDelete.name}"?</h3>
                            <p>This will not delete the FAQs in this category.</p>
                            <div className="admin-modal-actions">
                                <button className="admin-btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
                                <button className="admin-btn-danger" onClick={() => handleDelete(confirmDelete.id)}>Delete</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
