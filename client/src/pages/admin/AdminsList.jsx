import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';  // eslint-disable-line no-unused-vars
import { Plus, Trash2, Edit2, Save, X, AlertTriangle } from 'lucide-react';
import { fetchAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

const empty = { name: '', email: '', password: '', confirmPassword: '' };

export default function AdminsList() {
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(empty);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const toast = useToast();

    useEffect(() => {
        fetchAdminUsers()
            .then(setAdmins)
            .catch(err => toast('Failed to load admins: ' + err.message, 'error'))
            .finally(() => setLoading(false));
    }, [toast]);

    const openNew = () => { setEditing('new'); setForm(empty); setFormError(''); };
    const openEdit = (admin) => {
        setEditing(admin);
        setForm({ name: admin.name || '', email: admin.email || '', password: '', confirmPassword: '' });
        setFormError('');
    };
    const closeEdit = () => { setEditing(null); setForm(empty); setFormError(''); };

    const validate = () => {
        if (!form.email) return 'Email is required';
        if (editing === 'new' && !form.password) return 'Password is required';
        if (form.password && form.password.length < 6) return 'Password must be at least 6 characters';
        if (form.password && form.password !== form.confirmPassword) return 'Passwords do not match';
        return null;
    };

    const handleSave = async () => {
        const err = validate();
        if (err) { setFormError(err); return; }

        setSaving(true);
        setFormError('');
        try {
            const payload = { name: form.name, email: form.email };
            if (form.password) payload.password = form.password;

            if (editing === 'new') {
                const { data } = await createAdminUser(payload);
                setAdmins(prev => [...prev, data]);
            } else {
                const { data } = await updateAdminUser(editing.id, payload);
                setAdmins(prev => prev.map(a => a.id === data.id ? data : a));
            }
            closeEdit();
            toast(editing === 'new' ? 'Admin created' : 'Admin updated', 'success');
        } catch (err) {
            toast('Save failed: ' + err.message, 'error');
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteAdminUser(id);
            setAdmins(prev => prev.filter(a => a.id !== id));
            setConfirmDelete(null);
            toast('Admin deleted', 'success');
        } catch (err) {
            toast('Delete failed: ' + err.message, 'error');
            setConfirmDelete(null);
        }
    };

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <h1 className="admin-page-title">Admins</h1>
                <button className="admin-btn-primary" onClick={openNew}>
                    <Plus size={16} /> Add Admin
                </button>
            </div>

            {loading ? (
                [...Array(3)].map((_, i) => <div key={i} className="skeleton skeleton-table-row" />)
            ) : (
                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Created</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {admins.map(admin => (
                                <tr key={admin.id}>
                                    <td><strong>{admin.name || '—'}</strong></td>
                                    <td>{admin.email}</td>
                                    <td className="table-cell-muted">{new Date(admin.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <div className="table-actions">
                                            <button className="admin-icon-btn" onClick={() => openEdit(admin)}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button className="admin-icon-btn danger" onClick={() => setConfirmDelete(admin)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {admins.length === 0 && <div className="admin-empty">No admin accounts found.</div>}
                </div>
            )}

            {/* Edit / New modal */}
            <AnimatePresence>
                {editing !== null && (
                    <motion.div className="admin-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeEdit}>
                        <motion.div className="admin-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                            <div className="admin-modal-header">
                                <h3>{editing === 'new' ? 'New Admin' : 'Edit Admin'}</h3>
                                <button className="admin-icon-btn" onClick={closeEdit}><X size={16} /></button>
                            </div>
                            {formError && <div className="admin-modal-error">{formError}</div>}
                            <div className="admin-form-group">
                                <label>Name</label>
                                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
                            </div>
                            <div className="admin-form-group">
                                <label>Email</label>
                                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="admin@example.com" />
                            </div>
                            <div className="admin-form-group">
                                <label>{editing === 'new' ? 'Password' : 'New Password (leave blank to keep)'}</label>
                                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={editing === 'new' ? 'Min 6 characters' : 'Leave blank to keep current'} />
                            </div>
                            {form.password && (
                                <div className="admin-form-group">
                                    <label>Confirm Password</label>
                                    <input type="password" value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} placeholder="Confirm password" />
                                </div>
                            )}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <AlertTriangle size={20} color="#dc2626" />
                                <h3>Delete admin "{confirmDelete.email}"?</h3>
                            </div>
                            <p>This will permanently remove this admin account. This action cannot be undone.</p>
                            <div className="admin-modal-actions">
                                <button className="admin-btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
                                <button className="admin-btn-danger" onClick={() => handleDelete(confirmDelete.id)}>Delete Admin</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
