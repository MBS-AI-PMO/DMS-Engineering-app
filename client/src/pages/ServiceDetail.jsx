/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronRight,
    Maximize2,
    Layers,
    Info,
    CheckCircle2,
    ArrowRight,
    Loader2,
    Ruler,
    Settings,
    FileText,
    Zap,
    Play
} from 'lucide-react';
import { fetchServiceBySlug, fetchMetalsByServiceId, fetchAllHardwareWithItems, fetchMetals, fetchHardwareTypes, fetchHardwareItemsByType } from '../utils/api';
import './ServiceDetail.css';
import serviceHeroBg from '../assets/services/service-hero-bg.webp';

const normalizeHeroImage = (value) => {
    if (!value) return null;

    if (typeof value === 'string') {
        const src = value.trim().replace(/^"(.*)"$/, '$1');
        return src ? { src } : null;
    }

    if (typeof value === 'object') {
        return {
            avif: value.avif || '',
            webp: value.webp || '',
            jpg: value.jpg || value.jpeg || value.png || '',
            src: value.src || value.url || ''
        };
    }

    return null;
};

const resolveServiceHero = (value) => {
    const normalized = normalizeHeroImage(value);

    if (!normalized) {
        return {
            avif: '',
            webp: serviceHeroBg,
            jpg: serviceHeroBg
        };
    }

    return {
        avif: normalized.avif || '',
        webp: normalized.webp || normalized.src || serviceHeroBg,
        jpg: normalized.jpg || normalized.src || normalized.webp || serviceHeroBg
    };
};

