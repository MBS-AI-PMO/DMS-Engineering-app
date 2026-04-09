import { useState, useEffect, useCallback } from 'react';
import { Layers, Plus, Trash2, Pencil, X, Info, ChevronRight, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchSheetCostRates, createSheetCostRate, updateSheetCostRate, deleteSheetCostRate, fetchCategories } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

const EMPTY_FORM = { family: '', min_thick: '', max_thick: '', ga: '', sheet_cost_4x8: '' };

const INP = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontWeight: 600, fontSize: '0.9rem', background: 'white', color: '#1e293b', outline: 'none' };

function fmt(val, decimals = 4) {
    const n = parseFloat(val);
    if (isNaN(n)) return val;
    return parseFloat(n.toFixed(decimals)).toString();
}

export default function SheetCostRatesAdmin() {
    const toast = useToast();
    const [rates, setRates]           = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading]       = useState(true);
    const [saving, setSaving]         = useState(false);
    const [modalOpen, setModalOpen]   = useState(false);
    const [editingRow, setEditingRow] = useState(null);
    const [form, setForm]             = useState(EMPTY_FORM);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchSheetCostRates();
            setRates(data || []);
        } catch (err) {
            toast('Failed to load sheet cost rates: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        fetchCategories().then(data => setCategories(data || [])).catch(() => {});
    }, []);

    const openNew = () => { setEditingRow(null); setForm(EMPTY_FORM); setModalOpen(true); };

    const openEdit = (row) => {
        setEditingRow(row);
        setForm({
            family:         row.family,
            min_thick:      fmt(row.min_thick, 6),
            max_thick:      fmt(row.max_thick, 6),
            ga:             row.ga != null ? String(row.ga) : '',
            sheet_cost_4x8: fmt(row.sheet_cost_4x8, 4),
        });
        setModalOpen(true);
    };

    const closeModal = () => { setModalOpen(false); setEditingRow(null); setForm(EMPTY_FORM); };

    const handleSave = async () => {
        if (!form.family || form.min_thick === '' || form.max_thick === '' || form.sheet_cost_4x8 === '') {
            toast('Family, thickness range, and sheet cost are required.', 'error');
            return;
        }
        try {
            setSaving(true);
            if (editingRow) {
                await updateSheetCostRate(editingRow.id, form);
                toast('Sheet cost updated.', 'success');
            } else {
                await createSheetCostRate(form);
                toast('Sheet cost added.', 'success');
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
        if (!window.confirm('Delete this sheet cost rate?')) return;
        try {
            await deleteSheetCostRate(id);
            toast('Deleted.', 'success');
            await load();
        } catch (err) {
            toast('Delete failed: ' + err.message, 'error');
        }
    };

    // Group by family for display
    const grouped = rates.reduce((acc, r) => {
        if (!acc[r.family]) acc[r.family] = [];
        acc[r.family].push(r);
        return acc;
    }, {});
    const families = Object.keys(grouped);

    return (
        <div className="admin-page-wrapper">
            {/* ── Header ── */}
            <header className="admin-page-header">
                <div>
                    <h1 className="admin-page-title">Sheet Material Costs</h1>
                    <p className="admin-page-subtitle">4×8 sheet price per material family and thickness range — used to calculate material cost per part.</p>
                </div>
                <button
                    onClick={openNew}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: '12px', background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(14,165,233,0.35)' }}
                >
                    <Plus size={16} /> Add Rate
                </button>
            </header>

            {/* ── Explanation cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                {/* How it works */}
                <div style={{ padding: '20px 24px', background: '#0f172a', borderRadius: 16, border: '1px solid #1e293b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Layers size={15} color="white" />
                        </div>
                        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>How Material Cost Works</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[
                            { step: '1', label: 'Part dimensions come from the uploaded file', sub: 'length, width, and thickness are all known' },
                            { step: '2', label: 'Look up sheet cost for this metal + thickness', sub: 'matches family AND min_thick < part < max_thick' },
                            { step: '3', label: 'Calculate how many parts fit on one 4×8 sheet', sub: 'accounting for edge buffer, part gap, and kerf' },
                            { step: '4', label: 'Material cost = sheet cost ÷ parts per sheet', sub: 'each part pays its proportional share' },
                        ].map(s => (
                            <div key={s.step} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                <div style={{ width: 20, height: 20, borderRadius: 6, background: '#1e293b', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, color: '#0ea5e9', flexShrink: 0, marginTop: 1 }}>{s.step}</div>
                                <div>
                                    <div style={{ fontSize: '0.8rem', color: '#e2e8f0', fontWeight: 600, lineHeight: 1.3 }}>{s.label}</div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>{s.sub}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Formula + constants */}
                <div style={{ padding: '20px 24px', background: '#0f172a', borderRadius: 16, border: '1px solid #1e293b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Info size={15} color="white" />
                        </div>
                        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nesting Formula</span>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.9 }}>
                        <div><span style={{ color: '#38bdf8' }}>buffered_L</span> = part_L + 0.0625 + 0.01</div>
                        <div><span style={{ color: '#38bdf8' }}>buffered_W</span> = part_W + 0.0625 + 0.01</div>
                        <div><span style={{ color: '#38bdf8' }}>usable_L</span> = 96 − 2×0.125 + 0.0625 <span style={{ color: '#64748b' }}>(= 95.8125)</span></div>
                        <div><span style={{ color: '#38bdf8' }}>usable_W</span> = 48 − 2×0.125 + 0.0625 <span style={{ color: '#64748b' }}>(= 47.8125)</span></div>
                        <div style={{ marginTop: 4 }}><span style={{ color: '#34d399' }}>pps</span> = floor(usable_L / buffered_L) <span style={{ color: '#6366f1' }}>×</span> floor(usable_W / buffered_W)</div>
                        <div><span style={{ color: '#f59e0b' }}>cost/unit</span> = sheet_cost_4x8 <span style={{ color: '#6366f1' }}>÷</span> pps</div>
                    </div>
                    <div style={{ marginTop: 14, padding: '10px 14px', background: '#1e293b', borderRadius: 10, border: '1px solid #334155' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Example</div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.8 }}>
                            Part: 10″ × 5″ &nbsp;|&nbsp; Sheet cost: $50<br />
                            buffered: 10.0725 × 5.0725<br />
                            pps = floor(95.8125/10.0725) × floor(47.8125/5.0725) = <span style={{ color: '#34d399' }}>9 × 9 = 81</span><br />
                            <strong style={{ color: '#f59e0b' }}>cost/unit = $50 ÷ 81 = $0.62</strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Important note ── */}
            <div style={{ marginBottom: 20, padding: '12px 18px', background: '#eff6ff', borderRadius: 12, border: '1px solid #bfdbfe', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Info size={15} color="#2563eb" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: '0.82rem', color: '#1e40af', lineHeight: 1.5 }}>
                    <strong>Family must match the metal's category name exactly</strong> (e.g. "Aluminum", "Stainless Steel").
                    Go to <strong>Metals → edit a metal</strong> to see its category. Entries are matched by
                    <code style={{ background: '#dbeafe', padding: '1px 5px', borderRadius: 4, margin: '0 3px' }}>min_thick &lt; part_thickness</code>
                    AND
                    <code style={{ background: '#dbeafe', padding: '1px 5px', borderRadius: 4, margin: '0 3px' }}>max_thick ≥ part_thickness</code>.
                </div>
            </div>

            {/* ── Table ── */}
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
                ) : rates.length === 0 ? (
                    <div style={{ padding: '70px', textAlign: 'center', color: '#94a3b8' }}>
                        <Package size={36} color="#e2e8f0" style={{ marginBottom: 14 }} />
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>No sheet costs configured</div>
                        <div style={{ fontSize: '0.8rem' }}>Click <strong>Add Rate</strong> to define your first entry. Without this data, material cost will show as $0.</div>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                {['Family', 'Gauge (GA)', 'Min Thick (in)', 'Max Thick (in)', 'Sheet Cost 4×8 ($)', 'Actions'].map(h => (
                                    <th key={h} style={{ padding: '14px 24px', textAlign: 'left', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', background: '#fafafa' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {families.map((family, fi) => (
                                grouped[family].map((row, i) => (
                                    <tr key={row.id}
                                        style={{ borderTop: (fi > 0 || i > 0) ? '1px solid #f8fafc' : 'none', transition: 'background 0.15s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#fafbff'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                    >
                                        {/* Family — only show label on first row of each family group */}
                                        <td style={{ padding: '16px 24px' }}>
                                            {i === 0 ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: '#eff6ff', color: '#2563eb', fontSize: '0.8rem', fontWeight: 700 }}>
                                                    <Layers size={11} /> {family}
                                                </span>
                                            ) : (
                                                <span style={{ paddingLeft: 14, color: '#cbd5e1', fontSize: '0.8rem' }}>└</span>
                                            )}
                                        </td>

                                        {/* GA */}
                                        <td style={{ padding: '16px 24px' }}>
                                            {row.ga != null
                                                ? <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>GA {row.ga}</span>
                                                : <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>—</span>
                                            }
                                        </td>

                                        {/* Thickness range */}
                                        <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontWeight: 600, color: '#475569', fontSize: '0.9rem' }}>
                                            {fmt(row.min_thick, 4)}
                                        </td>
                                        <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontWeight: 600, color: '#475569', fontSize: '0.9rem' }}>
                                            {fmt(row.max_thick, 4)}
                                        </td>

                                        {/* Sheet cost */}
                                        <td style={{ padding: '16px 24px' }}>
                                            <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '1rem' }}>
                                                ${parseFloat(row.sheet_cost_4x8).toFixed(2)}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button onClick={() => openEdit(row)} title="Edit"
                                                    style={{ width: 34, height: 34, borderRadius: 9, background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                                                    onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}>
                                                    <Pencil size={14} color="#475569" />
                                                </button>
                                                <button onClick={() => handleDelete(row.id)} title="Delete"
                                                    style={{ width: 34, height: 34, borderRadius: 9, background: '#fff1f2', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                                                    onMouseLeave={e => e.currentTarget.style.background = '#fff1f2'}>
                                                    <Trash2 size={14} color="#ef4444" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── Add / Edit Modal ── */}
            <AnimatePresence>
                {modalOpen && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 14 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 14 }}
                            style={{ width: '100%', maxWidth: 500, background: 'white', borderRadius: 20, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
                        >
                            {/* Header */}
                            <div style={{ padding: '22px 28px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Layers size={17} color="white" />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem' }}>{editingRow ? 'Edit Sheet Cost' : 'Add Sheet Cost'}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>One row per gauge / thickness range</div>
                                    </div>
                                </div>
                                <button onClick={closeModal} style={{ width: 30, height: 30, borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <X size={15} color="#64748b" />
                                </button>
                            </div>

                            {/* Body */}
                            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {/* Family + GA */}
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Material Family</label>
                                        <select value={form.family} onChange={e => setForm(f => ({ ...f, family: e.target.value }))} style={{ ...INP, cursor: 'pointer' }}>
                                            <option value="">— select family —</option>
                                            {categories.map(c => (
                                                <option key={c.id} value={c.name}>{c.name}</option>
                                            ))}
                                        </select>
                                        <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: 4, display: 'block' }}>Must match the metal's category name exactly</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gauge (GA)</label>
                                        <input type="number" value={form.ga} onChange={e => setForm(f => ({ ...f, ga: e.target.value }))} placeholder="e.g. 18" style={INP} />
                                        <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: 4, display: 'block' }}>Optional</span>
                                    </div>
                                </div>

                                {/* Thickness range */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Min Thickness (in)</label>
                                        <input type="number" step="any" value={form.min_thick} onChange={e => setForm(f => ({ ...f, min_thick: e.target.value }))} placeholder="e.g. 0.0" style={INP} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Max Thickness (in)</label>
                                        <input type="number" step="any" value={form.max_thick} onChange={e => setForm(f => ({ ...f, max_thick: e.target.value }))} placeholder="e.g. 0.06" style={INP} />
                                    </div>
                                </div>
                                <div style={{ padding: '8px 12px', background: '#f0f9ff', borderRadius: 8, fontSize: '0.75rem', color: '#0369a1', border: '1px solid #bae6fd' }}>
                                    Rule matches when: <code style={{ background: '#e0f2fe', padding: '1px 5px', borderRadius: 4 }}>min_thick &lt; part_thickness</code> AND <code style={{ background: '#e0f2fe', padding: '1px 5px', borderRadius: 4 }}>max_thick ≥ part_thickness</code>
                                </div>

                                {/* Sheet cost */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sheet Cost 4×8 ($)</label>
                                    <input type="number" step="0.01" min="0" value={form.sheet_cost_4x8} onChange={e => setForm(f => ({ ...f, sheet_cost_4x8: e.target.value }))} placeholder="e.g. 48.50" style={{ ...INP, fontWeight: 700 }} />
                                    <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: 4, display: 'block' }}>Price of one 4 ft × 8 ft (96″ × 48″) sheet</span>
                                </div>
                            </div>

                            {/* Footer */}
                            <div style={{ padding: '16px 28px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button onClick={closeModal} style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', fontWeight: 700, color: '#64748b', cursor: 'pointer', fontSize: '0.875rem' }}>
                                    Cancel
                                </button>
                                <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', opacity: saving ? 0.7 : 1 }}>
                                    {saving ? 'Saving…' : editingRow ? 'Save Changes' : 'Add Rate'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
