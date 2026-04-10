import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import {
    Plus, Trash2, Edit2, Save, X, Search, ChevronRight
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import Skeleton from '../../components/Skeleton';
import LegalIcon from '../../components/LegalIcon';
import { ALL_LEGAL_ICONS } from '../../constants/legalIcons';

const DynamicIcon = ({ name, size = 18 }) => {
    return <LegalIcon name={name} size={size} />;
};

const TermsAndPolicy = () => {
    const [activeTab, setActiveTab] = useState('privacy');
    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentSection, setCurrentSection] = useState(null);
    const { showToast } = useToast();

    const [formData, setFormData] = useState({
        serial_number: '',
        heading: '',
        icon: 'FileText',
        color: '#6366f1',
        content: ['']
    });

    const fetchSections = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/legal/admin/${activeTab}`, {
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                // Force natural numeric sorting on client-side to ensure 01, 02, 06 order
                const sortedData = [...data.data].sort((a, b) => {
                    const snA = a.serial_number || '';
                    const snB = b.serial_number || '';
                    const snResult = snA.localeCompare(snB, undefined, { numeric: true });
                    if (snResult !== 0) return snResult;
                    return (a.display_order || 0) - (b.display_order || 0);
                });
                setSections(sortedData);
            }
        } catch (error) {
            console.error('Fetch error:', error);
            showToast('Failed to fetch legal sections', 'error');
        } finally {
            setLoading(false);
        }
    }, [activeTab, showToast]);

    useEffect(() => {
        fetchSections();
    }, [fetchSections]);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);

        const payload = {
            ...formData,
            type: activeTab,
            id: currentSection?.id
        };

        try {
            const res = await fetch('/api/legal/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                // Close modal instantly for a snapier feel
                setIsEditing(false);
                showToast(`Section ${currentSection ? 'updated' : 'created'} successfully`, 'success');
                fetchSections();
            } else {
                showToast(data.error || 'Error saving section', 'error');
            }
        } catch (error) {
            console.error('Save error:', error);
            showToast('Network error while saving', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this section?')) return;
        try {
            const res = await fetch(`/api/legal/admin/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                showToast('Section deleted', 'success');
                fetchSections();
            } else {
                showToast(data.error || 'Error deleting section', 'error');
            }
        } catch (error) {
            console.error('Delete error:', error);
            showToast('Network error while deleting', 'error');
        }
    };

    const openModal = (section = null) => {
        if (section) {
            setCurrentSection(section);
            setFormData({
                serial_number: section.serial_number,
                heading: section.heading,
                icon: section.icon,
                color: section.color,
                content: section.content
            });
        } else {
            setCurrentSection(null);
            setFormData({
                serial_number: '',
                heading: '',
                icon: 'FileText',
                color: '#6366f1',
                content: ['']
            });
        }
        setIsEditing(true);
    };

    const addContentRow = () => {
        setFormData({ ...formData, content: [...formData.content, ''] });
    };

    const updateContentRow = (index, value) => {
        const newContent = [...formData.content];
        newContent[index] = value;
        setFormData({ ...formData, content: newContent });
    };

    const removeContentRow = (index) => {
        const newContent = formData.content.filter((_, i) => i !== index);
        setFormData({ ...formData, content: newContent });
    };

    if (loading && sections.length === 0) {
        return (
            <div className="legal-admin-container">
                <div className="legal-header">
                    <Skeleton variant="text" style={{ width: 250, height: 32 }} />
                </div>
                <div className="legal-tabs-wrapper">
                    <Skeleton variant="rectangle" style={{ width: '100%', height: 50, borderRadius: 12 }} />
                </div>
                <div className="legal-table-skeleton">
                    {[1, 2, 3, 4].map(i => (
                        <Skeleton key={i} variant="rectangle" style={{ width: '100%', height: 70, borderRadius: 8, marginBottom: 16 }} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="legal-admin-container">
            <header className="legal-header">
                <div>
                    <h1>Legal Content Management</h1>
                    <p>Manage Privacy Policy and Terms of Service sections with dynamic icons and colors.</p>
                </div>
                <button className="add-section-btn" onClick={() => openModal()}>
                    <Plus size={20} /> Add New Section
                </button>
            </header>

            <div className="legal-tabs-wrapper">
                <button
                    className={`legal-tab ${activeTab === 'privacy' ? 'active' : ''}`}
                    onClick={() => setActiveTab('privacy')}
                >
                    Privacy Policy
                </button>
                <button
                    className={`legal-tab ${activeTab === 'terms' ? 'active' : ''}`}
                    onClick={() => setActiveTab('terms')}
                >
                    Terms of Service
                </button>
            </div>

            <div className="legal-content-card">
                <div className="table-responsive">
                    <table className="legal-table">
                        <thead>
                            <tr>
                                <th width="80">S.No</th>
                                <th width="60">Icon</th>
                                <th>Heading</th>
                                <th>Color</th>
                                <th width="120">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence mode="popLayout">
                                {sections.map((section) => (
                                    <motion.tr
                                        key={section.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        layout
                                    >
                                        <td className="serial-col">{section.serial_number}</td>
                                        <td>
                                            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${section.color}14`, border: `1.5px solid ${section.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: section.color }}>
                                                <DynamicIcon name={section.icon} />
                                            </div>
                                        </td>
                                        <td className="heading-col">
                                            <span>{section.heading}</span>
                                            <div className="content-preview">{section.content?.length} bullet points</div>
                                        </td>
                                        <td>
                                            <div className="color-preview">
                                                <span className="color-dot" style={{ background: section.color }} />
                                                <code>{section.color}</code>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="action-btns">
                                                <button className="icon-btn edit" onClick={() => openModal(section)}>
                                                    <Edit2 size={16} />
                                                </button>
                                                <button className="icon-btn delete" onClick={() => handleDelete(section.id)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Editor Modal */}
            <AnimatePresence>
                {isEditing && (
                    <div className="modal-overlay">
                        <motion.div
                            className="editor-modal"
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        >
                            <div className="modal-header">
                                <h2>{currentSection ? 'Edit Section' : 'Add New Section'}</h2>
                                <button className="close-btn" onClick={() => setIsEditing(false)}>
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="editor-form">
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Serial Number (e.g. 01.)</label>
                                        <input
                                            type="text"
                                            value={formData.serial_number}
                                            onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                                            required
                                            placeholder="e.g. 1.0"
                                        />
                                    </div>
                                    <div className="form-group color-picker-group">
                                        <label>Theme Color</label>
                                        <div className="color-input-wrapper">
                                            <input
                                                type="color"
                                                value={formData.color}
                                                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                            />
                                            <input
                                                type="text"
                                                value={formData.color}
                                                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Heading</label>
                                    <input
                                        type="text"
                                        value={formData.heading}
                                        onChange={(e) => setFormData({ ...formData, heading: e.target.value })}
                                        required
                                        placeholder="Section Title"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Icon Selection</label>
                                    <div className="icon-grid">
                                        {Object.keys(ALL_LEGAL_ICONS).map(iconName => (
                                            <button
                                                key={iconName}
                                                type="button"
                                                className={`icon-choice ${formData.icon === iconName ? 'active' : ''}`}
                                                onClick={() => setFormData({ ...formData, icon: iconName })}
                                                title={iconName}
                                            >
                                                <LegalIcon name={iconName} size={20} />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Content (Bullets / Paragraphs)</label>
                                    <div className="content-rows">
                                        {formData.content.map((row, idx) => (
                                            <div key={idx} className="content-row">
                                                <textarea
                                                    value={row}
                                                    onChange={(e) => updateContentRow(idx, e.target.value)}
                                                    placeholder="Enter details..."
                                                    rows={2}
                                                />
                                                <button type="button" className="remove-row" onClick={() => removeContentRow(idx)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button type="button" className="add-row-btn" onClick={addContentRow}>
                                        <Plus size={16} /> Add Content Bullet
                                    </button>
                                </div>

                                <div className="modal-footer">
                                    <button type="button" className="cancel-btn" onClick={() => setIsEditing(false)} disabled={saving}>Cancel</button>
                                    <button type="submit" className="save-btn" disabled={saving}>
                                        {saving ? (
                                            <>Saving...</>
                                        ) : (
                                            <>
                                                <Save size={20} /> Save Changes
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style>{`
                /* Custom Scrollbar for a premium look */
                .editor-modal::-webkit-scrollbar,
                .icon-grid::-webkit-scrollbar,
                .content-rows::-webkit-scrollbar,
                .editor-form textarea::-webkit-scrollbar {
                    width: 6px;
                }
                .editor-modal::-webkit-scrollbar-track,
                .icon-grid::-webkit-scrollbar-track,
                .editor-form textarea::-webkit-scrollbar-track {
                    background: transparent;
                }
                .editor-modal::-webkit-scrollbar-thumb,
                .icon-grid::-webkit-scrollbar-thumb,
                .editor-form textarea::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 10px;
                }
                .editor-modal::-webkit-scrollbar-thumb:hover,
                .icon-grid::-webkit-scrollbar-thumb:hover,
                .editor-form textarea::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }

                /* Firefox Support */
                .editor-modal, .icon-grid, .content-rows, .editor-form textarea {
                    scrollbar-width: thin;
                    scrollbar-color: #cbd5e1 transparent;
                }

                .legal-admin-container {
                    padding: 32px;
                    max-width: 1200px;
                    margin: 0 auto;
                    animation: fadeIn 0.5s ease-out;
                    color: #0f172a;
                }
                .legal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 40px;
                }
                .legal-header h1 {
                    font-size: 2.2rem;
                    font-weight: 900;
                    margin: 0 0 8px;
                    color: #0f172a;
                    letter-spacing: -0.02em;
                }
                .legal-header p {
                    color: #64748b;
                    margin: 0;
                    font-size: 1.1rem;
                }
                .add-section-btn {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: #e31b23;
                    color: #fff;
                    border: none;
                    padding: 14px 28px;
                    border-radius: 14px;
                    font-weight: 800;
                    cursor: pointer;
                    box-shadow: 0 10px 25px -5px rgba(227, 27, 35, 0.4);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .add-section-btn:hover {
                    transform: translateY(-3px) scale(1.02);
                    background: #c41219;
                    box-shadow: 0 15px 30px -5px rgba(227, 27, 35, 0.5);
                }
                .legal-tabs-wrapper {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 32px;
                    background: #f1f5f9;
                    padding: 8px;
                    border-radius: 16px;
                    width: fit-content;
                }
                .legal-tab {
                    padding: 12px 28px;
                    border-radius: 12px;
                    border: none;
                    background: transparent;
                    color: #64748b;
                    font-weight: 800;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .legal-tab.active {
                    background: #fff;
                    color: #0f172a;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                }
                .legal-content-card {
                    background: #fff;
                    border-radius: 24px;
                    box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.05);
                    border: 1px solid #f1f5f9;
                    overflow: hidden;
                }
                .legal-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .legal-table th {
                    text-align: left;
                    padding: 20px 24px;
                    background: #f8fafc;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: #64748b;
                    font-weight: 900;
                    border-bottom: 2px solid #f1f5f9;
                }
                .legal-table td {
                    padding: 24px;
                    border-bottom: 1px solid #f1f5f9;
                    vertical-align: middle;
                }
                .serial-col {
                    font-family: inherit;
                    font-weight: 900;
                    color: #0f172a;
                    font-size: 1.1rem;
                }
                .heading-col span {
                    display: block;
                    font-weight: 900;
                    color: #0f172a;
                    margin-bottom: 6px;
                    font-size: 1.05rem;
                }
                .content-preview {
                    font-size: 0.85rem;
                    color: #94a3b8;
                    font-weight: 500;
                }
                .color-preview {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .color-dot {
                    width: 20px;
                    height: 20px;
                    border-radius: 6px;
                    border: 2px solid #fff;
                    box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
                }
                .color-preview code {
                    background: #f1f5f9;
                    padding: 4px 10px;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    font-family: monospace;
                    font-weight: 600;
                    color: #475569;
                }
                .action-btns {
                    display: flex;
                    gap: 10px;
                }
                .icon-btn {
                    width: 42px;
                    height: 42px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    border: 1.5px solid #f1f5f9;
                    background: #f8fafc;
                    color: #64748b;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .icon-btn.edit:hover {
                    color: #6366f1;
                    border-color: #6366f1;
                    background: #6366f115;
                    transform: translateY(-3px);
                }
                .icon-btn.delete:hover {
                    color: #ef4444;
                    border-color: #ef4444;
                    background: #ef444415;
                    transform: translateY(-3px);
                }

                /* Modal Styles */
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(15, 23, 42, 0.6);
                    backdrop-filter: blur(8px);
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .editor-modal {
                    background: #fff;
                    width: 100%;
                    max-width: 800px;
                    max-height: 90vh;
                    border-radius: 20px; /* Reduced from 32px */
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.3);
                    position: relative;
                }
                .modal-header {
                    padding: 24px 32px;
                    border-bottom: 1px solid #f1f5f9;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    position: sticky;
                    top: 0;
                    background: #fff;
                    z-index: 20;
                    border-radius: 20px 20px 0 0;
                }
                .modal-header h2 { font-size: 1.4rem; font-weight: 950; margin: 0; color: #0f172a; }
                .close-btn { background: #f1f5f9; border: none; color: #94a3b8; width: 40px; height: 40px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
                .close-btn:hover { background: #fee2e2; color: #ef4444; transform: rotate(90deg); }
                
                .editor-form { padding: 32px 40px 100px; } /* Added bottom padding to prevent overlap with fixed footer */
                .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
                .form-group { margin-bottom: 32px; }
                .form-group label { display: block; font-size: 0.85rem; font-weight: 900; color: #64748b; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.1em; }
                
                .editor-form input[type="text"], 
                .editor-form textarea {
                    width: 100%;
                    padding: 16px 20px;
                    border-radius: 12px;
                    border: 2px solid #f1f5f9;
                    background: #f8fafc;
                    font-size: 1rem;
                    font-weight: 600;
                    color: #0f172a;
                    transition: all 0.3s ease;
                    outline: none;
                }
                .editor-form input::placeholder, 
                .editor-form textarea::placeholder {
                    color: #94a3b8;
                    font-weight: 500;
                }
                .editor-form input:focus, 
                .editor-form textarea:focus { 
                    border-color: #6366f1; 
                    background: #fff;
                    box-shadow: 0 0 0 5px rgba(99, 102, 241, 0.1); 
                }
                
                .color-input-wrapper { display: flex; gap: 16px; }
                .color-input-wrapper input[type="color"] { width: 64px; height: 60px; padding: 4px; border: 2px solid #f1f5f9; border-radius: 12px; cursor: pointer; background: #fff; }
                
                .icon-grid {
                    display: grid;
                    grid-template-columns: repeat(10, 1fr);
                    gap: 12px;
                    max-height: 280px;
                    overflow-y: auto;
                    padding: 20px;
                    background: #f8fafc;
                    border-radius: 16px;
                    border: 2px solid #f1f5f9;
                }
                .icon-choice {
                    width: 100%;
                    aspect-ratio: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 10px;
                    border: 1px solid transparent;
                    background: #fff;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }
                .icon-choice:hover { border-color: #cbd5e1; color: #0f172a; transform: scale(1.1); box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
                .icon-choice.active { background: #6366f1; color: #fff; border-color: #6366f1; transform: scale(1.1); box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.4); }
                
                .content-row { display: flex; gap: 16px; margin-bottom: 16px; align-items: flex-start; }
                .remove-row { background: #fff; color: #94a3b8; border: 1.5px solid #f1f5f9; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: all 0.2s; }
                .remove-row:hover { background: #fee2e2; color: #ef4444; border-color: #fee2e2; }
                
                .add-row-btn { background: #fff; color: #6366f1; border: 2px dashed #e2e8f0; width: 100%; padding: 16px; border-radius: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.3s ease; }
                .add-row-btn:hover { background: #6366f105; border-color: #6366f1; transform: translateY(-2px); }
                
                .modal-footer { 
                    display: flex; 
                    justify-content: flex-end; 
                    gap: 16px; 
                    position: sticky; 
                    bottom: 0; 
                    background: #fff; 
                    padding: 24px 40px; 
                    border-top: 1px solid #f1f5f9; 
                    z-index: 20;
                    box-shadow: 0 -10px 20px -5px rgba(0,0,0,0.03);
                    border-radius: 0 0 20px 20px;
                }
                .cancel-btn { padding: 16px 32px; border-radius: 16px; border: none; background: #f1f5f9; color: #64748b; font-weight: 800; cursor: pointer; transition: all 0.2s; }
                .cancel-btn:hover { background: #e2e8f0; color: #475569; }
                .save-btn { display: flex; align-items: center; gap: 12px; background: #0f172a; color: #fff; border: none; padding: 16px 36px; border-radius: 16px; font-weight: 800; cursor: pointer; transition: all 0.3s; box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.3); }
                .save-btn:hover { transform: translateY(-3px); box-shadow: 0 15px 30px -5px rgba(15, 23, 42, 0.4); background: #1e293b; }

                @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default TermsAndPolicy;
