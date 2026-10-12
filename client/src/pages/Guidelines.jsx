import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { Check, Info } from 'lucide-react';
import { guidelinesData as staticGuidelines } from '../data/guidelinesData';
import { fetchGuidelines } from '../utils/api';
import { normalizeGuideline } from '../utils/guidelineUtils';
import Dropdown from '../components/Dropdown';
import '../styles/Shimmer.css';
import '../styles/GuidelinesPage.css';

/**
 * Design guidelines: a heading band over the gears photo, then the
 * services down the left and, for the one picked, its description, what
 * to check before ordering, and its size limits as one table per material
 * (material picked with tabs). Everything from the server shimmers until
 * it has loaded.
 */

const keyOf = (item) => item.service_id || item.id;

// Tables saved without headers get them from their row keys
// ("thickness", "min", "max"); give those readable names, thickness first.
const KNOWN_KEYS = { t: 'Thickness', thickness: 'Thickness', min: 'Min size', max: 'Max size' };
const isThickness = (header) => /^(t|thickness)$/i.test(String(header).trim());
const headerLabel = (header) => KNOWN_KEYS[header] || header;
const headerRank = (header) => (isThickness(header) ? 0 : header === 'min' ? 1 : header === 'max' ? 2 : 3);
const orderedHeaders = (headers = []) => headers
    .map((header, index) => ({ header, index }))
    .sort((a, b) => headerRank(a.header) - headerRank(b.header) || a.index - b.index)
    .map(({ header }) => header);

const cellText = (value) => {
    const text = value == null ? '' : String(value).trim();
    return text || '—';
};
const isEmptyCell = (text) => text === '—' || /^n\/?a$/i.test(text);

