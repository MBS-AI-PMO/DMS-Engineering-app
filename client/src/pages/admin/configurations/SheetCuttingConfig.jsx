import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Scissors, ArrowLeft, Save, Check, Search, CheckSquare, Square } from 'lucide-react';
import { fetchSheetCuttingConfig, saveSheetCuttingConfig } from '../../../utils/api';
import { useToast } from '../../../context/ToastContext';

export default function SheetCuttingConfig() {
    const navigate = useNavigate();
    const toast = useToast();

    const [metals, setMetals] = useState([]);
    const [assignedIds, setAssignedIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchSheetCuttingConfig()
            .then(data => {
                setMetals(data.metals || []);
                setAssignedIds(new Set((data.metals || []).filter(m => m.assigned).map(m => m.id)));
            })
            .catch(() => toast('Failed to load Sheet Cutting config', 'error'))
            .finally(() => setLoading(false));
    }, []);

    const toggleMetal = (id) => {
        setAssignedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const selectAll = () => setAssignedIds(new Set(filtered.map(m => m.id)));
    const clearAll = () => setAssignedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(m => next.delete(m.id));
        return next;
    });

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveSheetCuttingConfig({ metal_ids: Array.from(assignedIds) });
            toast('Sheet Cutting metals saved', 'success');
        } catch (err) {
            toast(err.message || 'Failed to save', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="admin-loading-inline"><div className="admin-loading-spinner" /><span>Loading…</span></div>;

    const filtered = metals.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
    const allFilteredSelected = filtered.length > 0 && filtered.every(m => assignedIds.has(m.id));

    return (
        <div className="admin-list-page">
            <header className="admin-page-header">
                <div className="config-page-header-left">
                    <button className="config-back-btn" onClick={() => navigate('/admin/configurations')}>
                        <ArrowLeft size={16} />
                    </button>
                    <div className="config-page-title-icon" style={{ background: 'rgba(227,27,35,0.1)', color: '#e31b23' }}>
                        <Scissors size={20} />
                    </div>
                    <div>
                        <h1 className="admin-page-title">Sheet Cutting</h1>
                        <p className="admin-page-subtitle">Select which metals are available for sheet cutting</p>
                    </div>
                </div>
                <button className="config-save-btn" onClick={handleSave} disabled={saving}>
                    {saving ? <span className="config-btn-spinner" /> : <Save size={16} />}
                    Save Configuration
                </button>
            </header>

            <motion.div
                className="sc-metals-card"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
            >
                {/* Card header */}
                <div className="sc-card-header">
                    <div className="sc-card-header-left">
                        <h2>Available Metals</h2>
                        <span className="sc-assigned-pill">
                            {assignedIds.size} <span>of {metals.length} assigned</span>
                        </span>
                    </div>
                    <div className="sc-card-header-right">
                        <div className="sc-search-wrap">
                            <Search size={14} className="sc-search-icon" />
                            <input
                                type="text"
                                placeholder="Search metals…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="sc-search-input"
                            />
                        </div>
                        <button className="sc-bulk-btn" onClick={allFilteredSelected ? clearAll : selectAll}>
                            {allFilteredSelected
                                ? <><Square size={14} /> Deselect All</>
                                : <><CheckSquare size={14} /> Select All</>
                            }
                        </button>
                    </div>
                </div>

                {/* Metal grid */}
                <div className="sc-metal-grid">
                    {filtered.map((metal, i) => {
                        const selected = assignedIds.has(metal.id);
                        return (
                            <motion.button
                                key={metal.id}
                                className={`sc-metal-item ${selected ? 'selected' : ''}`}
                                onClick={() => toggleMetal(metal.id)}
                                initial={{ opacity: 0, scale: 0.97 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.012 }}
                            >
                                <div className="sc-metal-check">
                                    {selected && <Check size={11} />}
                                </div>
                                <span className="sc-metal-name">{metal.name}</span>
                            </motion.button>
                        );
                    })}
                    {filtered.length === 0 && (
                        <p className="sc-empty">No metals match your search.</p>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
