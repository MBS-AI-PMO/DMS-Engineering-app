/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Upload, Plus, Edit2, Trash2, Info, X, Save, Package, Camera } from 'lucide-react';
import {
    fetchHardwareTypes, fetchHardwareItemsByType,
    uploadHardwareTypeImage, createHardwareItem, updateHardwareItem,
    deleteHardwareItem, uploadHardwareItemImage
} from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import ImageModal from '../../components/admin/ImageModal';

const emptyItem = { name: '', size_spec: '', price: '', notes: '', is_active: true };

export default function HardwareEdit() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    const [type, setType] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploadingTypeImg, setUploadingTypeImg] = useState(false);

    // Item add/edit modal
    const [editingItem, setEditingItem] = useState(null); // null | item object | 'new'
    const [itemForm, setItemForm] = useState(emptyItem);
    const [savingItem, setSavingItem] = useState(false);
    const [pendingItemImage, setPendingItemImage] = useState(null); // File to upload after save

    // Detail popup
    const [detailItem, setDetailItem] = useState(null);

    // Delete confirm
    const [confirmDelete, setConfirmDelete] = useState(null);

    // Image zoom
    const [zoomedImage, setZoomedImage] = useState(null);

    // Item image upload (for edit modal preview)
    const itemImgRef = useRef(null);
    const typeImgRef = useRef(null);

    const typeId = parseInt(id);

    const loadData = async () => {
        try {
            const [typesRes, itemsRes] = await Promise.all([
                fetchHardwareTypes(),
                fetchHardwareItemsByType(typeId)
            ]);
            const found = (typesRes.data || []).find(t => t.id === typeId);
            if (!found) { toast('Hardware type not found', 'error'); navigate('/admin/hardware'); return; }
            setType(found);
            setItems(itemsRes.data || []);
        } catch (err) {
            toast('Failed to load hardware data', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [typeId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Type image upload ──────────────────────────────────
    const handleTypeImageChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingTypeImg(true);
        try {
            const res = await uploadHardwareTypeImage(typeId, file);
            setType(prev => ({ ...prev, image_path: res.data.path }));
            toast('Type image updated', 'success');
        } catch (err) {
            toast('Failed to upload image: ' + err.message, 'error');
        } finally {
            setUploadingTypeImg(false);
            e.target.value = '';
        }
    };

    // ── Item modal ─────────────────────────────────────────
    const openNew = () => {
        setItemForm(emptyItem);
        setPendingItemImage(null);
        setEditingItem('new');
    };

    const openEdit = (item) => {
        setItemForm({
            name: item.name || '',
            size_spec: item.size_spec || '',
            price: item.price || '',
            notes: item.notes || '',
            is_active: item.is_active !== false,
            image_path: item.image_path || ''
        });
        setPendingItemImage(null);
        setEditingItem(item);
    };

    const closeModal = () => { setEditingItem(null); setItemForm(emptyItem); setPendingItemImage(null); };

    const handleItemImagePick = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPendingItemImage(file);
        // Show local preview
        const url = URL.createObjectURL(file);
        setItemForm(prev => ({ ...prev, _previewUrl: url }));
        e.target.value = '';
    };

    const handleSaveItem = async () => {
        if (!itemForm.name.trim()) { toast('Name is required', 'error'); return; }
        setSavingItem(true);
        try {
            const payload = {
                hardware_type_id: typeId,
                name: itemForm.name.trim(),
                size_spec: itemForm.size_spec.trim() || null,
                price: parseFloat(itemForm.price) || 0,
                notes: itemForm.notes.trim() || null,
                is_active: itemForm.is_active,
                image_path: editingItem !== 'new' ? (itemForm.image_path || null) : null
            };

            let savedItem;
            if (editingItem === 'new') {
                const res = await createHardwareItem(payload);
                savedItem = res.data;
            } else {
                const res = await updateHardwareItem(editingItem.id, payload);
                savedItem = res.data;
            }

            // Upload image if one was selected
            if (pendingItemImage && savedItem?.id) {
                const imgRes = await uploadHardwareItemImage(savedItem.id, pendingItemImage);
                savedItem.image_path = imgRes.data.path;
            }

            // Refresh items list
            const itemsRes = await fetchHardwareItemsByType(typeId);
            setItems(itemsRes.data || []);
            toast(editingItem === 'new' ? 'Item added' : 'Item updated', 'success');
            closeModal();
        } catch (err) {
            toast('Failed to save item: ' + err.message, 'error');
        } finally {
            setSavingItem(false);
        }
    };

    // ── Delete ─────────────────────────────────────────────
    const handleDelete = async () => {
        if (!confirmDelete) return;
        try {
            await deleteHardwareItem(confirmDelete.id);
            setItems(prev => prev.filter(i => i.id !== confirmDelete.id));
            toast('Item deleted', 'success');
        } catch (err) {
            toast('Failed to delete: ' + err.message, 'error');
        } finally {
            setConfirmDelete(null);
        }
    };

    if (loading) return (
        <div className="admin-page">
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading...</div>
        </div>
    );

    const previewSrc = itemForm._previewUrl || (editingItem !== 'new' ? editingItem?.image_path : null);

    return (
        <div className="admin-page">
            {/* Header */}
            <div className="admin-page-header" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button className="admin-icon-btn" onClick={() => navigate('/admin/hardware')} title="Back">
                    <ChevronLeft size={18} />
                </button>
                <div>
                    <h1 className="admin-page-title">{type?.name}</h1>
                    <p className="admin-page-subtitle">Manage hardware items for this type</p>
                </div>
            </div>

            {/* Type representative image */}
            <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 20, padding: '20px 24px', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                {type?.image_path ? (
                    <img
                        src={type.image_path}
                        alt={type.name}
                        style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, cursor: 'zoom-in', border: '1px solid #e5e7eb' }}
                        onClick={() => setZoomedImage(type.image_path)}
                    />
                ) : (
                    <div style={{ width: 80, height: 80, borderRadius: 10, background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Package size={32} color="#9ca3af" />
                    </div>
                )}
                <div>
                    <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#374151' }}>Representative Photo</p>
                    <input type="file" ref={typeImgRef} accept="image/*" style={{ display: 'none' }} onChange={handleTypeImageChange} />
                    <button
                        className="admin-icon-btn"
                        onClick={() => typeImgRef.current?.click()}
                        disabled={uploadingTypeImg}
                        title="Upload photo"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 13 }}
                    >
                        {uploadingTypeImg ? <span>Uploading...</span> : <><Camera size={14} /> Upload Photo</>}
                    </button>
                </div>
            </div>

            {/* Items table */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
                    Hardware Items <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 8 }}>{items.length}</span>
                </h2>
                <button className="admin-btn-primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Plus size={16} /> Add Item
                </button>
            </div>

            {items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9ca3af', background: '#f9fafb', borderRadius: 12, border: '1px dashed #e5e7eb' }}>
                    <Package size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
                    <p style={{ margin: 0, fontWeight: 500 }}>No items yet. Click "Add Item" to get started.</p>
                </div>
            ) : (
                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Image</th>
                                <th>Name</th>
                                <th>Size / Spec</th>
                                <th>Price</th>
                                <th>Active</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(item => (
                                <tr key={item.id}>
                                    <td>
                                        {item.image_path ? (
                                            <img
                                                src={item.image_path}
                                                alt={item.name}
                                                className="table-thumb"
                                                style={{ cursor: 'zoom-in' }}
                                                onClick={() => setZoomedImage(item.image_path)}
                                            />
                                        ) : (
                                            <div className="table-thumb" style={{ background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Package size={16} color="#9ca3af" />
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                                    <td style={{ color: '#6b7280' }}>{item.size_spec || '—'}</td>
                                    <td>${parseFloat(item.price || 0).toFixed(4)}</td>
                                    <td>
                                        <span className={`hw-badge ${item.is_active ? 'hw-badge-active' : 'hw-badge-inactive'}`}>
                                            {item.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                            <button className="admin-icon-btn" title="Details" onClick={() => setDetailItem(item)}>
                                                <Info size={14} />
                                            </button>
                                            <button className="admin-icon-btn" title="Edit" onClick={() => openEdit(item)}>
                                                <Edit2 size={14} />
                                            </button>
                                            <button className="admin-icon-btn danger" title="Delete" onClick={() => setConfirmDelete(item)}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Detail Popup ──────────────────────────────── */}
            <AnimatePresence>
                {detailItem && (
                    <motion.div className="admin-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDetailItem(null)}>
                        <motion.div className="admin-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                            <div className="admin-modal-header">
                                <h3>{detailItem.name}</h3>
                                <button className="admin-icon-btn" onClick={() => setDetailItem(null)}><X size={16} /></button>
                            </div>
                            <div style={{ padding: '20px 24px' }}>
                                {detailItem.image_path && (
                                    <img src={detailItem.image_path} alt={detailItem.name} style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 8, marginBottom: 16, background: '#f3f4f6' }} />
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                                    <div>
                                        <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>Size / Spec</p>
                                        <p style={{ margin: 0, fontWeight: 600 }}>{detailItem.size_spec || '—'}</p>
                                    </div>
                                    <div>
                                        <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>Price</p>
                                        <p style={{ margin: 0, fontWeight: 700, color: '#111827' }}>${parseFloat(detailItem.price || 0).toFixed(4)}</p>
                                    </div>
                                    <div>
                                        <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>Status</p>
                                        <span className={`hw-badge ${detailItem.is_active ? 'hw-badge-active' : 'hw-badge-inactive'}`}>{detailItem.is_active ? 'Active' : 'Inactive'}</span>
                                    </div>
                                </div>
                                {detailItem.notes && (
                                    <div style={{ marginTop: 16 }}>
                                        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>Notes</p>
                                        <p style={{ margin: 0, color: '#374151' }}>{detailItem.notes}</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Add / Edit Item Modal ─────────────────────── */}
            <AnimatePresence>
                {editingItem !== null && (
                    <motion.div className="admin-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal}>
                        <motion.div className="admin-modal admin-modal-wide" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                            <div className="admin-modal-header">
                                <h3>{editingItem === 'new' ? `Add Item — ${type?.name}` : `Edit: ${editingItem.name}`}</h3>
                                <button className="admin-icon-btn" onClick={closeModal}><X size={16} /></button>
                            </div>

                            <div style={{ padding: '24px' }} className="admin-form-grid">
                                {/* Image upload */}
                                <div className="full-width" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    {previewSrc ? (
                                        <img src={previewSrc} alt="preview" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                                    ) : (
                                        <div style={{ width: 72, height: 72, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Package size={28} color="#9ca3af" />
                                        </div>
                                    )}
                                    <input type="file" ref={itemImgRef} accept="image/*" style={{ display: 'none' }} onChange={handleItemImagePick} />
                                    <button className="admin-icon-btn" onClick={() => itemImgRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 13 }}>
                                        <Upload size={14} /> {previewSrc ? 'Change Image' : 'Upload Image'}
                                    </button>
                                </div>

                                {/* Name */}
                                <div className="admin-form-group full-width">
                                    <label>Name *</label>
                                    <input
                                        value={itemForm.name}
                                        onChange={e => setItemForm(p => ({ ...p, name: e.target.value }))}
                                        placeholder="e.g. M4 x 10mm Flush Stud"
                                    />
                                </div>

                                {/* Size/Spec */}
                                <div className="admin-form-group">
                                    <label>Size / Spec</label>
                                    <input
                                        value={itemForm.size_spec}
                                        onChange={e => setItemForm(p => ({ ...p, size_spec: e.target.value }))}
                                        placeholder="e.g. M4, #4-40, 1/4-20"
                                    />
                                </div>

                                {/* Price */}
                                <div className="admin-form-group">
                                    <label>Price ($)</label>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        min="0"
                                        value={itemForm.price}
                                        onChange={e => setItemForm(p => ({ ...p, price: e.target.value }))}
                                        placeholder="0.0000"
                                    />
                                </div>

                                {/* Notes */}
                                <div className="admin-form-group full-width">
                                    <label>Notes</label>
                                    <textarea
                                        rows={3}
                                        value={itemForm.notes}
                                        onChange={e => setItemForm(p => ({ ...p, notes: e.target.value }))}
                                        placeholder="Optional notes..."
                                        style={{ resize: 'vertical' }}
                                    />
                                </div>

                                {/* Active */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <input
                                        type="checkbox"
                                        id="hw-active"
                                        checked={itemForm.is_active}
                                        onChange={e => setItemForm(p => ({ ...p, is_active: e.target.checked }))}
                                    />
                                    <label htmlFor="hw-active" style={{ fontWeight: 500, cursor: 'pointer' }}>Active</label>
                                </div>
                            </div>

                            <div className="admin-modal-actions">
                                <button className="admin-btn admin-btn-secondary" onClick={closeModal} disabled={savingItem}>Cancel</button>
                                <button className="admin-btn admin-btn-primary" onClick={handleSaveItem} disabled={savingItem}>
                                    {savingItem ? 'Saving...' : <><Save size={14} /> Save Item</>}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Delete Confirm ────────────────────────────── */}
            <AnimatePresence>
                {confirmDelete && (
                    <motion.div className="admin-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmDelete(null)}>
                        <motion.div className="admin-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                            <div className="admin-modal-header">
                                <h3>Delete Item</h3>
                            </div>
                            <p style={{ padding: '16px 24px', margin: 0, color: '#374151' }}>
                                Delete <strong>{confirmDelete.name}</strong>? This cannot be undone.
                            </p>
                            <div className="admin-modal-actions">
                                <button className="admin-btn admin-btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
                                <button className="admin-btn admin-btn-danger" onClick={handleDelete}>Delete</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <ImageModal src={zoomedImage} onClose={() => setZoomedImage(null)} />
        </div>
    );
}