const Guidelines = () => {
    const [searchParams] = useSearchParams();
    const wantedService = searchParams.get('service');
    const [activeTab, setActiveTab] = useState(null);
    const [activeMaterial, setActiveMaterial] = useState(0);
    const [guidelines, setGuidelines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [offline, setOffline] = useState(false);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        let cancelled = false;
        const staticList = () => staticGuidelines.map(g => normalizeGuideline({ ...g, service_id: g.id }));
        fetchGuidelines()
            .then((data) => {
                if (cancelled) return;
                const list = Array.isArray(data) && data.length > 0 ? data.map(g => normalizeGuideline(g)) : staticList();
                setGuidelines(list);
                // A service page links here as ?service=<id>; open that one.
                const wanted = list.find(g => wantedService && String(keyOf(g)) === wantedService);
                setActiveTab(keyOf(wanted || list[0]));
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('Failed to fetch guidelines:', err);
                const list = staticList();
                setGuidelines(list);
                setActiveTab(keyOf(list[0]));
                setOffline(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [wantedService]);

    const activeData = guidelines.find(item => keyOf(item) === activeTab);
    const tables = activeData?.tables || [];
    const table = tables[Math.min(activeMaterial, Math.max(tables.length - 1, 0))];
    const headers = orderedHeaders(table?.headers);

    const materialCount = useMemo(() => {
        const names = new Set();
        guidelines.forEach(g => (g.tables || []).forEach(t => t.material && names.add(t.material)));
        return names.size;
    }, [guidelines]);

    const pick = (key) => {
        setActiveTab(key);
        setActiveMaterial(0);
    };

    const stat = (value) => (loading
        ? <span className="shimmer gl-sk-stat" aria-hidden="true" />
        : value);

    const fade = reduceMotion
        ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
        : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 }, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } };

    return (
        <div className="gl">
            {/* ── Heading band ── */}
            <section className="gl-hero" aria-labelledby="gl-title">
                <img
                    className="gl-hero-img"
                    src="/assets/guidelines-hero.webp"
                    alt=""
                    aria-hidden="true"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                />
                <div className="gl-hero-shade" aria-hidden="true" />
                <div className="gl-inner gl-hero-content">
                    <nav className="gl-crumbs" aria-label="Breadcrumb">
                        <Link to="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">Guidelines</span>
                    </nav>
                    <h1 id="gl-title" className="gl-title">Design guidelines</h1>
                    <p className="gl-lede">
                        Size limits and requirements for each service, by material and thickness.
                        Check your part here before you upload it.
                    </p>
                    <dl className="gl-stats" aria-busy={loading}>
                        <div className="gl-stat">
                            <dt>Services covered</dt>
                            <dd>{stat(guidelines.length)}</dd>
                        </div>
                        <div className="gl-stat">
                            <dt>Materials</dt>
                            <dd>{stat(materialCount || '—')}</dd>
                        </div>
                    </dl>
                </div>
            </section>

            {/* ── Guidelines ── */}
            <section className="gl-body" aria-label="Guidelines by service">
                <div className="gl-inner gl-layout">
                    {/* Services */}
                    <nav className="gl-nav" aria-label="Services">
                        <span className="gl-nav-label">Services</span>
                        {loading ? (
                            <ul className="gl-nav-list" aria-hidden="true">
                                {[0, 1, 2, 3, 4, 5].map(i => (
                                    <li key={i} className="gl-nav-sk"><span className="shimmer gl-sk-line" style={{ width: `${54 + ((i * 17) % 34)}%` }} /></li>
                                ))}
                            </ul>
                        ) : (
                            <ul className="gl-nav-list">
                                {guidelines.map(item => {
                                    const active = keyOf(item) === activeTab;
                                    return (
                                        <li key={keyOf(item)}>
                                            <button
                                                type="button"
                                                className={`gl-nav-btn${active ? ' is-active' : ''}`}
                                                aria-current={active ? 'true' : undefined}
                                                onClick={() => pick(keyOf(item))}
                                            >
                                                <span>{item.title}</span>
                                                {item.tables?.length > 0 && (
                                                    <span className="gl-nav-count" title={`${item.tables.length} materials`}>{item.tables.length}</span>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </nav>

                    {/* Selected service */}
                    <div className="gl-main">
                        {loading ? (
                            <div className="gl-panel" aria-hidden="true">
                                <span className="shimmer gl-sk-line is-title" />
                                <span className="shimmer gl-sk-line" />
                                <span className="shimmer gl-sk-line is-mid" />
                                <span className="gl-sk-tabs">
                                    {[88, 104, 96, 72].map((w, i) => <span key={i} className="shimmer gl-sk-tab" style={{ width: w }} />)}
                                </span>
                                <span className="gl-sk-table">
                                    {[0, 1, 2, 3, 4, 5].map(r => (
                                        <span key={r} className={`gl-sk-row${r === 0 ? ' is-head' : ''}`}>
                                            {[0, 1, 2, 3].map(c => <span key={c} className="shimmer gl-sk-cell" />)}
                                        </span>
                                    ))}
                                </span>
                            </div>
                        ) : !activeData ? (
                            <div className="gl-panel gl-empty">
                                <h2 className="gl-empty-title">No guidelines yet</h2>
                                <p>Guidelines will show here once they are added.</p>
                            </div>
                        ) : (
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.article key={activeTab} className="gl-panel" {...fade}>
                                    <h2 className="gl-service">{activeData.title}</h2>
                                    {activeData.content && <p className="gl-intro">{activeData.content}</p>}

                                    {offline && (
                                        <p className="gl-note">
                                            <Info size={15} aria-hidden="true" />
                                            Showing saved guidelines; the latest could not be loaded.
                                        </p>
                                    )}

                                    {activeData.requirements?.length > 0 && (
                                        <div className="gl-block">
                                            <h3 className="gl-block-title">Before you order</h3>
                                            <ul className="gl-checks">
                                                {activeData.requirements.map((req, i) => (
                                                    <li key={i}>
                                                        <span className="gl-check" aria-hidden="true"><Check size={13} /></span>
                                                        <span>{req}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {tables.length > 0 && (
                                        <div className="gl-block">
                                            <div className="gl-block-head">
                                                <h3 className="gl-block-title">Size limits by material</h3>
                                                {tables.length > 1 ? (
                                                    <Dropdown
                                                        className="gl-select"
                                                        label="Material"
                                                        value={tables.indexOf(table)}
                                                        onChange={setActiveMaterial}
                                                        options={tables.map((t, i) => ({ value: i, label: t.material || `Material ${i + 1}` }))}
                                                    />
                                                ) : (
                                                    table?.material && <span className="gl-select-single">{table.material}</span>
                                                )}
                                            </div>

                                            {table && (
                                                <div className="gl-table-wrap" tabIndex={0} aria-label={`${table.material || 'Material'} size limits`}>
                                                    <table className="gl-table">
                                                        <thead>
                                                            <tr>
                                                                {headers.map(h => <th key={h} scope="col">{headerLabel(h)}</th>)}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(table.rows || []).map((row, r) => (
                                                                <tr key={r}>
                                                                    {headers.map(h => {
                                                                        const text = cellText(row[h]);
                                                                        const Cell = isThickness(h) ? 'th' : 'td';
                                                                        return (
                                                                            <Cell key={h} scope={Cell === 'th' ? 'row' : undefined} className={isEmptyCell(text) ? 'is-empty' : undefined}>
                                                                                {text}
                                                                            </Cell>
                                                                        );
                                                                    })}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                </motion.article>
                            </AnimatePresence>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Guidelines;
