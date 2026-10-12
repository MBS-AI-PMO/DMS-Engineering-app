import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { ArrowRight, Search, X } from 'lucide-react';
import { metalsData as staticMetalsData } from '../data/metalsData';
import { fetchMetals, fetchCategories } from '../utils/api';
import { displayMetalName, parseThickness, thicknessBounds } from '../utils/metalDisplay';
import ThumbImage from '../components/ThumbImage';
import '../styles/Shimmer.css';
import '../styles/MetalsPage.css';

/**
 * The metals catalog: a dark heading band with live counts, then every
 * metal as a card (swatch, family, name, description, thicknesses) with
 * family filters and search, then a band that leads to instant pricing.
 * Numbers, filters and cards shimmer until the catalog has loaded.
 */

// The built-in swatch for the same metal (ids differ between the two
// lists, names don't).
const staticImageFor = (metal) => {
    const name = metal.name?.toLowerCase();
    return staticMetalsData.find(s => s.name?.toLowerCase() === name)?.image || '';
};

const ALL = 'All';

const MetalsPage = () => {
    const [selectedCategory, setSelectedCategory] = useState(ALL);
    const [searchQuery, setSearchQuery] = useState('');
    const [metals, setMetals] = useState([]);
    const [categoryOrder, setCategoryOrder] = useState([]);
    const [loading, setLoading] = useState(true);
    const reduceMotion = useReducedMotion();

    // Fetch from API on mount
    useEffect(() => {
        let cancelled = false;
        async function loadInitialData() {
            const [categoriesResult, metalsResult] = await Promise.allSettled([fetchCategories(), fetchMetals()]);
            if (cancelled) return;

            if (categoriesResult.status === 'fulfilled' && Array.isArray(categoriesResult.value)) {
                setCategoryOrder(categoriesResult.value.map(c => c.name).filter(Boolean));
            }

            if (metalsResult.status === 'fulfilled' && Array.isArray(metalsResult.value)) {
                setMetals(metalsResult.value.map(m => ({
                    id: m.id,
                    slug: m.slug,
                    name: m.name,
                    thickness: m.thickness,
                    image: m.image_path,
                    description: m.description,
                    category: m.category_name || '',
                })));
            } else {
                console.warn('API unavailable, using static data fallback:', metalsResult.reason?.message);
                setMetals(staticMetalsData.map(m => ({ ...m, category: m.category || '' })));
            }
            setLoading(false);
        }
        loadInitialData();
        return () => { cancelled = true; };
    }, []);

    // Families that hold at least one metal, in the admin's order, with counts.
    const families = useMemo(() => {
        const counts = new Map();
        metals.forEach(m => {
            if (m.category) counts.set(m.category, (counts.get(m.category) || 0) + 1);
        });
        const known = categoryOrder.filter(name => counts.has(name));
        const rest = [...counts.keys()].filter(name => !categoryOrder.includes(name));
        return [...known, ...rest].map(name => ({ name, count: counts.get(name) }));
    }, [metals, categoryOrder]);

    const activeCategory = selectedCategory === ALL || families.some(f => f.name === selectedCategory)
        ? selectedCategory
        : ALL;

    const filteredMetals = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return metals.filter(metal => {
            if (activeCategory !== ALL && metal.category !== activeCategory) return false;
            if (!query) return true;
            return [metal.name, displayMetalName(metal.name), metal.description, metal.category, metal.thickness]
                .some(text => text && String(text).toLowerCase().includes(query));
        });
    }, [metals, activeCategory, searchQuery]);

    const bounds = useMemo(() => thicknessBounds(metals.map(m => m.thickness)), [metals]);
    const isFiltered = activeCategory !== ALL || searchQuery.trim() !== '';

    const clearFilters = () => {
        setSelectedCategory(ALL);
        setSearchQuery('');
    };

    const stat = (value) => (loading
        ? <span className="shimmer mp-sk-stat" aria-hidden="true" />
        : value);

    return (
        <div className="mp">
            {/* ── Heading band ── */}
            <section className="mp-hero" aria-labelledby="mp-title">
                <div className="mp-inner">
                    <nav className="mp-crumbs" aria-label="Breadcrumb">
                        <Link to="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">Metals</span>
                    </nav>
                    <h1 id="mp-title" className="mp-title">Material catalog</h1>
                    <p className="mp-lede">
                        Sheet stock ready to cut. Pick a metal to see its thicknesses, specifications
                        and the services it works with.
                    </p>

                    <dl className="mp-stats" aria-busy={loading}>
                        <div className="mp-stat">
                            <dt>Metals in stock</dt>
                            <dd>{stat(metals.length)}</dd>
                        </div>
                        <div className="mp-stat">
                            <dt>Families</dt>
                            <dd>{stat(families.length || '—')}</dd>
                        </div>
                        <div className="mp-stat">
                            <dt>Thickness range</dt>
                            <dd>{stat(bounds ? `${bounds.min} – ${bounds.max}` : '—')}</dd>
                        </div>
                    </dl>

                    <div className="mp-hero-actions">
                        <Link to="/get-instant-pricing" className="mp-btn is-primary">
                            Get instant pricing
                            <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                        <Link to="/guidelines" className="mp-hero-link">Design guidelines</Link>
                    </div>
                </div>
            </section>

            {/* ── Catalog ── */}
            <section className="mp-catalog" aria-label="Metals">
                <div className="mp-inner">
                    <div className="mp-toolbar">
                        <div className="mp-filters" role="group" aria-label="Filter by family">
                            {loading ? (
                                [72, 96, 64, 120].map((w, i) => (
                                    <span key={i} className="shimmer mp-sk-chip" style={{ width: w }} aria-hidden="true" />
                                ))
                            ) : (
                                [{ name: ALL, count: metals.length }, ...families].map(family => {
                                    const active = activeCategory === family.name;
                                    return (
                                        <button
                                            key={family.name}
                                            type="button"
                                            className={`mp-chip${active ? ' is-active' : ''}`}
                                            aria-pressed={active}
                                            onClick={() => setSelectedCategory(family.name)}
                                        >
                                            {family.name}
                                            <span className="mp-chip-count">{family.count}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        <div className="mp-search">
                            <Search size={16} aria-hidden="true" />
                            <input
                                type="search"
                                aria-label="Search metals"
                                placeholder="Search metal, grade or thickness"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button type="button" className="mp-search-clear" aria-label="Clear search" onClick={() => setSearchQuery('')}>
                                    <X size={14} aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mp-results" aria-live="polite">
                        {loading ? (
                            <span className="shimmer mp-sk-results" aria-hidden="true" />
                        ) : (
                            <>
                                <span>
                                    {filteredMetals.length} {filteredMetals.length === 1 ? 'metal' : 'metals'}
                                    {activeCategory !== ALL ? ` in ${activeCategory}` : ''}
                                    {searchQuery.trim() ? ` matching “${searchQuery.trim()}”` : ''}
                                </span>
                                {isFiltered && (
                                    <button type="button" className="mp-clear" onClick={clearFilters}>Clear filters</button>
                                )}
                            </>
                        )}
                    </div>

                    {loading ? (
                        <ul className="mp-grid" aria-hidden="true">
                            {[0, 1, 2, 3, 4, 5].map(i => (
                                <li key={i} className="mp-card is-skeleton">
                                    <div className="mp-card-top">
                                        <span className="shimmer mp-swatch" />
                                        <span className="mp-card-head">
                                            <span className="shimmer mp-sk-line is-tiny" />
                                            <span className="shimmer mp-sk-line is-name" />
                                        </span>
                                    </div>
                                    <span className="mp-sk-desc">
                                        <span className="shimmer mp-sk-line" />
                                        <span className="shimmer mp-sk-line is-short" />
                                    </span>
                                    <span className="mp-specs">
                                        <span className="shimmer mp-sk-line is-spec" />
                                        <span className="shimmer mp-sk-line is-spec" />
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : filteredMetals.length > 0 ? (
                        <ul className="mp-grid">
                            <AnimatePresence mode="popLayout" initial={!reduceMotion}>
                                {filteredMetals.map((metal, index) => {
                                    const { count, range } = parseThickness(metal.thickness);
                                    return (
                                        <motion.li
                                            key={metal.id}
                                            className="mp-item"
                                            layout={!reduceMotion}
                                            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                                            transition={{ duration: 0.3, delay: reduceMotion ? 0 : Math.min(index, 8) * 0.03, ease: [0.22, 1, 0.36, 1] }}
                                        >
                                            <Link to={`/metal/${metal.slug || metal.id}`} className="mp-card">
                                                <div className="mp-card-top">
                                                    <ThumbImage
                                                        key={metal.image}
                                                        className="mp-swatch"
                                                        src={metal.image}
                                                        fallback={staticImageFor(metal)}
                                                    />
                                                    <div className="mp-card-head">
                                                        {metal.category && <span className="mp-family">{metal.category}</span>}
                                                        <h2 className="mp-name">{displayMetalName(metal.name)}</h2>
                                                    </div>
                                                    <ArrowRight size={18} className="mp-arrow" aria-hidden="true" />
                                                </div>
                                                {metal.description && <p className="mp-desc">{metal.description}</p>}
                                                {metal.thickness && (
                                                    <dl className="mp-specs">
                                                        {count !== null && (
                                                            <div>
                                                                <dt>Thicknesses</dt>
                                                                <dd>{count}</dd>
                                                            </div>
                                                        )}
                                                        <div className={count === null ? 'is-wide' : ''}>
                                                            <dt>Range</dt>
                                                            <dd>{range}</dd>
                                                        </div>
                                                    </dl>
                                                )}
                                            </Link>
                                        </motion.li>
                                    );
                                })}
                            </AnimatePresence>
                        </ul>
                    ) : (
                        <div className="mp-empty">
                            <Search size={22} aria-hidden="true" />
                            <h2 className="mp-empty-title">No metals match</h2>
                            <p>Try another grade or thickness, or show every metal.</p>
                            <button type="button" className="mp-btn" onClick={clearFilters}>Show all metals</button>
                        </div>
                    )}

                    <p className="mp-note">More options coming soon, including plastics and composites.</p>
                </div>
            </section>

        </div>
    );
};

export default MetalsPage;
