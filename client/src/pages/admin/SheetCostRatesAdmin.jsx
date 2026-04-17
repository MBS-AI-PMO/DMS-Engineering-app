import { useState, useEffect, useCallback, useMemo } from 'react';
import { Layers, Plus, Trash2, Pencil, X, Info, Package, Ruler } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchSheetCostRates, createSheetCostRate, updateSheetCostRate, deleteSheetCostRate, fetchCategories } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

const INCH_TO_MM = 25.4;
const EMPTY_FORM = { family: '', thickness_in: '', thickness_mm: '', ga: '', sheet_cost_5x10: '' };

const INP = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontWeight: 600, fontSize: '0.9rem', background: 'white', color: '#1e293b', outline: 'none' };

function fmt(val, decimals = 4) {
    const n = parseFloat(val);
    if (isNaN(n)) return val;
    return parseFloat(n.toFixed(decimals)).toString();
}

function parseNum(val) {
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
}

function getThicknessIn(row) {
    const candidates = [row?.thickness, row?.max_thick, row?.min_thick];
    for (const candidate of candidates) {
        const n = parseNum(candidate);
        if (n != null) return n;
    }
    return null;
}

function getSheetCost5x10(row) {
    const candidates = [row?.sheet_cost_5x10, row?.sheet_cost_4x8];
    for (const candidate of candidates) {
        const n = parseNum(candidate);
        if (n != null) return n;
    }
    return null;
}

function normalizeFamily(value) {
    return String(value || '').trim().toLowerCase();
}

