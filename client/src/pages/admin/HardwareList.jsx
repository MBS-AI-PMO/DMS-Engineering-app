/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Edit2, Package } from 'lucide-react';
import { fetchHardwareTypes } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import ImageModal from '../../components/admin/ImageModal';

export default function HardwareList() {
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [zoomedImage, setZoomedImage] = useState(null);
    const navigate = useNavigate();
    const toast = useToast();

    useEffect(() => {
        fetchHardwareTypes()
            .then(res => setTypes(res.data || []))
            .catch(() => toast('Failed to load hardware types', 'error'))
            .finally(() => setLoading(false));
    }, [toast]);

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <div>
                    <h1 className="admin-page-title">Hardware Insertion</h1>
                    <p className="admin-page-subtitle">Configure available hardware for each type</p>
                </div>
            </div>

            {loading ? (
                <div className="hardware-type-grid">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="hardware-type-card">
                            <div className="hardware-type-card-header">
                                <div className="skeleton" style={{ width: 64, height: 64, borderRadius: 10 }} />
                                <div style={{ flex: 1 }}>
                                    <div className="skeleton" style={{ width: 140, height: 18, borderRadius: 4, marginBottom: 8 }} />
                                    <div className="skeleton" style={{ width: 80, height: 14, borderRadius: 4 }} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="hardware-type-grid">
                    {types.map(type => (
                        <motion.div
                            key={type.id}
                            className="hardware-type-card"
                            whileHover={{ y: -2 }}
                            transition={{ duration: 0.15 }}
                        >
                            <div className="hardware-type-card-header">
                                {type.image_path ? (
                                    <img
                                        src={type.image_path}
                                        alt={type.name}
                                        className="table-thumb"
                                        style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, cursor: 'zoom-in', flexShrink: 0 }}
                                        onClick={() => setZoomedImage(type.image_path)}
                                    />
                                ) : (
                                    <div style={{
                                        width: 64, height: 64, borderRadius: 10, flexShrink: 0,
                                        background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <Package size={28} color="#9ca3af" />
                                    </div>
                                )}
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: 17, color: '#111827' }}>{type.name}</h3>
                                    <span style={{ marginTop: 6, display: 'inline-block', fontSize: 12, fontWeight: 600, color: '#6b7280', background: '#f3f4f6', borderRadius: 6, padding: '2px 8px' }}>
                                        {type.item_count} item{type.item_count !== '1' ? 's' : ''}
                                    </span>
                                </div>
                                <button
                                    className="admin-icon-btn"
                                    title="Edit"
                                    onClick={() => navigate(`/admin/hardware/${type.id}`)}
                                >
                                    <Edit2 size={15} />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            <ImageModal src={zoomedImage} onClose={() => setZoomedImage(null)} />
        </div>
    );
}
