import { useEffect, useState } from 'react';
import { Image as ImageIcon, UploadCloud, Trash2, Loader2 } from 'lucide-react';
import {
    fetchHeroSections,
    uploadHeroSectionImage,
    updateHeroSection,
    deleteHeroSection
} from '../../utils/api';
import { useToast } from '../../context/ToastContext';

export default function HeroSections() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploadingId, setUploadingId] = useState(null);
    const toast = useToast();

    useEffect(() => {
        loadHeroSections();
    }, []);

    const loadHeroSections = async () => {
        try {
            setLoading(true);
            const data = await fetchHeroSections();
            setItems(data || []);
        } catch (err) {
            toast('Failed to load hero sections: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const getPreview = (value) => {
        if (!value) return '';

        if (typeof value === 'string') {
            return value;
        }

        return value.webp || value.avif || value.jpg || value.src || '';
    };

    const handleUpload = async (serviceId, file) => {
        if (!file) return;

        try {
            setUploadingId(serviceId);

            const uploadRes = await uploadHeroSectionImage(file);
            const heroImage = uploadRes.data;

            await updateHeroSection(serviceId, heroImage);

            setItems(prev =>
                prev.map(item =>
                    item.service_id === serviceId
                        ? { ...item, hero_image: heroImage }
                        : item
                )
            );

            toast('Hero image updated successfully', 'success');
        } catch (err) {
            toast('Upload failed: ' + err.message, 'error');
        } finally {
            setUploadingId(null);
        }
    };

    const handleRemove = async (serviceId) => {
        try {
            await deleteHeroSection(serviceId);

            setItems(prev =>
                prev.map(item =>
                    item.service_id === serviceId
                        ? { ...item, hero_image: null }
                        : item
                )
            );

            toast('Hero image removed', 'success');
        } catch (err) {
            toast('Remove failed: ' + err.message, 'error');
        }
    };

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <div>
                    <h1 className="admin-page-title">Hero Sections</h1>
                    <p className="admin-page-subtitle">
                        Change hero images for service detail pages.
                    </p>
                </div>
            </div>

            <div className="admin-table-wrapper">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Service</th>
                            <th>Hero Preview</th>
                            <th>Image Status</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="4" style={{ textAlign: 'center', padding: 40 }}>
                                    Loading hero sections...
                                </td>
                            </tr>
                        ) : items.length === 0 ? (
                            <tr>
                                <td colSpan="4" style={{ textAlign: 'center', padding: 40 }}>
                                    No services found.
                                </td>
                            </tr>
                        ) : (
                            items.map(item => {
                                const preview = getPreview(item.hero_image);
                                const isUploading = uploadingId === item.service_id;

                                return (
                                    <tr key={item.service_id}>
                                        <td>
                                            <strong>{item.title}</strong>
                                            <div style={{ fontSize: 12, color: '#64748b' }}>
                                                /service/{item.slug}
                                            </div>
                                        </td>

                                        <td>
                                            <div
                                                style={{
                                                    width: 180,
                                                    height: 80,
                                                    borderRadius: 12,
                                                    overflow: 'hidden',
                                                    border: '1px solid #e2e8f0',
                                                    background: '#f8fafc',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                {preview ? (
                                                    <img
                                                        src={preview}
                                                        alt={item.title}
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover'
                                                        }}
                                                    />
                                                ) : (
                                                    <ImageIcon size={24} color="#94a3b8" />
                                                )}
                                            </div>
                                        </td>

                                        <td>
                                            {preview ? (
                                                <span className="status-badge active">Custom Image</span>
                                            ) : (
                                                <span className="status-badge inactive">Default Image</span>
                                            )}
                                        </td>

                                        <td>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    gap: 8,
                                                    justifyContent: 'flex-end'
                                                }}
                                            >
                                                <input
                                                    id={`hero-upload-${item.service_id}`}
                                                    type="file"
                                                    accept="image/*"
                                                    hidden
                                                    onChange={e =>
                                                        handleUpload(
                                                            item.service_id,
                                                            e.target.files?.[0]
                                                        )
                                                    }
                                                />

                                                <label
                                                    htmlFor={`hero-upload-${item.service_id}`}
                                                    className="admin-btn-secondary"
                                                    style={{
                                                        cursor: isUploading ? 'not-allowed' : 'pointer',
                                                        opacity: isUploading ? 0.7 : 1
                                                    }}
                                                >
                                                    {isUploading ? (
                                                        <Loader2 size={16} className="spin" />
                                                    ) : (
                                                        <UploadCloud size={16} />
                                                    )}
                                                    {isUploading ? 'Uploading...' : 'Upload'}
                                                </label>

                                                {preview && (
                                                    <button
                                                        className="admin-btn-danger"
                                                        onClick={() => handleRemove(item.service_id)}
                                                        disabled={isUploading}
                                                    >
                                                        <Trash2 size={16} />
                                                        Remove
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}