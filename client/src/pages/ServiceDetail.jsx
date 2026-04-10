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
    FileText
} from 'lucide-react';
import { fetchServiceBySlug, fetchMetalsByServiceId } from '../utils/api';
import './ServiceDetail.css';

const ServiceDetail = () => {
    // ... logic remains same ...
    const { slug } = useParams();
    const [service, setService] = useState(null);
    const [compatibleMetals, setCompatibleMetals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Overview');

    useEffect(() => {
        // ... loadData ...
        const loadData = async () => {
            setLoading(true);
            try {
                const svcData = await fetchServiceBySlug(slug);
                setService(svcData);

                const metals = await fetchMetalsByServiceId(svcData.id);
                setCompatibleMetals(metals || []);
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

    // Safely parse service_options (may be a JSON string or already an array)
    const serviceOptions = (() => {
        const raw = service.service_options;
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string' && raw.trim()) {
            try { return JSON.parse(raw); } catch { return []; }
        }
        return [];
    })();

    const tabs = ['Overview', 'Compatible Metals'];
    if (serviceOptions.length > 0) tabs.push('Technical Specs');

    // Determine hero image
    const getHeroImage = (title) => {
        const t = title.toLowerCase();
        if (t.includes('laser')) return '/laser_cutting_hero_1775776747463.png';
        if (t.includes('bend')) return '/metal_bending_hero_17757766017.png';
        if (t.includes('tap')) return '/metal_tapping_hero_1775776797967.png';
        if (t.includes('powder')) return '/powder_coating_hero_1775776779860.png';
        return service.image_path || '';
    };

    return (
        <div className="service-detail-page">
            {/* ── Hero Section ──────────────────────────────── */}
            <section className="service-hero">
                <div className="hero-bg-overlay"></div>
                {getHeroImage(service.title) && (
                    <img src={getHeroImage(service.title)} alt={service.title} className="hero-bg-img" />
                )}
                <div className="hero-content">
                    <nav className="breadcrumb">
                        <Link to="/">Home</Link> <ChevronRight size={14} /> <span>Services</span> <ChevronRight size={14} /> <span className="current">{service.title}</span>
                    </nav>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        {service.title}
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                    >
                        {service.description}
                    </motion.p>
                    <motion.div
                        className="hero-actions"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        <Link to="/get-instant-pricing" className="btn-services-solid">GET INSTANT QUOTE</Link>
                        <a href="#details" className="btn-services-outline">VIEW CAPABILITIES</a>
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
                                                <img src={metal.image_path} alt={metal.name} />
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

                                {service.title.toLowerCase().includes('tap') ? (
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
                                                {service.service_options.map((opt, idx) => (
                                                    <tr key={idx}>
                                                        <td className="font-bold">{opt.name}</td>
                                                        <td>{opt.min_diameter}\"</td>
                                                        <td>{opt.max_diameter}\"</td>
                                                        <td className="price-td">${opt.price}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : service.title.toLowerCase().includes('countersink') ? (
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
                                                {service.service_options.map((opt, idx) => (
                                                    <tr key={idx}>
                                                        <td className="font-bold">{opt.name}</td>
                                                        <td>{opt.major_dia}\"</td>
                                                        <td>{opt.minor_dia}\"</td>
                                                        <td>{opt.angle}°</td>
                                                        <td className="price-td">${opt.price}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="tech-options-grid">
                                        {Array.isArray(service.service_options) && service.service_options.map((opt, idx) => {
                                            const name = typeof opt === 'string' ? opt : opt.name;
                                            const isColor = ['red', 'blue', 'black', 'gold', 'clear', 'green', 'yellow', 'bronze', 'grey', 'white', 'purple'].some(c => name.toLowerCase().includes(c));

                                            const getColorCode = (val) => {
                                                const v = val.toLowerCase();
                                                if (v.includes('black')) return '#000000';
                                                if (v.includes('red')) return '#ef4444';
                                                if (v.includes('blue')) return '#3b82f6';
                                                if (v.includes('gold')) return '#fbbf24';
                                                if (v.includes('clear')) return '#e2e8f0';
                                                if (v.includes('green')) return '#10b981';
                                                if (v.includes('dark grey')) return '#4b5563';
                                                if (v.includes('white')) return '#ffffff';
                                                return '#6366f1';
                                            };

                                            return (
                                                <div key={idx} className="tech-card-premium">
                                                    {isColor && (
                                                        <div className="color-swatch-box">
                                                            <div
                                                                className="swatch-circle"
                                                                style={{ backgroundColor: getColorCode(name) }}
                                                            ></div>
                                                        </div>
                                                    )}
                                                    <div className="tech-card-info">
                                                        <span className="tech-card-label">Available Option</span>
                                                        <h4 className="tech-card-title">{name}</h4>
                                                    </div>
                                                    <div className="tech-card-corner">
                                                        <Settings size={14} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
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
                        <Link to="/get-instant-pricing" className="btn-services-solid large">GET INSTANT PRICING</Link>
                        <Link to="/contact" className="btn-services-outline large">CONTACT AN ENGINEER</Link>
                    </div>
                </div>
            </section>

        </div>
    );
};

export default ServiceDetail;
