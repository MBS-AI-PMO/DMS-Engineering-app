import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { ChevronRight, Filter, Search, ArrowRight, Shield, Zap, Award, AlertTriangle } from 'lucide-react';
import { metalsData as staticMetalsData } from '../data/metalsData';
import { fetchMetals } from '../utils/api';

const MetalsPage = () => {
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [metals, setMetals] = useState(staticMetalsData);
    const [loading, setLoading] = useState(true);

    const categories = ['All', 'Aluminum', 'Brass', 'Copper', 'Stainless Steel', 'Steel', 'Titanium'];

    // Fetch from API on mount
    useEffect(() => {
        async function loadMetals() {
            setLoading(true);
            try {
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
                // We keep staticMetalsData as state
            } finally {
                setLoading(false);
            }
        }
        loadMetals();
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

    return (
        <div className="metals-page">
            {/* Premium Hero Section */}
            <section className="metals-hero-new">
                <div className="metals-hero-bg">
                    <img src="/assets/metals-hero.avif" alt="Metal textures" />
                    <div className="metals-hero-overlay"></div>
                </div>
                <div className="container">
                    <motion.div
                        className="metals-hero-content"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <div className="metals-badge">Engineering Excellence</div>
                        <h1>Material Catalog</h1>
                        <p>Explore 60+ premium metals with instant pricing and detailed engineering specifications. From aerospace-grade aluminum to high-strength steels.</p>
                        <div className="metals-hero-stats">
                            <div className="stat-item">
                                <span className="stat-num">60+</span>
                                <span className="stat-label">In-Stock Materials</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-num">24h</span>
                                <span className="stat-label">Rapid Dispatch</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-num">0.005"</span>
                                <span className="stat-label">Laser Precision</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Catalog Section */}
            <section className="catalog-section">
                <div className="container">
                    {/* Filter Bar */}
                    <div className="catalog-controls">
                        <div className="category-tabs">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    className={`category-tab ${selectedCategory === cat ? 'active' : ''}`}
                                    onClick={() => setSelectedCategory(cat)}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                        <div className="catalog-search">
                            <Search className="search-icon" size={18} />
                            <input
                                type="text"
                                placeholder="Search materials or specs..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Result Info */}
                    <div className="catalog-info">
                        <p>Showing <strong>{filteredMetals.length}</strong> materials</p>
                    </div>

                    {/* Material List Layout */}
                    <div className="material-catalog-list">
                        {loading && filteredMetals.length === 0 && (
                            [...Array(4)].map((_, i) => (
                                <div key={i} className="skeleton skeleton-material-card" />
                            ))
                        )}
                        <AnimatePresence mode='popLayout'>
                            {filteredMetals.map((metal, index) => (
                                <motion.div
                                    key={metal.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.3, delay: index * 0.05 }}
                                    className="material-detail-card"
                                >
                                    <div className="card-image">
                                        <img src={metal.image} alt={metal.name} />
                                    </div>
                                    <div className="card-body">
                                        <div className="card-main">
                                            <div className="card-header">
                                                <div className="title-group">
                                                    <h3>{metal.name}</h3>
                                                </div>
                                                <div className="tags">
                                                    {(metal.name.toLowerCase().includes('titanium') || metal.subLabel?.toLowerCase().includes('titanium')) && (
                                                        <div className="red-touch">
                                                            <span className="view-errors">Premium Grade</span>
                                                            <AlertTriangle size={16} className="error-icon" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="card-desc">{metal.description}</p>

                                            <div className="card-specs">
                                                <div className="spec-item">
                                                    <span className="spec-label">Range</span>
                                                    <span className="spec-value">{metal.thickness.split(':')[0]}</span>
                                                </div>
                                                <div className="spec-item">
                                                    <span className="spec-label">Status</span>
                                                    <span className="spec-value">In Stock</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="card-actions">
                                            <div className="card-price-info">
                                                <span className="price-label">Thickness range</span>
                                                <span className="price-value">{metal.thickness.split(':').pop().trim()}</span>
                                            </div>
                                            <Link to={`/metal/${metal.slug || metal.id}`} className="card-btn-link">
                                                <span>View Details</span>
                                                <ChevronRight size={18} />
                                            </Link>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>

                    {filteredMetals.length === 0 && (
                        <div className="no-results">
                            <Search size={48} />
                            <h3>No materials found</h3>
                            <p>Try adjusting your search or category filters.</p>
                            <button onClick={() => { setSelectedCategory('All'); setSearchQuery(''); }} className="reset-btn">
                                Clear all filters
                            </button>
                        </div>
                    )}
                </div>
            </section>

            {/* Why Choose Section */}
            <section className="metals-benefits">
                <div className="container">
                    <div className="benefits-grid">
                        <div className="benefit-card">
                            <div className="benefit-icon"><Shield size={24} /></div>
                            <h4>Certified Quality</h4>
                            <p>All materials come with mill test reports upon request to ensure traceability.</p>
                        </div>
                        <div className="benefit-card">
                            <div className="benefit-icon"><Zap size={24} /></div>
                            <h4>Instant Quoting</h4>
                            <p>Upload your CAD files and get pricing in seconds for any material in our catalog.</p>
                        </div>
                        <div className="benefit-card">
                            <div className="benefit-icon"><Award size={24} /></div>
                            <h4>Industry Standards</h4>
                            <p>We source metals that meet or exceed ASTM and industry-specific certifications.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="metals-cta">
                <div className="container">
                    <div className="cta-box">
                        <h2>Ready to start your project?</h2>
                        <p>Upload your design and see the precision of DMS Engineering for yourself.</p>
                        <Link to="/get-instant-pricing" className="cta-btn secondary">
                            Get Instant Pricing <ArrowRight size={20} />
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default MetalsPage;
