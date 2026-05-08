/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, ChevronDown, ChevronRight, Check, Save, ArrowLeft, Loader2 } from 'lucide-react';
import { fetchMetals, fetchServices, updateServiceMetals } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

export default function ServiceMetalsConfig() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    const [service, setService] = useState(null);
    const [metals, setMetals] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [expandedMetals, setExpandedMetals] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const [metalsData, servicesData] = await Promise.all([
                    fetchMetals(),
                    fetchServices()
                ]);

                const svc = servicesData.find(s => Number(s.id) === Number(id));
                if (!svc) {
                    toast('Service not found', 'error');
                    navigate('/admin/services');
                    return;
                }

                setService(svc);
                setMetals(metalsData);

                // Initialize assignments
                const initial = metalsData.map(m => ({
                    id: m.id,
                    name: m.name,
                    assigned: (m.services || []).some(sid => Number(sid) === Number(id)),
                    thicknesses: (m.quick_look?.thicknesses || [])
                        .filter(t => (t.services || []).some(sid => Number(sid) === Number(id)))
                        .map(t => t.value)
                }));
                setAssignments(initial);
            } catch (err) {
                toast('Failed to load data: ' + err.message, 'error');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, navigate, toast]);

    const toggleMetalGlobal = (metalId) => {
        setAssignments(prev => prev.map(a =>
            a.id === metalId ? { ...a, assigned: !a.assigned } : a
        ));
    };

    const toggleThickness = (metalId, thicknessValue) => {
        setAssignments(prev => prev.map(a => {
            if (a.id !== metalId) return a;
            const exists = a.thicknesses.includes(thicknessValue);
            return {
                ...a,
                thicknesses: exists
                    ? a.thicknesses.filter(v => v !== thicknessValue)
                    : [...a.thicknesses, thicknessValue]
            };
        }));
    };

    const toggleExpanded = (metalId) => {
        setExpandedMetals(prev => {
            const next = new Set(prev);
            if (next.has(metalId)) next.delete(metalId);
            else next.add(metalId);
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = assignments.map(a => ({
                id: a.id,
                assigned: a.assigned,
                thicknesses: a.thicknesses
            }));
            await updateServiceMetals(id, payload);
            toast(`Assignments for "${service.title}" updated`, 'success');
        } catch (err) {
            toast('Failed to save assignments: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="admin-page">
                <div className="admin-page-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div className="skeleton-box" style={{ width: 40, height: 40, borderRadius: 10 }} />
                        <div>
                            <div className="skeleton-box" style={{ width: 290, height: 30, marginBottom: 8 }} />
                            <div className="skeleton-box" style={{ width: 220, height: 14 }} />
                        </div>
                    </div>
                    <div className="skeleton-box" style={{ width: 160, height: 40, borderRadius: 10 }} />
                </div>

                <div className="admin-card service-metals-loading-card">
                    <div className="service-metals-loading-section">
                        <div>
                            <div className="skeleton-box" style={{ width: 220, height: 20, marginBottom: 8 }} />
                            <div className="skeleton-box" style={{ width: 420, maxWidth: '100%', height: 13 }} />
                        </div>
                        <div className="skeleton-box service-metals-loading-filter" />
                    </div>

                    <div className="service-metals-loading-grid">
                        {[...Array(8)].map((_, i) => (
                            <div key={`svc-metal-skel-${i}`} className="service-metals-loading-item">
                                <div className="service-metals-loading-item-header">
                                    <div className="service-metals-loading-main">
                                        <div className="skeleton-box" style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0 }} />
                                        <div className="service-metals-loading-copy">
                                            <div className="skeleton-box" style={{ width: i % 2 === 0 ? 150 : 118, height: 16 }} />
                                            <div className="skeleton-box" style={{ width: i % 3 === 0 ? 130 : 104, height: 12 }} />
                                        </div>
                                    </div>
                                    <div className="skeleton-box" style={{ width: 86, height: 30, borderRadius: 8, flexShrink: 0 }} />
                                </div>
                                <div className="service-metals-loading-pills">
                                    {[72, 58, 66, 54].map((width, pillIndex) => (
                                        <div
                                            key={`svc-metal-pill-${i}-${pillIndex}`}
                                            className="skeleton-box"
                                            style={{ width, height: 28, borderRadius: 8 }}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <style>{`
                    .service-metals-loading-card {
                        padding: 24px;
                    }
                    .service-metals-loading-section {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 18px;
                        margin-bottom: 22px;
                        padding-bottom: 20px;
                        border-bottom: 1px solid #e2e8f0;
                    }
                    .service-metals-loading-filter {
                        width: 160px;
                        height: 40px;
                        border-radius: 10px;
                        flex-shrink: 0;
                    }
                    .service-metals-loading-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                        gap: 16px;
                    }
                    .service-metals-loading-item {
                        min-height: 118px;
                        border: 1px solid #e2e8f0;
                        border-radius: 12px;
                        background: #fff;
                        overflow: hidden;
                    }
                    .service-metals-loading-item-header {
                        padding: 20px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 14px;
                    }
                    .service-metals-loading-main {
                        display: flex;
                        align-items: center;
                        gap: 16px;
                        min-width: 0;
                    }
                    .service-metals-loading-copy {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }
                    .service-metals-loading-pills {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 10px;
                        padding: 0 20px 18px 60px;
                    }
                    @media (max-width: 720px) {
                        .service-metals-loading-section {
                            align-items: stretch;
                            flex-direction: column;
                        }
                        .service-metals-loading-filter {
                            width: 100%;
                        }
                        .service-metals-loading-grid {
                            grid-template-columns: 1fr;
                        }
                        .service-metals-loading-pills {
                            padding-left: 20px;
                        }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button className="admin-icon-btn" onClick={() => navigate('/admin/services')}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="admin-page-title">Configure Metal Assignments</h1>
                        <p className="admin-page-subtitle">Service: <strong>{service?.title}</strong></p>
                    </div>
                </div>
                <div className="admin-page-actions">
                    <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'Saving...' : 'Save Assignments'}
                    </button>
                </div>
            </div>

            <div className="admin-card" style={{ padding: '24px' }}>
                <div className="admin-section-header" style={{ marginBottom: '20px' }}>
                    <h3>Manage Metals & Thicknesses</h3>
                    <p className="admin-field-hint">Toggle global metal assignment or expand to select specific thicknesses.</p>
                </div>

                <div className="service-metals-page-grid">
                    {metals.map(metal => {
                        const ass = assignments.find(a => a.id === metal.id) || { assigned: false, thicknesses: [] };
                        const isExpanded = expandedMetals.has(metal.id);
                        const hasThicknesses = (metal.quick_look?.thicknesses || []).length > 0;

                        return (
                            <div key={metal.id} className={`service-assignment-item ${ass.assigned ? 'assigned' : ''}`}>
                                <div className="assignment-item-header">
                                    <div className="assignment-item-main" onClick={() => toggleMetalGlobal(metal.id)}>
                                        <div className={`custom-checkbox-ui ${ass.assigned ? 'checked' : ''}`}>
                                            {ass.assigned && <Check size={14} />}
                                        </div>
                                        <div className="assignment-item-info">
                                            <span className="metal-name-title">{metal.name}</span>
                                            <span className="metal-assignment-hint">
                                                {ass.assigned ? 'Assigned globally' : 'Not assigned globally'}
                                            </span>
                                        </div>
                                    </div>

                                    {hasThicknesses && (
                                        <button
                                            className="thickness-expand-btn"
                                            onClick={() => toggleExpanded(metal.id)}
                                        >
                                            <span className="thickness-stat">
                                                {ass.thicknesses.length} / {metal.quick_look.thicknesses.length}
                                            </span>
                                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </button>
                                    )}
                                </div>

                                <AnimatePresence>
                                    {isExpanded && hasThicknesses && (
                                        <motion.div
                                            className="thickness-selection-area"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                        >
                                            <div className="thickness-pills-container">
                                                {metal.quick_look.thicknesses.map(t => {
                                                    const tAssigned = ass.thicknesses.includes(t.value);
                                                    return (
                                                        <button
                                                            key={t.value}
                                                            className={`thickness-choice-pill ${tAssigned ? 'active' : ''}`}
                                                            onClick={() => toggleThickness(metal.id, t.value)}
                                                        >
                                                            {t.value}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </div>

            <style>{`
                .service-metals-page-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                    gap: 16px;
                }
                .service-assignment-item {
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    background: #ffffff;
                    transition: all 0.2s ease;
                    display: flex;
                    flex-direction: column;
                }
                .service-assignment-item.assigned {
                    border-color: #3b82f6;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.05);
                }
                .assignment-item-header {
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .assignment-item-main {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    cursor: pointer;
                    flex: 1;
                }
                .custom-checkbox-ui {
                    width: 24px;
                    height: 24px;
                    border: 2px solid #cbd5e1;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }
                .custom-checkbox-ui.checked {
                    background: #3b82f6;
                    border-color: #3b82f6;
                    color: white;
                }
                .assignment-item-info {
                    display: flex;
                    flex-direction: column;
                }
                .metal-name-title {
                    font-weight: 700;
                    font-size: 1.05rem;
                    color: #1e293b;
                }
                .metal-assignment-hint {
                    font-size: 0.8rem;
                    color: #64748b;
                }
                .thickness-expand-btn {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    padding: 6px 12px;
                    border-radius: 8px;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .thickness-expand-btn:hover {
                    background: #f1f5f9;
                    border-color: #cbd5e1;
                }
                .thickness-stat {
                    font-size: 0.75rem;
                    font-weight: 700;
                    background: #ffffff;
                    padding: 2px 8px;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0;
                }
                .thickness-selection-area {
                    background: #f8fafc;
                    border-top: 1px solid #f1f5f9;
                    border-bottom-left-radius: 12px;
                    border-bottom-right-radius: 12px;
                }
                .thickness-pills-container {
                    padding: 20px;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                }
                .thickness-choice-pill {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .thickness-choice-pill:hover {
                    border-color: #cbd5e1;
                    transform: translateY(-1px);
                }
                .thickness-choice-pill.active {
                    background: #3b82f6;
                    border-color: #3b82f6;
                    color: #ffffff;
                }
                .admin-loading-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 400px;
                    gap: 16px;
                    color: #64748b;
                }
                @media (max-width: 768px) {
                    .service-metals-page-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
}
