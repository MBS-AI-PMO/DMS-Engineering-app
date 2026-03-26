import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Search } from 'lucide-react';
import { fetchSubscribers, deleteSubscriber } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

export default function SubscribersList() {
    const [subscribers, setSubscribers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [search, setSearch] = useState('');
    const toast = useToast();

    useEffect(() => {
        fetchSubscribers()
            .then(setSubscribers)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filtered = subscribers.filter(s =>
        s.email.toLowerCase().includes(search.toLowerCase())
    );

    const handleDelete = async (id) => {
        try {
            await deleteSubscriber(id);
            setSubscribers(prev => prev.filter(s => s.id !== id));
            setConfirmDelete(null);
            toast('Subscriber removed', 'success');
        } catch (err) {
            toast('Delete failed: ' + err.message, 'error');
        }
    };

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <h1 className="admin-page-title">Newsletter Subscribers</h1>
                <span className="admin-page-count">{subscribers.length} subscriber{subscribers.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="admin-search-bar">
                <Search size={16} />
                <input
                    type="text"
                    placeholder="Search subscribers..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {loading ? (
                [...Array(5)].map((_, i) => <div key={i} className="skeleton skeleton-table-row" />)
            ) : (
                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Email</th>
                                <th>Status</th>
                                <th>Subscribed</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(sub => (
                                <tr key={sub.id}>
                                    <td><strong>{sub.email}</strong></td>
                                    <td>
                                        <span className={`status-badge ${sub.status}`}>
                                            {sub.status}
                                        </span>
                                    </td>
                                    <td className="table-cell-muted">{new Date(sub.subscribed_at).toLocaleDateString()}</td>
                                    <td>
                                        <div className="table-actions">
                                            <button className="admin-icon-btn danger" onClick={() => setConfirmDelete(sub)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filtered.length === 0 && <div className="admin-empty">No subscribers found.</div>}
                </div>
            )}

            {/* Delete confirmation */}
            <AnimatePresence>
                {confirmDelete && (
                    <motion.div className="admin-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmDelete(null)}>
                        <motion.div className="admin-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                            <h3>Remove "{confirmDelete.email}"?</h3>
                            <p>This subscriber will be permanently removed.</p>
                            <div className="admin-modal-actions">
                                <button className="admin-btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
                                <button className="admin-btn-danger" onClick={() => handleDelete(confirmDelete.id)}>Remove</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
