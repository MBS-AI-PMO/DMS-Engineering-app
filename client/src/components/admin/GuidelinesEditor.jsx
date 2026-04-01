import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, AlertCircle, Info } from 'lucide-react';
import { fetchGuideline, saveGuideline } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

const GuidelinesEditor = ({ service, onClose, onSave }) => {
    const [guideline, setGuideline] = useState({
        service_id: service.id,
        title: service.title,
        content: '',
        requirements: [],
        tables: []
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [jsonError, setJsonError] = useState(null);
    const [tablesJson, setTablesJson] = useState('[]');
    const toast = useToast();

    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchGuideline(service.id);
                if (data) {
                    setGuideline(data);
                    setTablesJson(JSON.stringify(data.tables, null, 2));
                }
            } catch {
                console.log('No existing guidelines for this service, starting fresh.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [service.id]);

    const handleSave = async () => {
        setSaving(true);
        setJsonError(null);
        try {
            let parsedTables;
            try {
                parsedTables = JSON.parse(tablesJson);
            } catch (e) {
                setJsonError('Invalid JSON format for Tables: ' + e.message);
                setSaving(false);
                return;
            }

            const payload = {
                ...guideline,
                tables: parsedTables
            };

            await saveGuideline(payload);
            toast('Guidelines updated', 'success');
            if (onSave) onSave();
            onClose();
        } catch (err) {
            toast('Failed to save guidelines: ' + err.message, 'error');
            setJsonError('Save failed: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const addRequirement = () => {
        setGuideline(g => ({ ...g, requirements: [...g.requirements, ''] }));
    };

    const updateRequirement = (index, value) => {
        const next = [...guideline.requirements];
        next[index] = value;
        setGuideline(g => ({ ...g, requirements: next }));
    };

    const removeRequirement = (index) => {
        setGuideline(g => ({ ...g, requirements: g.requirements.filter((_, i) => i !== index) }));
    };

    if (loading) return <div className="p-10 text-center">Loading guidelines...</div>;

    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div className="admin-modal" style={{ maxWidth: '900px', width: '95%' }} onClick={e => e.stopPropagation()}>
                <div className="admin-modal-header">
                    <div className="flex items-center gap-2">
                        <Info size={20} className="text-blue-500" />
                        <h3>Guidelines for {service.title}</h3>
                    </div>
                    <button className="admin-icon-btn" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="admin-modal-body" style={{ maxHeight: '75vh', overflowY: 'auto', padding: '20px' }}>
                    <div className="admin-form-group">
                        <label>Introductory Content</label>
                        <textarea
                            rows={3}
                            value={guideline.content}
                            onChange={e => setGuideline(g => ({ ...g, content: e.target.value }))}
                            placeholder="Brief description of the service guidelines..."
                        />
                    </div>

                    <div className="admin-form-group">
                        <label className="flex justify-between items-center">
                            <span>Key Requirements</span>
                            <button className="text-blue-600 text-sm flex items-center gap-1" onClick={addRequirement}>
                                <Plus size={14} /> Add Line
                            </button>
                        </label>
                        <div className="space-y-2 mt-2">
                            {guideline.requirements.map((req, idx) => (
                                <div key={idx} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={req}
                                        onChange={e => updateRequirement(idx, e.target.value)}
                                        placeholder="e.g. Min part size is 1x1..."
                                        style={{ flex: 1 }}
                                    />
                                    <button className="admin-icon-btn danger" onClick={() => removeRequirement(idx)}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                            {guideline.requirements.length === 0 && (
                                <p className="text-gray-400 text-sm italic">No requirements added yet.</p>
                            )}
                        </div>
                    </div>

                    <div className="admin-form-group">
                        <label>Manufacturing Tables (JSON)</label>
                        <p className="text-xs text-slate-500 mb-2">
                            Provide an array of table objects (material, headers, rows).
                        </p>
                        <textarea
                            rows={15}
                            className="font-mono text-sm"
                            value={tablesJson}
                            onChange={e => setTablesJson(e.target.value)}
                            placeholder='[ { "material": "Steel", "headers": ["T", "Min"], "rows": [ {"t":".030", "min":"1x1"} ] } ]'
                        />
                        {jsonError && (
                            <div className="mt-2 p-3 bg-red-50 text-red-600 rounded-md flex items-center gap-2 text-sm">
                                <AlertCircle size={16} />
                                {jsonError}
                            </div>
                        )}
                    </div>
                </div>

                <div className="admin-modal-footer" style={{ padding: '15px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button className="admin-btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>
                        <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GuidelinesEditor;