export default function SheetCostRatesAdmin() {
    const MotionDiv = motion.div;
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
        const thicknessIn = getThicknessIn(row);
        const thicknessMm = thicknessIn != null ? thicknessIn * INCH_TO_MM : null;
        const sheetCost = getSheetCost5x10(row);
        setEditingRow(row);
        setForm({
            family:         row.family || '',
            thickness_in:   thicknessIn != null ? fmt(thicknessIn, 6) : '',
            thickness_mm:   thicknessMm != null ? fmt(thicknessMm, 3) : '',
            ga:             row.ga != null ? String(row.ga) : '',
            sheet_cost_5x10: sheetCost != null ? fmt(sheetCost, 4) : '',
        });
        setModalOpen(true);
    };

    const closeModal = () => { setModalOpen(false); setEditingRow(null); setForm(EMPTY_FORM); };

    const handleThicknessInChange = (value) => {
        const parsedIn = parseNum(value);
        setForm(prev => ({
            ...prev,
            thickness_in: value,
            thickness_mm: value === '' ? '' : parsedIn == null ? prev.thickness_mm : fmt(parsedIn * INCH_TO_MM, 3)
        }));
    };

    const handleThicknessMmChange = (value) => {
        const parsedMm = parseNum(value);
        setForm(prev => ({
            ...prev,
            thickness_mm: value,
            thickness_in: value === '' ? '' : parsedMm == null ? prev.thickness_in : fmt(parsedMm / INCH_TO_MM, 6)
        }));
    };

    const handleSave = async () => {
        const thicknessIn = parseNum(form.thickness_in);
        const thicknessMm = parseNum(form.thickness_mm);
        const resolvedThicknessIn = thicknessIn != null ? thicknessIn : (thicknessMm != null ? (thicknessMm / INCH_TO_MM) : null);
        const sheetCost5x10 = parseNum(form.sheet_cost_5x10);
        const parsedGauge = form.ga === '' ? null : parseInt(form.ga, 10);

        if (!form.family || resolvedThicknessIn == null || sheetCost5x10 == null) {
            toast('Family, thickness (in or mm), and sheet cost are required.', 'error');
            return;
        }
        if (resolvedThicknessIn <= 0) {
            toast('Thickness must be greater than zero.', 'error');
            return;
        }
        if (sheetCost5x10 < 0) {
            toast('Sheet cost cannot be negative.', 'error');
            return;
        }
        if (form.ga !== '' && !Number.isFinite(parsedGauge)) {
            toast('Gauge must be a whole number.', 'error');
            return;
        }

        const payload = {
            family: form.family,
            thickness: resolvedThicknessIn,
            ga: parsedGauge,
            sheet_cost_5x10: sheetCost5x10,
        };

        try {
            setSaving(true);
            if (editingRow) {
                await updateSheetCostRate(editingRow.id, payload);
                toast('Sheet cost updated.', 'success');
            } else {
                await createSheetCostRate(payload);
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

    const grouped = useMemo(() => {
        const groupedByFamily = {};
        for (const row of rates) {
            const family = row.family || 'Uncategorized';
            if (!groupedByFamily[family]) groupedByFamily[family] = [];
            groupedByFamily[family].push(row);
        }

        for (const family of Object.keys(groupedByFamily)) {
            groupedByFamily[family].sort((a, b) => {
                const aTh = getThicknessIn(a);
                const bTh = getThicknessIn(b);
                if (aTh == null && bTh == null) return 0;
                if (aTh == null) return 1;
                if (bTh == null) return -1;
                return aTh - bTh;
            });
        }

        return groupedByFamily;
    }, [rates]);

    const families = useMemo(() => Object.keys(grouped), [grouped]);

    const gaugeByCategory = useMemo(() => {
        const categoryNameByKey = new Map();
        for (const category of categories) {
            const categoryName = String(category?.name || '').trim();
            if (!categoryName) continue;
            categoryNameByKey.set(normalizeFamily(categoryName), categoryName);
        }

        const statsByKey = new Map();
        for (const row of rates) {
            const family = String(row?.family || '').trim();
            if (!family) continue;
            const key = normalizeFamily(family);
            if (!statsByKey.has(key)) {
                statsByKey.set(key, {
                    family,
                    entryCount: 0,
                    gauges: [],
                });
            }

            const stat = statsByKey.get(key);
            stat.entryCount += 1;
            const ga = parseNum(row.ga);
            if (ga != null) stat.gauges.push(ga);
        }

        const orderedKeys = [];
        const seenKeys = new Set();
        const pushKey = (key) => {
            if (!key || seenKeys.has(key)) return;
            seenKeys.add(key);
            orderedKeys.push(key);
        };

        for (const key of categoryNameByKey.keys()) pushKey(key);
        for (const key of statsByKey.keys()) pushKey(key);

        return orderedKeys.map((key) => {
            const stat = statsByKey.get(key);
            const gauges = stat?.gauges || [];
            const minGauge = gauges.length > 0 ? Math.min(...gauges) : null;
            const maxGauge = gauges.length > 0 ? Math.max(...gauges) : null;

            return {
                family: stat?.family || categoryNameByKey.get(key) || key,
                entryCount: stat?.entryCount || 0,
                minGauge,
                maxGauge,
            };
        });
    }, [categories, rates]);

    return (
        <div className="admin-page-wrapper">
            {/* ── Header ── */}
            <header className="admin-page-header">
                <div>
                    <h1 className="admin-page-title">Sheet Material Costs</h1>
                    <p className="admin-page-subtitle">5x10 sheet price per material family and thickness, shown in both inches and millimeters.</p>
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
                            { step: '2', label: 'Look up sheet cost by metal category and thickness', sub: 'uses category first, then nearest configured thickness if needed' },
                            { step: '3', label: 'Calculate how many parts fit on one 5x10 sheet', sub: 'accounting for edge buffer, part gap, and kerf' },
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
                        <div><span style={{ color: '#38bdf8' }}>usable_L</span> = 120 - 2*0.125 + 0.0625 <span style={{ color: '#64748b' }}>(= 119.8125)</span></div>
                        <div><span style={{ color: '#38bdf8' }}>usable_W</span> = 60 - 2*0.125 + 0.0625 <span style={{ color: '#64748b' }}>(= 59.8125)</span></div>
                        <div style={{ marginTop: 4 }}><span style={{ color: '#34d399' }}>pps</span> = floor(usable_L / buffered_L) * floor(usable_W / buffered_W)</div>
                        <div><span style={{ color: '#f59e0b' }}>cost/unit</span> = sheet_cost_5x10 / pps</div>
                    </div>
                    <div style={{ marginTop: 14, padding: '10px 14px', background: '#1e293b', borderRadius: 10, border: '1px solid #334155' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Example</div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.8 }}>
                            Part: 10in x 5in | Sheet cost: $90<br />
                            buffered: 10.0725 x 5.0725<br />
                            pps = floor(119.8125/10.0725) * floor(59.8125/5.0725) = <span style={{ color: '#34d399' }}>11 * 11 = 121</span><br />
                            <strong style={{ color: '#f59e0b' }}>cost/unit = $90 / 121 = $0.74</strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Gauge summary by category ── */}
            <div style={{ marginBottom: 20, padding: '16px 18px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Ruler size={15} color="#334155" />
                    <strong style={{ fontSize: '0.86rem', color: '#1e293b' }}>Gauge range by metal category</strong>
                </div>
                {gaugeByCategory.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>No category gauge data yet.</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                        {gaugeByCategory.map((item) => (
                            <div key={item.family} style={{ padding: '10px 12px', borderRadius: 10, background: 'white', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 700, marginBottom: 4 }}>{item.family}</div>
                                <div style={{ fontSize: '0.75rem', color: '#475569' }}>Min GA: <strong>{item.minGauge != null ? item.minGauge : 'N/A'}</strong></div>
                                <div style={{ fontSize: '0.75rem', color: '#475569' }}>Max GA: <strong>{item.maxGauge != null ? item.maxGauge : 'N/A'}</strong></div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>{item.entryCount} sheet cost row(s)</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Important note ── */}
            <div style={{ marginBottom: 20, padding: '12px 18px', background: '#eff6ff', borderRadius: 12, border: '1px solid #bfdbfe', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Info size={15} color="#2563eb" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: '0.82rem', color: '#1e40af', lineHeight: 1.5 }}>
                    <strong>Family must match the metal's category name exactly</strong> (e.g. "Aluminum", "Stainless Steel").
                    Go to <strong>Metals &gt; edit a metal</strong> to see its category.
                    Thickness is entered as a single value and shown in both inches and mm.
                </div>
            </div>

            {/* ── Table ── */}
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                {loading ? (
                    <div style={{ padding: '16px 18px' }}>
                        {[...Array(6)].map((_, i) => (
                            <div
                                key={`sheet-skel-${i}`}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1.1fr 0.8fr 0.9fr 0.9fr 1fr 0.8fr',
                                    gap: 14,
                                    alignItems: 'center',
                                    padding: '14px 6px',
                                    borderBottom: i < 5 ? '1px solid #f8fafc' : 'none',
                                }}
                            >
                                <div className="skeleton-box" style={{ width: '68%', height: 24, borderRadius: 999 }} />
                                <div className="skeleton-box" style={{ width: '44%', height: 16 }} />
                                <div className="skeleton-box" style={{ width: '52%', height: 16 }} />
                                <div className="skeleton-box" style={{ width: '52%', height: 16 }} />
                                <div className="skeleton-box" style={{ width: '62%', height: 16 }} />
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <div className="skeleton-box" style={{ width: 34, height: 34, borderRadius: 9 }} />
                                    <div className="skeleton-box" style={{ width: 34, height: 34, borderRadius: 9 }} />
                                </div>
                            </div>
                        ))}
                    </div>
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
                                {['Family', 'Gauge (GA)', 'Thickness (in)', 'Thickness (mm)', 'Sheet Cost 5x10 ($)', 'Actions'].map(h => (
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
                                                : <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>N/A</span>
                                            }
                                        </td>

                                        {/* Thickness in */}
                                        <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontWeight: 600, color: '#475569', fontSize: '0.9rem' }}>
                                            {(() => {
                                                const thicknessIn = getThicknessIn(row);
                                                return thicknessIn != null ? fmt(thicknessIn, 4) : 'N/A';
                                            })()}
                                        </td>

                                        {/* Thickness mm */}
                                        <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontWeight: 600, color: '#475569', fontSize: '0.9rem' }}>
                                            {(() => {
                                                const thicknessIn = getThicknessIn(row);
                                                return thicknessIn != null ? fmt(thicknessIn * INCH_TO_MM, 3) : 'N/A';
                                            })()}
                                        </td>

                                        {/* Sheet cost */}
                                        <td style={{ padding: '16px 24px' }}>
                                            <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '1rem' }}>
                                                {(() => {
                                                    const sheetCost = getSheetCost5x10(row);
                                                    return sheetCost != null ? `$${sheetCost.toFixed(2)}` : 'N/A';
                                                })()}
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
                        <MotionDiv
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
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>One row per category + gauge + thickness</div>
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

                                {/* Thickness point */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Thickness (in)</label>
                                        <input type="number" step="any" min="0" value={form.thickness_in} onChange={e => handleThicknessInChange(e.target.value)} placeholder="e.g. 0.125" style={INP} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Thickness (mm)</label>
                                        <input type="number" step="any" min="0" value={form.thickness_mm} onChange={e => handleThicknessMmChange(e.target.value)} placeholder="e.g. 3.175" style={INP} />
                                    </div>
                                </div>
                                <div style={{ padding: '8px 12px', background: '#f0f9ff', borderRadius: 8, fontSize: '0.75rem', color: '#0369a1', border: '1px solid #bae6fd' }}>
                                    Enter thickness in either inches or mm. Both inputs stay synchronized.
                                </div>

                                {/* Sheet cost */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sheet Cost 5x10 ($)</label>
                                    <input type="number" step="0.01" min="0" value={form.sheet_cost_5x10} onChange={e => setForm(f => ({ ...f, sheet_cost_5x10: e.target.value }))} placeholder="e.g. 90.00" style={{ ...INP, fontWeight: 700 }} />
                                    <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: 4, display: 'block' }}>Price of one 5 ft x 10 ft (120 in x 60 in) sheet</span>
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
                        </MotionDiv>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
