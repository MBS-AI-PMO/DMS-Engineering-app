import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';  // eslint-disable-line no-unused-vars
import { Plus, Trash2, Edit2, Save, X, Search } from 'lucide-react';
import { fetchFaqs, fetchFaqCategories, createFaq, updateFaq, deleteFaq } from '../../utils/api';
import { TableRowSkeleton } from '../../components/admin/AdminSkeletons';
import { useToast } from '../../context/ToastContext';

const empty = { question: '', answer: '', category_id: '', display_order: 0 };

export default function FaqsList() {
    const [faqs, setFaqs] = useState([]);
    const [faqCategories, setFaqCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterCat, setFilterCat] = useState('');
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(empty);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [saving, setSaving] = useState(false);
    const toast = useToast();

    useEffect(() => {
        Promise.all([fetchFaqs(), fetchFaqCategories()])
            .then(([f, c]) => { setFaqs(f); setFaqCategories(c); })
            .catch(err => toast('Failed to load FAQs: ' + err.message, 'error'))
            .finally(() => setLoading(false));
    }, [toast]);

    const filtered = faqs.filter(f => {
        const matchSearch = f.question.toLowerCase().includes(search.toLowerCase());
        const matchCat = !filterCat || String(f.category_id) === filterCat;
        return matchSearch && matchCat;
    });

    const openNew = () => { setEditing('new'); setForm(empty); };
    const openEdit = (faq) => { setEditing(faq); setForm({ ...faq }); };
    const closeEdit = () => { setEditing(null); setForm(empty); };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (editing === 'new') {
                const { data } = await createFaq(form);
                setFaqs(prev => [...prev, data]);
            } else {
                const { data } = await updateFaq(editing.id, form);
                setFaqs(prev => prev.map(f => f.id === data.id ? data : f));
            }
            closeEdit();
            toast('FAQ saved successfully', 'success');
        } catch (err) {
            toast('Save failed: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteFaq(id);
            setFaqs(prev => prev.filter(f => f.id !== id));
            setConfirmDelete(null);
            toast('FAQ deleted', 'success');
        } catch (err) {
            toast('Delete failed: ' + err.message, 'error');
        }
    };

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <h1 className="admin-page-title">FAQs</h1>
                <button className="admin-btn-primary" onClick={openNew}>
                    <Plus size={16} /> Add FAQ
                </button>
            </div>

            <div className="admin-toolbar">
                <div className="admin-search">
                    <Search size={16} />
                    <input type="text" placeholder="Search questions…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="admin-filter-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                    <option value="">All Categories</option>
                    {faqCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            <div className="admin-table-wrapper">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Question</th>
                            <th>Category</th>
                            <th>Order</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <TableRowSkeleton columns={3} rows={8} />
                        ) : (
                            filtered.map(faq => (
                                <tr key={faq.id}>
                                    <td className="table-cell-truncate">{faq.question}</td>
                                    <td className="table-cell-muted">
                                        {faqCategories.find(c => c.id === faq.category_id)?.name || '—'}
                                    </td>
                                    <td>{faq.display_order}</td>
                                    <td>
                                        <div className="table-actions">
                                            <button className="admin-icon-btn" onClick={() => openEdit(faq)}><Edit2 size={16} /></button>
                                            <button className="admin-icon-btn danger" onClick={() => setConfirmDelete(faq)}><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                {!loading && filtered.length === 0 && <div className="admin-empty">No FAQs found.</div>}
            </div>

            <AnimatePresence>
                {editing !== null && (
                    <motion.div className="admin-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeEdit}>
                        <motion.div className="admin-modal admin-modal-wide" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                            <div className="admin-modal-header">
                                <h3>{editing === 'new' ? 'New FAQ' : 'Edit FAQ'}</h3>
                                <button className="admin-icon-btn" onClick={closeEdit}><X size={16} /></button>
                            </div>
                            <div className="admin-form-group">
                                <label>Category</label>
                                <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                                    <option value="">— Select —</option>
                                    {faqCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="admin-form-group">
                                <label>Question</label>
                                <input type="text" value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} />
                            </div>
                            <div className="admin-form-group">
                                <label>Answer</label>
                                <textarea rows={5} value={form.answer} onChange={e => setForm(f => ({ ...f, answer: e.target.value }))} />
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
                            <h3>Delete this FAQ?</h3>
                            <p className="table-cell-truncate">{confirmDelete.question}</p>
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
