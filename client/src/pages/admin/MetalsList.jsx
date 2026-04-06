/* eslint-disable no-unused-vars */
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, Filter, Box } from 'lucide-react';
import { fetchMetals, fetchCategories, deleteMetal } from '../../utils/api';
import ImageModal from '../../components/admin/ImageModal';
import { useToast } from '../../context/ToastContext';

export default function MetalsList() {
    const [metals, setMetals] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterCat, setFilterCat] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [zoomedImage, setZoomedImage] = useState(null);
    const toast = useToast();

    useEffect(() => {
        Promise.all([fetchMetals(), fetchCategories()])
            .then(([m, c]) => { setMetals(m); setCategories(c); })
            .catch(err => toast('Failed to load metals: ' + err.message, 'error'))
            .finally(() => setLoading(false));
    }, [toast]);

    const filtered = useMemo(() => {
        return metals.filter(m => {
            const matchSearch = m.name.toLowerCase().includes(search.toLowerCase());
            const matchCat = !filterCat || m.category_id === parseInt(filterCat);
            return matchSearch && matchCat;
        });
    }, [metals, search, filterCat]);

    const handleDelete = async (id) => {
        try {
            await deleteMetal(id);
            setMetals(prev => prev.filter(m => m.id !== id));
            setConfirmDelete(null);
            toast('Metal deleted successfully', 'success');
        } catch (err) {
            toast('Delete failed: ' + err.message, 'error');
        }
    };

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <div>
                    <h1 className="admin-page-title">Metals Catalog</h1>
                    <p className="admin-page-subtitle">Manage and update your material inventory</p>
                </div>
                <Link to="/admin/metals/new" className="admin-btn-primary">
                    <Plus size={18} /> Add New Metal
                </Link>
            </div>

            {/* Quick Metrics */}
            <div className="admin-stats-grid mini">
                <div className="admin-stat-card">
                    <div className="stat-card-icon"><Box size={20} /></div>
                    <div className="stat-card-body">
                        <span className="stat-count">{metals.length}</span>
                        <span className="stat-label">Total Metals</span>
                    </div>
                </div>
                <div className="admin-stat-card mt-3">
                    <div className="stat-card-icon"><Filter size={20} /></div>
                    <div className="stat-card-body">
                        <span className="stat-count">{categories.length}</span>
                        <span className="stat-label">Categories</span>
                    </div>
                </div>
            </div>

            <div className="admin-toolbar premium">
                <div className="admin-search mt-3">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search materials by name or spec…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="admin-filter mt-3">
                    <Filter size={18} />
                    <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                        <option value="">All Categories</option>
                        {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="admin-table-skeleton">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="skeleton skeleton-table-row" />
                    ))}
                </div>
            ) : (
                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th width="30%">Material Name</th>
                                <th width="20%">Slug</th>
                                <th width="15%">Category</th>
                                <th width="20%">Thickness Range</th>
                                <th width="15%"></th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence mode='popLayout'>
                                {filtered.map((metal, idx) => (
                                    <motion.tr
                                        key={metal.id}
                                        layout
                                        initial={{ opacity: 0.8, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <td>
                                            <div className="table-cell-name">
                                                <div className="table-thumb-wrapper">
                                                    {metal.image_path ? (
                                                        <img
                                                            src={metal.image_path}
                                                            alt=""
                                                            className="table-thumb"
                                                            onClick={() => setZoomedImage({ src: metal.image_path, title: metal.name })}
                                                        />
                                                    ) : (
                                                        <Box size={16} className="thumb-placeholder" />
                                                    )}
                                                </div>
                                                <div className="name-group">
                                                    <span className="name-main">{metal.name}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="table-cell-slug">{metal.slug}</span>
                                        </td>
                                        <td>
                                            <span className="admin-tag category">{metal.category_name || 'Uncategorized'}</span>
                                        </td>
                                        <td>
                                            <span className="table-cell-muted">{metal.thickness || '—'}</span>
                                        </td>
                                        <td>
                                            <div className="table-actions">
                                                <Link to={`/admin/metals/${metal.id}`} className="admin-icon-btn" title="Edit Metal">
                                                    <Edit2 size={16} />
                                                </Link>
                                                <button
                                                    className="admin-icon-btn danger"
                                                    onClick={() => setConfirmDelete(metal)}
                                                    title="Delete Metal"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                    {filtered.length === 0 && (
                        <div className="admin-empty">
                            <Search size={40} />
                            <p>No materials matching your search found.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Delete confirmation modal */}
            <AnimatePresence>
                {confirmDelete && (
                    <motion.div
                        className="admin-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setConfirmDelete(null)}
                    >
                        <motion.div
                            className="admin-modal"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <h3>Delete "{confirmDelete.name}"?</h3>
                            <p>This action cannot be undone.</p>
                            <div className="admin-modal-actions">
                                <button className="admin-btn-secondary" onClick={() => setConfirmDelete(null)}>
                                    Cancel
                                </button>
                                <button className="admin-btn-danger" onClick={() => handleDelete(confirmDelete.id)}>
                                    Delete
                                </button>
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
