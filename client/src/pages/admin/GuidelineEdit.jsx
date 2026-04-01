/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Save, ArrowLeft, Plus, Trash2, GripVertical, Loader2,
    Layout, Table as TableIcon, List, X
} from 'lucide-react';
import { fetchGuideline, saveGuideline } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { normalizeGuideline } from '../../utils/guidelineUtils';
import './GuidelineEdit.css';

export default function GuidelineEdit() {
    const { serviceId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    const [guideline, setGuideline] = useState({
        service_id: parseInt(serviceId),
        title: '',
        content: '',
        requirements: [],
        tables: []
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchGuideline(serviceId);
            if (data) {
                setGuideline(normalizeGuideline(data));
            }
        } catch (err) {
            toast('Could not load guidelines: ' + err.message, 'error');
            setError('Could not load guidelines.');
        } finally {
            setLoading(false);
        }
    }, [serviceId, toast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSave = async () => {
        if (!guideline.title) {
            toast('Please enter a title (e.g. Anodizing)', 'error');
            return;
        }
        setSaving(true);
        try {
            await saveGuideline(guideline);
            toast('Guidelines saved successfully', 'success');
        } catch (err) {
            toast('Failed to save: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    // --- Helpers ---
    const addRequirement = () => setGuideline(g => ({ ...g, requirements: [...(g.requirements || []), ''] }));
    const updateRequirement = (idx, val) => {
        const next = [...(guideline.requirements || [])];
        next[idx] = val;
        setGuideline(g => ({ ...g, requirements: next }));
    };
    const removeRequirement = (idx) => setGuideline(g => ({ ...g, requirements: (g.requirements || []).filter((_, i) => i !== idx) }));

    const addTable = () => {
        const newTable = {
            material: 'New Material',
            headers: ['Thickness', 'Min size', 'Max size'],
            rows: [{ 'Thickness': '', 'Min size': '', 'Max size': '' }]
        };
        setGuideline(g => ({ ...g, tables: [...(g.tables || []), newTable] }));
    };
    const updateTableMaterial = (tIdx, val) => {
        const next = [...(guideline.tables || [])];
        next[tIdx].material = val;
        setGuideline(g => ({ ...g, tables: next }));
    };
    const removeTable = (tIdx) => {
        if (window.confirm('Remove this entire material section?')) {
            setGuideline(g => ({ ...g, tables: (g.tables || []).filter((_, i) => i !== tIdx) }));
        }
    };

    const addHeader = (tIdx) => {
        const next = [...(guideline.tables || [])];
        const newHeader = 'New Col';
        next[tIdx].headers = [...(next[tIdx].headers || []), newHeader];
        next[tIdx].rows = (next[tIdx].rows || []).map(row => ({ ...row, [newHeader]: '' }));
        setGuideline(g => ({ ...g, tables: next }));
    };
    const updateHeader = (tIdx, hIdx, val) => {
        const next = [...(guideline.tables || [])];
        const old = next[tIdx].headers[hIdx];
        next[tIdx].headers[hIdx] = val;
        next[tIdx].rows = (next[tIdx].rows || []).map(row => {
            const nr = { ...row };
            nr[val] = nr[old];
            delete nr[old];
            return nr;
        });
        setGuideline(g => ({ ...g, tables: next }));
    };
    const removeHeader = (tIdx, hIdx) => {
        const next = [...(guideline.tables || [])];
        const old = next[tIdx].headers[hIdx];
        next[tIdx].headers.splice(hIdx, 1);
        next[tIdx].rows = (next[tIdx].rows || []).map(row => {
            const nr = { ...row };
            delete nr[old];
            return nr;
        });
        setGuideline(g => ({ ...g, tables: next }));
    };

    const addRow = (tIdx) => {
        const next = [...(guideline.tables || [])];
        const nr = {};
        (next[tIdx].headers || []).forEach(h => { nr[h] = ''; });
        next[tIdx].rows = [...(next[tIdx].rows || []), nr];
        setGuideline(g => ({ ...g, tables: next }));
    };
    const updateRow = (tIdx, rIdx, key, val) => {
        const next = [...(guideline.tables || [])];
        next[tIdx].rows[rIdx][key] = val;
        setGuideline(g => ({ ...g, tables: next }));
    };
    const removeRow = (tIdx, rIdx) => {
        const next = [...(guideline.tables || [])];
        next[tIdx].rows.splice(rIdx, 1);
        setGuideline(g => ({ ...g, tables: next }));
    };

    if (loading) {
        return (
            <div className="edit-guideline-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <Loader2 className="animate-spin text-blue-600" size={48} />
            </div>
        );
    }

    return (
        <div className="edit-guideline-page">
            <div className="edit-guideline-container">
                <div className="page-top-actions">
                    <button className="icon-btn-back-minimal" onClick={() => navigate('/admin/guidelines')}>
                        <ArrowLeft size={20} />
                    </button>
                    <div className="action-buttons">
                        <button className="btn-premium-secondary-minimal" onClick={() => navigate('/admin/guidelines')}>Cancel</button>
                        <button className="btn-premium-primary-minimal" onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>

                <div className="page-title-row">
                    <input
                        type="text"
                        value={guideline.title}
                        onChange={e => setGuideline(g => ({ ...g, title: e.target.value }))}
                        placeholder="Service Title..."
                        className="service-title-input-minimal"
                    />
                </div>
                <section className="guideline-section">
                    <div className="section-header">
                        <h2><Layout size={18} /> Introductory Content</h2>
                    </div>
                    <div className="section-body">
                        <textarea
                            className="intro-textarea"
                            value={guideline.content || ''}
                            onChange={e => setGuideline(g => ({ ...g, content: e.target.value }))}
                            placeholder="Briefly describe the manufacturing process..."
                        />
                    </div>
                </section>

                <section className="guideline-section">
                    <div className="section-header">
                        <h2><List size={18} /> Key Requirements</h2>
                        <button className="btn-premium-secondary" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={addRequirement}>
                            <Plus size={14} /> Add
                        </button>
                    </div>
                    <div className="section-body">
                        <div className="requirements-list">
                            {(guideline.requirements || []).map((req, idx) => (
                                <div key={idx} className="requirement-item">
                                    <div className="req-number">{idx + 1}</div>
                                    <input
                                        className="req-input"
                                        type="text"
                                        value={req}
                                        onChange={e => updateRequirement(idx, e.target.value)}
                                        placeholder="Requirement description..."
                                    />
                                    <button className="icon-btn-danger" onClick={() => removeRequirement(idx)}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                            {(guideline.requirements || []).length === 0 && (
                                <div className="empty-state-hint">
                                    No requirements specified. Click "Add" to start.
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <div className="tables-container">
                    <div className="table-header-main">
                        <h2><TableIcon size={22} /> Manufacturing Tables</h2>
                        <button className="btn-premium-primary" onClick={addTable}>
                            <Plus size={18} /> Add New Table
                        </button>
                    </div>

                    {(guideline.tables || []).map((table, tIdx) => (
                        <div key={tIdx} className="material-table-card">
                            <div className="material-card-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <GripVertical size={16} color="#cbd5e1" />
                                    <input
                                        className="material-input"
                                        type="text"
                                        value={table.material || ''}
                                        onChange={e => updateTableMaterial(tIdx, e.target.value)}
                                        placeholder="Material Name"
                                    />
                                </div>
                                <button className="icon-btn-danger" style={{ color: '#ef4444' }} onClick={() => removeTable(tIdx)}>
                                    <Trash2 size={18} />
                                </button>
                            </div>
                            <div className="spreadsheet-wrapper">
                                <table className="spreadsheet-table">
                                    <thead>
                                        <tr>
                                            {(table.headers || []).map((header, hIdx) => (
                                                <th key={hIdx}>
                                                    <div className="header-cell-content">
                                                        <input
                                                            className="header-input"
                                                            type="text"
                                                            value={header || ''}
                                                            onChange={e => updateHeader(tIdx, hIdx, e.target.value)}
                                                        />
                                                        <button className="icon-btn-danger" onClick={() => removeHeader(tIdx, hIdx)}>
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                </th>
                                            ))}
                                            <th style={{ width: '40px' }}>
                                                <button className="icon-btn-danger" style={{ color: '#2563eb' }} onClick={() => addHeader(tIdx)}>
                                                    <Plus size={14} />
                                                </button>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(table.rows || []).map((row, rIdx) => (
                                            <tr key={rIdx}>
                                                {(table.headers || []).map((header, hIdx) => (
                                                    <td key={hIdx}>
                                                        <input
                                                            className="cell-input"
                                                            type="text"
                                                            value={(row && row[header]) || ''}
                                                            onChange={e => updateRow(tIdx, rIdx, header, e.target.value)}
                                                        />
                                                    </td>
                                                ))}
                                                <td style={{ textAlign: 'center' }}>
                                                    <button className="icon-btn-danger" onClick={() => removeRow(tIdx, rIdx)}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="add-row-zone">
                                    <button className="btn-premium-secondary" style={{ fontSize: '0.8rem', padding: '6px 16px' }} onClick={() => addRow(tIdx)}>
                                        <Plus size={14} /> Add Row
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {(guideline.tables || []).length === 0 && (
                        <div className="empty-state-hint" style={{ padding: '5rem' }}>
                            <TableIcon size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                            <p>No manufacturing tables created for this service.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
