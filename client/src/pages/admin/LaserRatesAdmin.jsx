import { useState, useEffect, useCallback } from 'react';
import { Zap, Plus, Trash2, Pencil, X, AlertTriangle, ChevronRight, Info } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { fetchLaserRates, createLaserRate, updateLaserRate, deleteLaserRate, fetchCategories } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

const EMPTY_FORM = { material_family: 'generic', thickness: '', cut_rate: '', pierce_time: '' };

const INP = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontWeight: 600, fontSize: '0.9rem', background: 'white', color: '#1e293b', outline: 'none' };

function fmt(val, decimals = 4) {
    const n = parseFloat(val);
    if (isNaN(n)) return val;
    // Remove trailing zeros after decimal
    return parseFloat(n.toFixed(decimals)).toString();
}

function getRowWarnings(row) {
    const thickness = parseFloat(row.thickness);
    const cutRate = parseFloat(row.cut_rate);
    const pierceTime = parseFloat(row.pierce_time);

    const warnings = [];
    if (!Number.isFinite(thickness) || thickness <= 0) warnings.push('Thickness must be greater than 0');
    if (!Number.isFinite(cutRate) || cutRate <= 0) warnings.push('Cut rate must be greater than 0');
    if (!Number.isFinite(pierceTime) || pierceTime < 0) warnings.push('Pierce time must be 0 or greater');

    return warnings;
}

