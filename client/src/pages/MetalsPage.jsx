import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { ArrowRight, Award, Boxes, CheckCircle2, ChevronRight, Filter, Gauge, Search, Shield, SlidersHorizontal, Sparkles } from 'lucide-react';
import { metalsData as staticMetalsData } from '../data/metalsData';
import { fetchMetals, fetchCategories } from '../utils/api';

import metalsPageHero from '../assets/metals/metals-page-hero.png';

const MetalsPage = () => {
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [metals, setMetals] = useState(staticMetalsData);
    const [loading, setLoading] = useState(true);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [categories, setCategories] = useState(['All', 'Aluminum', 'Brass', 'Copper', 'Stainless Steel', 'Steel', 'Titanium']);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch from API on mount
    useEffect(() => {
        async function loadInitialData() {
            setLoading(true);
            try {
                // Fetch categories
                const categoriesData = await fetchCategories();
                if (categoriesData && categoriesData.length > 0) {
                    const dynamicCats = ['All', ...categoriesData.map(c => c.name)];
                    setCategories(dynamicCats);
                }

                // Fetch metals
                const data = await fetchMetals();
                // Transform DB format to match static format for backward compat
                const transformed = data.map(m => ({
                    id: m.id,
                    slug: m.slug,
                    name: m.name,
                    thickness: m.thickness,
                    image: m.image_path,
                    description: m.description,
                    quickLook: m.quick_look,
                    specifications: m.specifications,
                    thicknessSpecs: m.thickness_specs,
                    aboutSection: m.about_section,
                    faqs: m.faqs,
                    services: m.services,
                    category: m.category_name
                }));
                setMetals(transformed);
            } catch (err) {
                console.warn('API unavailable, using static data fallback:', err.message);
                // We keep staticMetalsData and default categories as state
                setMetals(staticMetalsData);
            } finally {
                // Keep loading for at least 600ms for smooth feel
                setTimeout(() => setLoading(false), 600);
            }
        }
        loadInitialData();
    }, []);

    const filteredMetals = useMemo(() => {
        return metals.filter(metal => {
            const name = metal.name.toLowerCase();
            const cat = selectedCategory.toLowerCase();

            const matchesCategory = selectedCategory === 'All' ||
                (metal.category && metal.category.toLowerCase() === cat) ||
                name.includes(cat) ||
                (selectedCategory === 'Steel' && (name.includes('steel') && !name.includes('stainless'))) ||
                (selectedCategory === 'Stainless Steel' && name.includes('stainless')) ||
                (selectedCategory === 'Titanium' && name.includes('titanium'));

            const matchesSearch = name.includes(searchQuery.toLowerCase()) ||
                (metal.description && metal.description.toLowerCase().includes(searchQuery.toLowerCase()));

            return matchesCategory && matchesSearch;
        });
    }, [selectedCategory, searchQuery, metals]);

    const featuredMetals = useMemo(() => filteredMetals.slice(0, 4), [filteredMetals]);
    const visibleMetals = loading ? [] : filteredMetals;
    const categoryCount = selectedCategory === 'All'
        ? metals.length
        : filteredMetals.length;

    const getThicknessText = (metal) => {
        if (!metal?.thickness) return 'Custom stock';
        const parts = String(metal.thickness).split(':');
        return (parts.length > 1 ? parts.pop() : metal.thickness).trim();
    };

    const getRangeText = (metal) => {
        if (!metal?.thickness) return metal?.category || 'Material';
        return String(metal.thickness).split(':')[0].trim();
    };

    return (
        <div className="metals-page">
            <style>{`
                .metals-page .detail-hero {
                    margin-bottom: 0 !important;
                    border-bottom: none !important;
                }
                .metals-page .detail-hero::before {
                    display: none !important;
                }
            `}</style>

            {/* Premium Hero Section */}
            <div className="detail-hero" style={{
                backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.85)), url(${metalsPageHero})`,
                backgroundColor: 'transparent'
            }}>
                <div className="detail-container">
                    <nav className="detail-breadcrumb centered">
                        <Link to="/">Home</Link> <span className="separator">/</span> <span className="current">Metals</span>
                    </nav>

                    <h1 className="detail-hero-title">
                        <span className="title-prefix">Precision Engineering</span>
                        <span className="title-main">Material <span className="highlight" style={{ color: '#e31b23' }}>Catalog</span></span>
                    </h1>

                    <div className="hero-description centered">
                        Explore 60+ premium metals with instant pricing and detailed engineering specifications. From aerospace-grade aluminum to high-strength steels.
                    </div>
                </div>
            </div>

            <section className="metals-catalog-shell">
                <div className="container metals-catalog-container">
                    <div className="metals-command-bar">
                        <div className="metals-command-copy">
                            <span className="metals-eyebrow"><Boxes size={16} /> Live material library</span>
                            <h2>Choose stock by process, grade, and thickness.</h2>
                            <p>Browse production-ready metals, compare stock availability, and open the exact material profile before quoting.</p>
                        </div>

                        <div className="metals-stats-strip" aria-label="Catalog summary">
                            <div>
                                <strong>{metals.length}</strong>
                                <span>Total metals</span>
                            </div>
                            <div>
                                <strong>{categories.length}</strong>
                                <span>Categories</span>
                            </div>
                            <div>
                                <strong>{categoryCount}</strong>
                                <span>Current view</span>
                            </div>
                        </div>
                    </div>

                    <div className="metals-toolbar">
                        <div className="metals-search-field">
                            <Search size={18} />
                            <input
                                type="search"
                                placeholder="Search material, alloy, or finish"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="metals-filter-desktop" aria-label="Material categories">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    type="button"
                                    className={selectedCategory === cat ? 'active' : ''}
                                    onClick={() => setSelectedCategory(cat)}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        <div className="metals-filter-mobile" ref={dropdownRef}>
                            <button
                                type="button"
                                className="metals-filter-trigger"
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            >
                                <Filter size={17} />
                                <span>{selectedCategory}</span>
                                <ChevronRight size={17} className={isDropdownOpen ? 'open' : ''} />
                            </button>

                            {isDropdownOpen && (
                                <div className="metals-filter-menu">
                                    {categories.map(cat => (
                                        <button
                                            key={cat}
                                            type="button"
                                            className={selectedCategory === cat ? 'active' : ''}
                                            onClick={() => {
                                                setSelectedCategory(cat);
                                                setIsDropdownOpen(false);
                                            }}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="metals-results-row">
                        <span>{loading ? 'Loading materials' : `${filteredMetals.length} materials found`}</span>
                        <span>{selectedCategory === 'All' ? 'All categories' : selectedCategory}</span>
                    </div>

                    {featuredMetals.length > 0 && !loading && (
                        <div className="metals-feature-row">
                            {featuredMetals.map(metal => (
                                <Link to={`/metal/${metal.slug || metal.id}`} className="metals-feature-chip" key={`feature-${metal.id}`}>
                                    <span>{metal.name}</span>
                                    <ChevronRight size={15} />
                                </Link>
                            ))}
                        </div>
                    )}

                    <div className="metals-grid-redesign">
                        {loading && [...Array(6)].map((_, i) => (
                            <article key={i} className="metal-card-redesign skeleton-card-redesign">
                                <div className="metal-card-media skeleton" />
                                <div className="metal-card-content">
                                    <div className="skeleton skeleton-line wide" />
                                    <div className="skeleton skeleton-line" />
                                    <div className="skeleton skeleton-copy" />
                                    <div className="skeleton skeleton-copy short" />
                                </div>
                            </article>
                        ))}

                        <AnimatePresence mode="popLayout">
                            {visibleMetals.map((metal, index) => (
                                <motion.article
                                    key={metal.id}
                                    layout
                                    initial={{ opacity: 0, y: 14 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 14 }}
                                    transition={{ duration: 0.25, delay: Math.min(index * 0.025, 0.16) }}
                                    className="metal-card-redesign"
                                >
                                    <Link to={`/metal/${metal.slug || metal.id}`} className="metal-card-hit-area" aria-label={`View ${metal.name}`} />
                                    <div className="metal-card-media">
                                        {metal.image ? (
                                            <img src={metal.image} alt={metal.name} loading="lazy" decoding="async" />
                                        ) : (
                                            <div className="metal-image-fallback"><Sparkles size={28} /></div>
                                        )}
                                        <span>{metal.category || 'Material'}</span>
                                    </div>

                                    <div className="metal-card-content">
                                        <div className="metal-card-heading">
                                            <div>
                                                <h3>{metal.name}</h3>
                                                <p>{metal.description || 'Production material available for custom manufacturing.'}</p>
                                            </div>
                                            <ChevronRight size={20} />
                                        </div>

                                        <div className="metal-spec-row">
                                            <div>
                                                <span>Range</span>
                                                <strong>{getRangeText(metal)}</strong>
                                            </div>
                                            <div>
                                                <span>Thickness</span>
                                                <strong>{getThicknessText(metal)}</strong>
                                            </div>
                                            <div>
                                                <span>Status</span>
                                                <strong>In stock</strong>
                                            </div>
                                        </div>
                                    </div>
                                </motion.article>
                            ))}
                        </AnimatePresence>
                    </div>

                    {!loading && filteredMetals.length === 0 && (
                        <div className="metals-empty-state">
                            <Search size={34} />
                            <h3>No materials found</h3>
                            <p>Try a different alloy, category, or stock keyword.</p>
                            <button type="button" onClick={() => { setSelectedCategory('All'); setSearchQuery(''); }}>
                                Clear filters
                            </button>
                        </div>
                    )}
                </div>
            </section>

            <section className="metals-assurance-band">
                <div className="container metals-assurance-grid">
                    <div className="assurance-item">
                        <Shield size={22} />
                        <h3>Traceable Stock</h3>
                        <p>Material records and mill test reports can be aligned to production requirements.</p>
                    </div>
                    <div className="assurance-item">
                        <Gauge size={22} />
                        <h3>Process Ready</h3>
                        <p>Catalog entries are structured around quoting, cutting, forming, and finishing workflows.</p>
                    </div>
                    <div className="assurance-item">
                        <SlidersHorizontal size={22} />
                        <h3>Configurable Options</h3>
                        <p>Thickness, service compatibility, and production settings stay tied to admin controls.</p>
                    </div>
                    <div className="assurance-item">
                        <Award size={22} />
                        <h3>Engineering Grade</h3>
                        <p>Metals are organized for practical specification review, not a generic storefront list.</p>
                    </div>
                </div>
            </section>

            <section className="metals-production-strip">
                <div className="container metals-production-inner">
                    <div>
                        <span><CheckCircle2 size={18} /> Catalog connected to instant pricing</span>
                        <h2>Move from material selection to quote setup without losing context.</h2>
                    </div>
                    <Link to="/get-instant-pricing" className="metals-primary-action">
                        Start Quote <ArrowRight size={18} />
                    </Link>
                </div>
            </section>
        </div>
    );
};

export default MetalsPage;