const ServiceDetail = () => {
    // ... logic remains same ...
    const { slug } = useParams();
    const [service, setService] = useState(null);
    const [compatibleMetals, setCompatibleMetals] = useState([]);
    const [hardwareData, setHardwareData] = useState([]); // [{type, items}]
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Overview');

    useEffect(() => {
        // ... loadData ...
        const loadData = async () => {
            setLoading(true);
            try {
                const svcData = await fetchServiceBySlug(slug);
                setService(svcData);

                const isHw = svcData.title?.toLowerCase().includes('hardware');

                // Compatible Metals: for hardware show all metals (hardware works with any metal),
                // for other services filter by service assignment
                try {
                    if (isHw) {
                        const allMetals = await fetchMetals();
                        setCompatibleMetals(allMetals || []);
                    } else {
                        const metals = await fetchMetalsByServiceId(svcData.id);
                        setCompatibleMetals(metals || []);
                    }
                } catch (e) {
                    console.warn('Could not load compatible metals:', e);
                }

                // Hardware items — try new single endpoint, fall back to per-type calls
                if (isHw) {
                    try {
                        const allHw = await fetchAllHardwareWithItems();
                        if (allHw && allHw.length > 0) {
                            setHardwareData(allHw);
                        } else {
                            throw new Error('empty');
                        }
                    } catch {
                        // Fallback: fetch types then items individually
                        try {
                            const typesRes = await fetchHardwareTypes();
                            const types = (typesRes?.data || []).filter(t => !t.name?.toLowerCase().includes('countersink'));
                            const enriched = await Promise.all(types.map(async (t) => {
                                try {
                                    const items = await fetchHardwareItemsByType(t.id);
                                    return { ...t, items: Array.isArray(items) ? items : [] };
                                } catch { return { ...t, items: [] }; }
                            }));
                            setHardwareData(enriched.filter(g => g.items.length > 0));
                        } catch (e2) {
                            console.warn('Could not load hardware items:', e2);
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to load service detail:', err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
        window.scrollTo(0, 0);
    }, [slug]);

    if (loading) {
        return (
            <div className="service-skeleton-page">
                {/* Hero */}
                <div className="skeleton-hero-section">
                    <div className="skeleton-hero-inner">
                        <div className="sk sk-breadcrumb"></div>
                        <div className="sk sk-title"></div>
                        <div className="sk sk-desc-line"></div>
                        <div className="sk sk-desc-line sk-desc-short"></div>
                        <div className="skeleton-hero-actions">
                            <div className="sk sk-btn"></div>
                            <div className="sk sk-btn sk-btn-outline"></div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="skeleton-tabs-strip">
                    <div className="sk sk-light sk-tab-pill"></div>
                    <div className="sk sk-light sk-tab-pill sk-tab-wide"></div>
                    <div className="sk sk-light sk-tab-pill sk-tab-xwide"></div>
                </div>

                {/* Overview panel */}
                <div className="skeleton-main-content">
                    <div className="skeleton-overview-header">
                        <div className="skeleton-info-block">
                            <div className="sk sk-light sk-h2"></div>
                            <div className="sk sk-light sk-text-line"></div>
                            <div className="sk sk-light sk-text-line sk-text-short"></div>
                            <div className="sk sk-light sk-text-line sk-text-mid"></div>
                        </div>
                        <div className="skeleton-stats-column">
                            {[0, 1].map(i => (
                                <div key={i} className="sk-stat-card-shell">
                                    <div className="sk sk-light sk-stat-icon"></div>
                                    <div className="sk-stat-text">
                                        <div className="sk sk-light sk-stat-label"></div>
                                        <div className="sk sk-light sk-stat-val"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Capability cards */}
                    <div className="skeleton-cards-row">
                        {[0, 1, 2].map(i => (
                            <div key={i} className="sk-cap-card-shell">
                                <div className="sk sk-light sk-cap-icon"></div>
                                <div className="sk sk-light sk-cap-title"></div>
                                <div className="sk sk-light sk-cap-text"></div>
                                <div className="sk sk-light sk-cap-text sk-cap-text-short"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!service) {
        return (
            <div className="not-found">
                <h2>Service Not Found</h2>
                <Link to="/" className="btn-hero-primary">Back to Home</Link>
            </div>
        );
    }
    const heroSources = resolveServiceHero(service?.hero_image);

    // Safely parse service_options (may be a JSON string or already an array)
    const serviceOptions = (() => {
        const raw = service.service_options;
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string' && raw.trim()) {
            try { return JSON.parse(raw); } catch { return []; }
        }
        return [];
    })();

    const isHardwareService = service.title?.toLowerCase().includes('hardware');
    const tabs = ['Overview', 'Compatible Metals'];
    if (serviceOptions.length > 0 || isHardwareService) tabs.push('Technical Specs');

    return (
        <div className="service-detail-page">
            {/* ── Hero Section ──────────────────────────────── */}
            <section className="service-hero">
    <picture className="service-hero-bg">
        {heroSources.avif && <source srcSet={heroSources.avif} type="image/avif" />}
        {heroSources.webp && <source srcSet={heroSources.webp} type="image/webp" />}
        <img
            src={heroSources.jpg || heroSources.webp || serviceHeroBg}
            alt=""
            aria-hidden="true"
            loading="eager"
            decoding="async"
        />
    </picture>

    <div className="service-hero-overlay"></div>

                <div className="hero-content">
                    <nav className="detail-breadcrumb">
                        <Link to="/">Home</Link>
                        <span className="separator">/</span>
                        <Link to="/">Services</Link>
                        <span className="separator">/</span>
                        <span className="current">{service.title}</span>
                    </nav>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h1>{service.title}</h1>
                        <p>{service.description}</p>
                    </motion.div>
                    <motion.div
                        className="hero-actions"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        <Link to="/get-instant-pricing" className="btn-services-solid"><Zap size={16} />GET INSTANT QUOTE</Link>
                        <a href="#details" className="btn-services-outline"><Play size={14} />VIEW CAPABILITIES</a>
                    </motion.div>
                </div>
            </section>

            {/* ── Tabs Navigation ────────────────────────────── */}
            <div className="service-tabs-nav" id="details">
                <div className="tabs-container">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            className={`tab-item ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab}
                            {activeTab === tab && <motion.div className="active-indicator" layoutId="active-tab" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Tab Content ────────────────────────────────── */}
            <main className="service-main-content">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="tab-panel"
                    >
                        {activeTab === 'Overview' && (
                            <div className="overview-panel">
                                <div className="overview-header">
                                    <div className="header-info">
                                        <h2>Precise {service.title} Solutions</h2>
                                        <p>Our industrial-grade {service.title.toLowerCase()} service is optimized for both prototyping and high-volume production. We maintain tight tolerances and ensure a high-quality finish on every part.</p>
                                    </div>
                                    <div className="header-stats">
                                        <div className="stat-card">
                                            <Maximize2 size={24} className="stat-icon" />
                                            <div className="stat-content">
                                                <span className="stat-label">Max Dimensions</span>
                                                <span className="stat-val">{service.max_length || '—'}\" x {service.max_width || '—'}\"</span>
                                            </div>
                                        </div>
                                        <div className="stat-card">
                                            <Layers size={24} className="stat-icon" />
                                            <div className="stat-content">
                                                <span className="stat-label">Production Ready</span>
                                                <span className="stat-val">{service.is_production ? 'Yes' : 'Varies'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="capabilities-grid">
                                    <div className="capability-card">
                                        <div className="cap-icon-box"><CheckCircle2 size={20} /></div>
                                        <h3>High Precision</h3>
                                        <p>State-of-the-art machinery ensures tolerances as tight as +/- 0.005\".</p>
                                    </div>
                                    <div className="capability-card">
                                        <div className="cap-icon-box"><Ruler size={20} /></div>
                                        <h3>Material Versatility</h3>
                                        <p>Supported across Aluminum, Steel, Stainless, and more.</p>
                                    </div>
                                    <div className="capability-card">
                                        <div className="cap-icon-box"><Settings size={20} /></div>
                                        <h3>Custom Finishing</h3>
                                        <p>Integrated with our secondary services for a complete solution.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'Compatible Metals' && (
                            <div className="metals-panel">
                                <div className="panel-header">
                                    <h2>Available Materials for {service.title}</h2>
                                    <p>The following metals can be processed using our {service.title.toLowerCase()} capabilities.</p>
                                </div>
                                <div className="metals-grid-simple">
                                    {compatibleMetals.length > 0 ? compatibleMetals.map(metal => (
                                        <Link to={`/metal/${metal.slug}`} key={metal.id} className="metal-thumb-card">
                                            <div className="img-wrapper">
                                                <img src={serviceHeroBg} alt={metal.name} />
                                            </div>
                                            <div className="metal-info">
                                                <h4>{metal.name}</h4>
                                                <p>{metal.category_name}</p>
                                            </div>
                                            <ArrowRight size={16} className="arrow" />
                                        </Link>
                                    )) : (
                                        <div className="empty-state">
                                            <Info size={32} />
                                            <p>No specific metals linked yet. Contact us for custom material requests.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'Technical Specs' && (
                            <div className="specs-panel">
                                <div className="panel-header">
                                    <h2>Technical Specifications</h2>
                                    <p>Explore the available options and technical limits for our {service.title.toLowerCase()} service.</p>
                                </div>

                                {(() => {
                                    const t = service.title.toLowerCase();
                                    const getColorCode = (val) => {
                                        const v = val.toLowerCase();
                                        if (v.includes('dark grey') || v.includes('dark gray')) return '#4b5563';
                                        if (v.includes('grey') || v.includes('gray')) return '#9ca3af';
                                        if (v.includes('black')) return '#111827';
                                        if (v.includes('red')) return '#ef4444';
                                        if (v.includes('blue')) return '#3b82f6';
                                        if (v.includes('gold')) return '#fbbf24';
                                        if (v.includes('clear') || v.includes('natural')) return '#e2e8f0';
                                        if (v.includes('green')) return '#10b981';
                                        if (v.includes('white')) return '#f9fafb';
                                        if (v.includes('bronze')) return '#92400e';
                                        if (v.includes('purple')) return '#7c3aed';
                                        if (v.includes('yellow')) return '#fde047';
                                        if (v.includes('orange')) return '#f97316';
                                        if (v.includes('silver')) return '#cbd5e1';
                                        return null;
                                    };
                                    const colorKeywords = ['red', 'blue', 'black', 'gold', 'clear', 'green', 'yellow', 'bronze', 'grey', 'gray', 'white', 'purple', 'natural', 'silver', 'orange', 'anodize'];

                                    if (t.includes('tap')) return (
                                        <div className="specs-table-wrapper">
                                            <table className="premium-specs-table">
                                                <thead>
                                                    <tr>
                                                        <th>Tap Profile</th>
                                                        <th>Min Hole Ø</th>
                                                        <th>Max Hole Ø</th>
                                                        <th>Price</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {serviceOptions.map((opt, idx) => (
                                                        <tr key={idx}>
                                                            <td className="font-bold">{opt.name}</td>
                                                            <td>{opt.min_diameter}"</td>
                                                            <td>{opt.max_diameter}"</td>
                                                            <td className="price-td">${opt.price}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    );

                                    if (t.includes('countersink')) return (
                                        <div className="specs-table-wrapper">
                                            <table className="premium-specs-table">
                                                <thead>
                                                    <tr>
                                                        <th>Profile Name</th>
                                                        <th>Major Ø</th>
                                                        <th>Minor Ø</th>
                                                        <th>Angle</th>
                                                        <th>Price</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {serviceOptions.map((opt, idx) => (
                                                        <tr key={idx}>
                                                            <td className="font-bold">{opt.name}</td>
                                                            <td>{opt.major_dia}"</td>
                                                            <td>{opt.minor_dia}"</td>
                                                            <td>{opt.angle}°</td>
                                                            <td className="price-td">${opt.price}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    );

                                    if (t.includes('hardware')) return (
                                        <div>
                                            {hardwareData.length === 0 ? (
                                                <div className="empty-state"><Info size={32} /><p>No hardware items found.</p></div>
                                            ) : hardwareData.map((hwType) => (
                                                <div key={hwType.id} style={{ marginBottom: 32 }}>
                                                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        {serviceHeroBg && <img src={serviceHeroBg} alt={hwType.name} style={{ width: 28, height: 28, objectFit: 'contain' }} />}
                                                        {hwType.name}
                                                        <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>({hwType.items.length} options)</span>
                                                    </h3>
                                                    <div className="specs-table-wrapper">
                                                        <table className="premium-specs-table">
                                                            <thead>
                                                                <tr>
                                                                    <th>Name / Size</th>
                                                                    <th>Spec</th>
                                                                    <th>Price</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {hwType.items.map((item, idx) => (
                                                                    <tr key={idx}>
                                                                        <td className="font-bold">{item.name || '—'}</td>
                                                                        <td>{item.size_spec || [item.length && `L: ${item.length}"`, item.base_width && `W: ${item.base_width}"`, item.shank && `Shank: ${item.shank}"`].filter(Boolean).join(' · ') || '—'}</td>
                                                                        <td className="price-td">{item.price != null ? `$${item.price}` : '—'}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );

                                    // Anodizing, Powder Coating, and other option-based services
                                    return (
                                        <div className="tech-options-grid">
                                            {serviceOptions.map((opt, idx) => {
                                                const name = typeof opt === 'string' ? opt : (opt.name || '');
                                                const colorCode = getColorCode(name);
                                                const isColor = colorCode !== null || colorKeywords.some(c => name.toLowerCase().includes(c));
                                                const price = opt.price != null ? `$${opt.price}` : null;
                                                return (
                                                    <div key={idx} className="tech-card-premium">
                                                        {isColor && (
                                                            <div className="color-swatch-box">
                                                                <div className="swatch-circle" style={{ backgroundColor: colorCode || '#6366f1', border: name.toLowerCase().includes('white') || name.toLowerCase().includes('clear') || name.toLowerCase().includes('natural') ? '1px solid #d1d5db' : 'none' }}></div>
                                                            </div>
                                                        )}
                                                        <div className="tech-card-info">
                                                            <span className="tech-card-label">{isColor ? 'Color' : 'Available Option'}</span>
                                                            <h4 className="tech-card-title">{name}</h4>
                                                            {price && <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>{price}</span>}
                                                        </div>
                                                        <div className="tech-card-corner">
                                                            <Settings size={14} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </main>

            {/* ── CTA Section ────────────────────────────────── */}
            <section className="service-cta">
                <div className="cta-container">
                    <div className="cta-text">
                        <h2>Ready to start your project?</h2>
                        <p>Upload your CAD files and get instant pricing for {service.title.toLowerCase()} and more.</p>
                    </div>
                    <div className="cta-btns">
                        <Link to="/get-instant-pricing" className="btn-services-solid large"><Zap size={18} />GET INSTANT PRICING</Link>
                    </div>
                </div>
            </section>

        </div>
    );
};

export default ServiceDetail;