export default function LaserRatesAdmin() {
    const toast = useToast();
    const [rates, setRates]         = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading]     = useState(true);
    const [saving, setSaving]       = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingRow, setEditingRow] = useState(null); // null = new
    const [form, setForm]           = useState(EMPTY_FORM);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchLaserRates();
            setRates(data || []);
        } catch (err) {
            toast('Failed to load laser rates: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        fetchCategories().then(data => setCategories(data || [])).catch(() => {});
    }, []);

    const openNew = () => {
        setEditingRow(null);
        setForm(EMPTY_FORM);
        setModalOpen(true);
    };

    const openEdit = (row) => {
        setEditingRow(row);
        setForm({
            material_family: row.material_family,
            thickness:       fmt(row.thickness, 6),
            cut_rate:        fmt(row.cut_rate, 4),
            pierce_time:     fmt(row.pierce_time, 4),
        });
        setModalOpen(true);
    };

    const closeModal = () => { setModalOpen(false); setEditingRow(null); setForm(EMPTY_FORM); };

    const handleSave = async () => {
        if (!form.thickness || !form.cut_rate || form.pierce_time === '') {
            toast('All fields are required.', 'error');
            return;
        }
        try {
            setSaving(true);
            if (editingRow) {
                await updateLaserRate(editingRow.id, form);
                toast('Laser rate updated.', 'success');
            } else {
                await createLaserRate(form);
                toast('Laser rate added.', 'success');
            }
            closeModal();
            await load();
        } catch (err) {
            toast('Save failed: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this laser cut rate?')) return;
        try {
            await deleteLaserRate(id);
            toast('Deleted.', 'success');
            await load();
        } catch (err) {
            toast('Delete failed: ' + err.message, 'error');
        }
    };

    return (
        <div className="admin-page-wrapper">
            {/* ── Header ── */}
            <header className="admin-page-header">
                <div>
                    <h1 className="admin-page-title">Laser Cut Rates</h1>
                    <p className="admin-page-subtitle">Cut speed and pierce time by thickness — used to calculate laser job runtime.</p>
                </div>
                <button
                    onClick={openNew}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}
                >
                    <Plus size={16} /> Add Rate
                </button>
            </header>

            {/* ── How it works ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                {/* Lookup logic */}
                <div style={{ padding: '20px 24px', background: '#0f172a', borderRadius: 16, border: '1px solid #1e293b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Zap size={15} color="white" />
                        </div>
                        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lookup Logic</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[
                            { step: '1', text: 'Part thickness is known from the uploaded file' },
                            { step: '2', text: 'Find rows where thickness ≥ part thickness' },
                            { step: '3', text: 'Pick the row with the smallest such thickness' },
                            { step: '4', text: 'Use its cut_rate and pierce_time in the formula' },
                        ].map(s => (
                            <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 20, height: 20, borderRadius: 6, background: '#1e293b', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, color: '#6366f1', flexShrink: 0 }}>{s.step}</div>
                                <span style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.4 }}>{s.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Formula */}
                <div style={{ padding: '20px 24px', background: '#0f172a', borderRadius: 16, border: '1px solid #1e293b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Info size={15} color="white" />
                        </div>
                        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price Formula</span>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#94a3b8', lineHeight: 2 }}>
                        <div><span style={{ color: '#38bdf8' }}>runtime</span> = perimeter_mm <span style={{ color: '#6366f1' }}>÷</span> cut_rate <span style={{ color: '#6366f1' }}>÷</span> 3600</div>
                        <div style={{ paddingLeft: 16, color: '#64748b' }}>+ pierce_count <span style={{ color: '#6366f1' }}>×</span> pierce_time <span style={{ color: '#6366f1' }}>÷</span> 3600</div>
                        <div style={{ marginTop: 4 }}><span style={{ color: '#38bdf8' }}>setup_hrs</span> = 0.3 h <span style={{ color: '#64748b' }}>(0.25 h if &gt; 0.25&Prime;)</span></div>
                        <div><span style={{ color: '#34d399' }}>cost/unit</span> = rate × <span style={{ color: '#f59e0b' }}>(setup_hrs÷qty + runtime)</span></div>
                    </div>
                </div>
            </div>

            {/* ── Table ── */}
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                {loading ? (
                    <div style={{ padding: '16px 18px' }}>
                        {[...Array(6)].map((_, i) => (
                            <div
                                key={`laser-skel-${i}`}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1.1fr 1fr 1fr 1fr 0.7fr',
                                    gap: 14,
                                    alignItems: 'center',
                                    padding: '14px 6px',
                                    borderBottom: i < 5 ? '1px solid #f8fafc' : 'none',
                                }}
                            >
                                <div className="skeleton-box" style={{ width: '62%', height: 24, borderRadius: 999 }} />
                                <div className="skeleton-box" style={{ width: '48%', height: 16 }} />
                                <div className="skeleton-box" style={{ width: '56%', height: 16 }} />
                                <div className="skeleton-box" style={{ width: '42%', height: 16 }} />
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <div className="skeleton-box" style={{ width: 34, height: 34, borderRadius: 9 }} />
                                    <div className="skeleton-box" style={{ width: 34, height: 34, borderRadius: 9 }} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                {['Material Family', 'Thickness (in)', 'Cut Rate (mm/s)', 'Pierce Time (s)', 'Actions'].map(h => (
                                    <th key={h} style={{ padding: '14px 24px', textAlign: 'left', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', background: '#fafafa' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rates.map((row, i) => {
                                const rowWarnings = getRowWarnings(row);
                                const hasWarning = rowWarnings.length > 0;
                                return (
                                    <tr key={row.id} style={{ borderTop: i > 0 ? '1px solid #f8fafc' : 'none', transition: 'background 0.15s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#fafbff'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                    >
                                        {/* Family badge */}
                                        <td style={{ padding: '16px 24px' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: row.material_family === 'generic' ? '#f1f5f9' : '#eff6ff', color: row.material_family === 'generic' ? '#475569' : '#2563eb', fontSize: '0.8rem', fontWeight: 700 }}>
                                                {row.material_family === 'generic' && <span style={{ opacity: 0.5 }}>◆</span>}
                                                {row.material_family}
                                            </span>
                                        </td>

                                        {/* Thickness */}
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', fontFamily: 'monospace' }}>{fmt(row.thickness, 6)}</span>
                                                {hasWarning && (
                                                    <span
                                                        title={rowWarnings.join(' • ')}
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: '#fffbeb', border: '1px solid #fcd34d', fontSize: '10px', fontWeight: 700, color: '#92400e' }}
                                                    >
                                                        <AlertTriangle size={10} /> WARN
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Cut rate */}
                                        <td style={{ padding: '16px 24px' }}>
                                            <span style={{ fontWeight: 600, color: '#1e293b', fontFamily: 'monospace' }}>{fmt(row.cut_rate, 1)}</span>
                                            <span style={{ marginLeft: 6, fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>mm/s</span>
                                        </td>

                                        {/* Pierce time */}
                                        <td style={{ padding: '16px 24px' }}>
                                            <span style={{ fontWeight: 600, color: '#1e293b', fontFamily: 'monospace' }}>{fmt(row.pierce_time, 2)}</span>
                                            <span style={{ marginLeft: 6, fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>s</span>
                                        </td>

                                        {/* Actions */}
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button onClick={() => openEdit(row)} title="Edit" style={{ width: 34, height: 34, borderRadius: 9, background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                                                    onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}>
                                                    <Pencil size={14} color="#475569" />
                                                </button>
                                                <button onClick={() => handleDelete(row.id)} title="Delete" style={{ width: 34, height: 34, borderRadius: 9, background: '#fff1f2', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                                                    onMouseLeave={e => e.currentTarget.style.background = '#fff1f2'}>
                                                    <Trash2 size={14} color="#ef4444" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {rates.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                                        <Zap size={32} color="#e2e8f0" style={{ marginBottom: 12 }} />
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>No laser rates yet</div>
                                        <div style={{ fontSize: '0.8rem' }}>Click <strong>Add Rate</strong> to define your first thickness entry.</div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── Add / Edit Modal ── */}
            <AnimatePresence>
                {modalOpen && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                        <Motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 14 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 14 }}
                            style={{ width: '100%', maxWidth: 460, background: 'white', borderRadius: 20, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
                        >
                            {/* Modal header */}
                            <div style={{ padding: '22px 28px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Zap size={17} color="white" />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem' }}>{editingRow ? 'Edit Laser Rate' : 'Add Laser Rate'}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>One row per thickness break</div>
                                    </div>
                                </div>
                                <button onClick={closeModal} style={{ width: 30, height: 30, borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <X size={15} color="#64748b" />
                                </button>
                            </div>

                            {/* Modal body */}
                            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Material Family</label>
                                        <select value={form.material_family} onChange={e => setForm(f => ({ ...f, material_family: e.target.value }))} style={{ ...INP, cursor: 'pointer' }}>
                                            <option value="generic">generic (all metals)</option>
                                            {categories.map(c => (
                                                <option key={c.id} value={c.name}>{c.name}</option>
                                            ))}
                                        </select>
                                        <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: 4, display: 'block' }}>Use "generic" to apply to all metals</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Max Thickness (in)</label>
                                        <input type="number" step="any" value={form.thickness} onChange={e => setForm(f => ({ ...f, thickness: e.target.value }))} placeholder="e.g. 0.125" style={INP} />
                                        <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: 4, display: 'block' }}>Parts ≤ this thickness use this row</span>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cut Rate (mm/s)</label>
                                        <input type="number" step="any" value={form.cut_rate} onChange={e => setForm(f => ({ ...f, cut_rate: e.target.value }))} placeholder="e.g. 110" style={INP} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pierce Time (s)</label>
                                        <input type="number" step="any" value={form.pierce_time} onChange={e => setForm(f => ({ ...f, pierce_time: e.target.value }))} placeholder="e.g. 0.2" style={INP} />
                                    </div>
                                </div>
                            </div>

                            {/* Modal footer */}
                            <div style={{ padding: '16px 28px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button onClick={closeModal} style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', fontWeight: 700, color: '#64748b', cursor: 'pointer', fontSize: '0.875rem' }}>
                                    Cancel
                                </button>
                                <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', opacity: saving ? 0.7 : 1 }}>
                                    {saving ? 'Saving…' : editingRow ? 'Save Changes' : 'Add Rate'}
                                </button>
                            </div>
                        </Motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
