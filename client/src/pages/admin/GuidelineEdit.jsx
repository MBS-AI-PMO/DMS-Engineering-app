/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Save, ArrowLeft, Plus, Trash2, GripVertical, AlertCircle,
    CheckCircle2, Loader2, Info, Layout, Table as TableIcon, List, X
} from 'lucide-react';
import { fetchGuideline, saveGuideline } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';

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

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchGuideline(serviceId);
            if (data) {
                setGuideline(data);
            }
        } catch {
            console.error('No existing guidelines, starting with empty template.');
        } finally {
            setLoading(false);
        }
    }, [serviceId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveGuideline(guideline);
            toast('Guidelines saved successfully', 'success');
        } catch (err) {
            toast('Failed to save guidelines: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    // --- Requirements Helpers ---
    const addRequirement = () => {
        setGuideline(g => ({ ...g, requirements: [...g.requirements, ''] }));
    };

    const updateRequirement = (idx, val) => {
        const next = [...guideline.requirements];
        next[idx] = val;
        setGuideline(g => ({ ...g, requirements: next }));
    };

    const removeRequirement = (idx) => {
        setGuideline(g => ({ ...g, requirements: g.requirements.filter((_, i) => i !== idx) }));
    };

    // --- Table Helpers ---
    const addTable = () => {
        const newTable = {
            material: 'New Material',
            headers: ['Thickness', 'Min Flat Part Size', 'Max Flat Part Size'],
            rows: [{ 'Thickness': '', 'Min Flat Part Size': '', 'Max Flat Part Size': '' }]
        };
        setGuideline(g => ({ ...g, tables: [...g.tables, newTable] }));
    };

    const updateTableMaterial = (tIdx, val) => {
        const next = [...guideline.tables];
        next[tIdx].material = val;
        setGuideline(g => ({ ...g, tables: next }));
    };

    const removeTable = (tIdx) => {
        if (window.confirm('Are you sure you want to remove this entire table?')) {
            setGuideline(g => ({ ...g, tables: g.tables.filter((_, i) => i !== tIdx) }));
        }
    };

    const addHeader = (tIdx) => {
        const next = [...guideline.tables];
        const newHeader = 'New Column';
        next[tIdx].headers.push(newHeader);
        // Also update all rows to include this header
        next[tIdx].rows = next[tIdx].rows.map(row => ({ ...row, [newHeader]: '' }));
        setGuideline(g => ({ ...g, tables: next }));
    };

    const updateHeader = (tIdx, hIdx, val) => {
        const next = [...guideline.tables];
        const oldHeader = next[tIdx].headers[hIdx];
        next[tIdx].headers[hIdx] = val;
        // Update all rows: rename key
        next[tIdx].rows = next[tIdx].rows.map(row => {
            const newRow = { ...row };
            newRow[val] = newRow[oldHeader];
            delete newRow[oldHeader];
            return newRow;
        });
        setGuideline(g => ({ ...g, tables: next }));
    };

    const removeHeader = (tIdx, hIdx) => {
        const next = [...guideline.tables];
        const headerToRemove = next[tIdx].headers[hIdx];
        next[tIdx].headers.splice(hIdx, 1);
        // Update rows
        next[tIdx].rows = next[tIdx].rows.map(row => {
            const newRow = { ...row };
            delete newRow[headerToRemove];
            return newRow;
        });
        setGuideline(g => ({ ...g, tables: next }));
    };

    const addRow = (tIdx) => {
        const next = [...guideline.tables];
        const newRow = {};
        next[tIdx].headers.forEach(h => { newRow[h] = ''; });
        next[tIdx].rows.push(newRow);
        setGuideline(g => ({ ...g, tables: next }));
    };

    const updateRow = (tIdx, rIdx, key, val) => {
        const next = [...guideline.tables];
        next[tIdx].rows[rIdx][key] = val;
        setGuideline(g => ({ ...g, tables: next }));
    };

    const removeRow = (tIdx, rIdx) => {
        const next = [...guideline.tables];
        next[tIdx].rows.splice(rIdx, 1);
        setGuideline(g => ({ ...g, tables: next }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-blue-600" size={48} />
            </div>
        );
    }

    return (
        <div className="admin-page edit-guideline-page">
            <header className="admin-page-header">
                <div className="flex items-center gap-4">
                    <button className="admin-icon-btn" onClick={() => navigate('/admin/guidelines')}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="admin-page-title">{guideline.title || 'Service'} Guidelines</h1>
                        <p className="admin-page-subtitle">Configure manufacturing specifications and requirements</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="admin-btn-secondary" onClick={() => navigate('/admin/guidelines')}>Cancel</button>
                    <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>
                        <Save size={18} /> {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </header>

            <div className="admin-edit-container mt-10">
                {/* Intro Section */}
                <section className="admin-card">
                    <div className="card-header">
                        <Layout size={20} className="text-blue-500" />
                        <h2>Introductory Content</h2>
                    </div>
                    <div className="card-body">
                        <textarea
                            rows={4}
                            value={guideline.content}
                            onChange={e => setGuideline(g => ({ ...g, content: e.target.value }))}
                            placeholder="Briefly describe the manufacturing process for this service..."
                            className="w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </section>

                {/* Requirements Section */}
                <section className="admin-card mt-8">
                    <div className="card-header justify-between">
                        <div className="flex items-center gap-2">
                            <List size={20} className="text-emerald-500" />
                            <h2>Key Requirements</h2>
                        </div>
                        <button className="text-blue-600 font-semibold text-sm flex items-center gap-1 hover:underline" onClick={addRequirement}>
                            <Plus size={16} /> Add Requirement
                        </button>
                    </div>
                    <div className="card-body">
                        <div className="space-y-3">
                            {guideline.requirements.map((req, idx) => (
                                <div key={idx} className="flex gap-3 items-center">
                                    <div className="text-gray-400 font-mono text-xs">{idx + 1}</div>
                                    <input
                                        type="text"
                                        value={req}
                                        onChange={e => updateRequirement(idx, e.target.value)}
                                        placeholder="e.g. Parts must be clean and dry..."
                                        className="flex-1 p-2 border rounded-md"
                                    />
                                    <button className="text-red-500 p-2 hover:bg-red-50 rounded" onClick={() => removeRequirement(idx)}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                            {guideline.requirements.length === 0 && (
                                <div className="text-center p-8 border-2 border-dashed rounded-lg text-gray-400">
                                    No requirements specified. Click "Add Requirement" to start.
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Tables Section */}
                <section className="mt-12 mb-20">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                            <TableIcon size={24} className="text-violet-500" />
                            <h2 className="text-2xl font-bold text-gray-800">Manufacturing Tables</h2>
                        </div>
                        <button className="admin-btn-primary" onClick={addTable}>
                            <Plus size={18} /> Add Material Section
                        </button>
                    </div>

                    <div className="space-y-10">
                        {guideline.tables.map((table, tIdx) => (
                            <div key={tIdx} className="admin-card table-section-card">
                                <div className="card-header justify-between bg-gray-50 border-b">
                                    <div className="flex items-center gap-4 flex-1">
                                        <GripVertical className="text-gray-300" size={18} />
                                        <input
                                            type="text"
                                            value={table.material}
                                            onChange={e => updateTableMaterial(tIdx, e.target.value)}
                                            className="text-lg font-bold bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none"
                                            placeholder="Material Name"
                                        />
                                    </div>
                                    <button className="p-2 text-red-500 hover:bg-red-50 rounded" onClick={() => removeTable(tIdx)}>
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                                <div className="card-body p-0 overflow-x-auto">
                                    <table className="admin-edit-table w-full">
                                        <thead>
                                            <tr>
                                                {table.headers.map((header, hIdx) => (
                                                    <th key={hIdx}>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <input
                                                                type="text"
                                                                value={header}
                                                                onChange={e => updateHeader(tIdx, hIdx, e.target.value)}
                                                                className="bg-transparent font-semibold text-gray-700 w-full focus:outline-none"
                                                            />
                                                            <button
                                                                className="p-1 text-gray-400 hover:text-red-500"
                                                                onClick={() => removeHeader(tIdx, hIdx)}
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    </th>
                                                ))}
                                                <th className="w-10">
                                                    <button className="p-1 text-blue-500 hover:bg-blue-50 rounded" onClick={() => addHeader(tIdx)}>
                                                        <Plus size={14} />
                                                    </button>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {table.rows.map((row, rIdx) => (
                                                <tr key={rIdx}>
                                                    {table.headers.map((header, hIdx) => (
                                                        <td key={hIdx}>
                                                            <input
                                                                type="text"
                                                                value={row[header] || ''}
                                                                onChange={e => updateRow(tIdx, rIdx, header, e.target.value)}
                                                                className="w-full bg-transparent p-1 focus:bg-white focus:outline-none"
                                                            />
                                                        </td>
                                                    ))}
                                                    <td>
                                                        <button className="p-1 text-gray-300 hover:text-red-500" onClick={() => removeRow(tIdx, rIdx)}>
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div className="p-4 border-t bg-gray-50 flex justify-center">
                                        <button className="text-blue-600 text-sm font-semibold flex items-center gap-1 hover:underline" onClick={() => addRow(tIdx)}>
                                            <Plus size={14} /> Add Row
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
