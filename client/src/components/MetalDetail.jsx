import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { metalsData } from '../data/metalsData';
import { servicesData } from '../data/servicesData';
import laserSpecsSvg from '../assets/metals/laser-specs.svg';
import CutSizesVisual from './CutSizesVisual';
import Showcase from './Showcase';
import { fetchMetalBySlug, fetchMetalServices } from '../utils/api';

const MetalDetail = () => {
    const { slug, id } = useParams();
    const navigate = useNavigate();
    const [metal, setMetal] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('Quick Look');
    const [unit, setUnit] = useState('MM'); // 'INCH' or 'MM'
    const [activeFaq, setActiveFaq] = useState(null);
    const [selectedThicknessIndex, setSelectedThicknessIndex] = useState(0);
    const [resolvedServices, setResolvedServices] = useState({ metalLevel: [], thicknessLevel: [] });
    const specsRef = useRef(null);
    const laserRef = useRef(null);
    const bendingRef = useRef(null);
    const dimpleRef = useRef(null);
    const hardwareRef = useRef(null);
    const anodizingRef = useRef(null);
    const deburringRef = useRef(null);
    const powderCoatingRef = useRef(null);
    const tappingRef = useRef(null);
    const platingRef = useRef(null);
    const countersinkRef = useRef(null);
    const tumbleRef = useRef(null);

    useEffect(() => {
        async function loadMetal() {
            setLoading(true);
            const lookupSlug = slug || id;

            try {
                // Try API first
                const data = await fetchMetalBySlug(lookupSlug);

                // Transform DB format to match component expectations
                setMetal({
                    id: data.id,
                    slug: data.slug,
                    name: data.name,
                    thickness: data.thickness,
                    image: data.image_path,
                    description: data.description,
                    quickLook: data.quick_look,
                    specifications: data.specifications,
                    thicknessSpecs: data.thickness_specs,
                    aboutSection: data.about_section,
                    faqs: data.faqs,
                    services: data.services,
                    category: data.category_name
                });

                // Fetch hierarchical services
                try {
                    const svcData = await fetchMetalServices(lookupSlug);
                    setResolvedServices(svcData);
                } catch (svcErr) {
                    console.warn('Failed to fetch hierarchical services:', svcErr.message);
                    setResolvedServices({ metalLevel: [], thicknessLevel: [] });
                }
            } catch (err) {
                console.warn('API fetch failed, using static data fallback:', err.message);
                // Fallback: try slug match then numeric ID match
                let found = metalsData.find(m => {
                    const mSlug = m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
                    return mSlug === lookupSlug;
                });
                if (!found && !isNaN(lookupSlug)) {
                    found = metalsData.find(m => m.id === parseInt(lookupSlug));
                }
                if (!found) {
                    found = metalsData.find(m => m.id === parseInt(id));
                }
                setMetal(found || null);
                setResolvedServices({ metalLevel: [], thicknessLevel: [] });
            } finally {
                setLoading(false);
            }
        }
        loadMetal();
        setActiveTab('Quick Look');
        setSelectedThicknessIndex(0);
    }, [slug, id]);


    const handleSubMetalClick = (subSlug) => {
        if (subSlug) {
            navigate(`/metal/${subSlug}`);
            window.scrollTo(0, 0);
        }
    };

    const sectionRefs = {
        "Laser Cutting": laserRef,
        "Bending": bendingRef,
        "Dimple Forming": dimpleRef,
        "Hardware": hardwareRef,
        "Hardware Insertion": hardwareRef,
        "Anodizing": anodizingRef,
        "Deburring": deburringRef,
        "Powder Coating": powderCoatingRef,
        "Tapping": tappingRef,
        "Plating": platingRef,
        "Countersinking": countersinkRef,
        "Tumbling": tumbleRef
    };

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [id]);

    // Reset thickness when metal changes (reset during render pattern)
    const [prevId, setPrevId] = useState(id);
    if (id !== prevId) {
        setPrevId(id);
        setSelectedThicknessIndex(0);
    }

    if (loading) {
        return (
            <div className="metal-detail-page">
                <div className="detail-container">
                    <div className="skeleton skeleton-breadcrumb"></div>
                    <div className="skeleton skeleton-title"></div>
                    <div className="skeleton skeleton-tabs"></div>
                    <div className="quick-look-grid">
                        <div className="skeleton skeleton-card"></div>
                        <div className="skeleton skeleton-card"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!metal) {
        return (
            <div className="not-found">
                <div className="container">
                    <h2>Metal not found</h2>
                    <Link to="/" className="btn-hero-primary">Back to Home</Link>
                </div>
            </div>
        );
    }

    const tabs = [
        'Quick Look',
        (metal.specifications || metal.thicknessSpecs) ? 'Specifications' : null,
        metal.aboutSection ? 'About' : null,
        (metal.services && metal.services.length > 0) || resolvedServices.metalLevel.length > 0 || resolvedServices.thicknessLevel.some(t => t.services?.length > 0) ? 'Services' : null,
        (metal.faqs && metal.faqs.length > 0) ? 'FAQS' : null,
    ].filter(Boolean);

    const toggleFaq = (index) => {
        setActiveFaq(activeFaq === index ? null : index);
    };

    const handleViewSpecs = (sectionRef) => {
        setActiveTab('Specifications');
        setTimeout(() => {
            const targetRef = sectionRef || specsRef;
            targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    // Helper to render rating dots
    const renderDots = (rating) => {
        return (
            <div className="rating-dots">
                {[...Array(5)].map((_, i) => (
                    <span key={i} className={`dot ${i < rating ? 'filled' : 'empty'}`}></span>
                ))}
            </div>
        );
    };

    const tabContentVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
        exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
    };

    const currentThicknessValue = metal.quickLook.thicknesses[selectedThicknessIndex]?.value;
    const thicknessSpecs = metal.thicknessSpecs?.[currentThicknessValue] || {};
    const currentSpecs = { ...metal.specifications, ...thicknessSpecs };

    return (
        <motion.div
            className="metal-detail-page"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
        >
            <div className="detail-container">
                <nav className="detail-breadcrumb">
                    <Link to="/">Home</Link> <span className="separator">/</span> <Link to="/">Metals</Link> <span className="separator">/</span> <span className="current">{metal.name}</span>
                </nav>

                <h1 className="detail-main-title">{unit === 'MM' ? metal.quickLook.thicknesses[selectedThicknessIndex]?.metric : metal.quickLook.thicknesses[selectedThicknessIndex]?.value} {metal.name}</h1>

                <div className="detail-tabs-wrapper">
                    <div className="detail-tabs">
                        {tabs.map((tab) => (
                            <button
                                key={tab}
                                className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab}
                                {activeTab === tab && (
                                    <motion.div
                                        className="tab-indicator"
                                        layoutId="tab-indicator"
                                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="tab-content">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            variants={tabContentVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                        >
                            {activeTab === 'Quick Look' && (
                                <>
                                    {metal.subMetals ? (
                                        <div className="sub-metals-container">
                                            <div className="sub-metals-grid">
                                                {metal.subMetals.map((sub, index) => (
                                                    <div key={index} className="sub-metal-card-premium">
                                                        <div className="sub-metal-info">
                                                            <h3 className="sub-metal-name">{sub.name}</h3>
                                                            <button
                                                                className="view-material-btn"
                                                                onClick={() => handleSubMetalClick(sub.id)}
                                                            >
                                                                VIEW MATERIAL →
                                                            </button>
                                                            <div className="sub-metal-tags-cloud">
                                                                {sub.tags.map((tag, tIndex) => (
                                                                    <span key={tIndex} className="sub-metal-tag">{tag}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="quick-look-grid">
                                            <div className="detail-card cut-sizes-card">
                                                <h2 className="card-title">CUT SIZES</h2>
                                                <CutSizesVisual sizes={metal.quickLook.cutSizes} />
                                                <div className="cut-sizes-list">
                                                    {metal.quickLook.cutSizes.map((size, index) => (
                                                        <div key={index} className="size-row">
                                                            <span className="size-label">{size.label}. {size.size}</span>
                                                            <button className={`size-action ${size.action === 'Custom Quote' ? 'outline' : 'solid'}`}>
                                                                {size.action}
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="detail-card thicknesses-card">
                                                <h2 className="card-title">THICKNESSES</h2>
                                                <p className="card-subtitle">Laser cut, {metal.quickLook.tolerance} tolerance</p>
                                                <div className="thickness-list">
                                                    {metal.quickLook.thicknesses.map((thickness, index) => (
                                                        <div
                                                            key={index}
                                                            className={`thickness-item ${selectedThicknessIndex === index ? 'active' : ''}`}
                                                            onClick={() => {
                                                                setSelectedThicknessIndex(index);
                                                                setActiveTab('Specifications');
                                                            }}
                                                            style={{ cursor: 'pointer' }}
                                                        >
                                                            <span className="thickness-indicator"></span>
                                                            <span className="thickness-val">{thickness.value}</span>
                                                            <span className="thickness-metric">{thickness.metric}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <button className="view-specs-link" onClick={() => handleViewSpecs()}>
                                                    VIEW FULL SPECIFICATIONS →
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {activeTab === 'Specifications' && (
                                <div className="specifications-tab">
                                    <div className="specs-controls">
                                        <div className="unit-toggle-container">
                                            <div className="unit-toggle-horizontal">
                                                <motion.div
                                                    className="unit-slider"
                                                    animate={{ x: unit === 'INCH' ? 0 : '100%' }}
                                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                />
                                                <button
                                                    className={`unit-btn-small ${unit === 'INCH' ? 'active' : ''}`}
                                                    onClick={() => setUnit('INCH')}
                                                >
                                                    INCH
                                                </button>
                                                <button
                                                    className={`unit-btn-small ${unit === 'MM' ? 'active' : ''}`}
                                                    onClick={() => setUnit('MM')}
                                                >
                                                    MM
                                                </button>
                                            </div>
                                        </div>

                                        {metal.quickLook.thicknesses.length > 0 && (
                                            <div className="thickness-selector-wrapper">
                                                <div className="thickness-selector">
                                                    {metal.quickLook.thicknesses.map((thickness, index) => (
                                                        <button
                                                            key={index}
                                                            className={`thickness-btn ${selectedThicknessIndex === index ? 'active' : ''}`}
                                                            onClick={() => setSelectedThicknessIndex(index)}
                                                        >
                                                            <div className="thickness-bar-container">
                                                                <div
                                                                    className="thickness-visual-bar"
                                                                    style={{
                                                                        height: `${Math.max(2, parseFloat(thickness.metric) * 2.5)}px`
                                                                    }}
                                                                />
                                                            </div>
                                                            <span className="thickness-btn-text">
                                                                {unit === 'MM' ? thickness.metric : thickness.value}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="specs-layout-vertical">
                                        <div className="specs-main-full">
                                            <div className="specs-hero">
                                                <h2 className="specs-hero-title">
                                                    <span className="thickness-accent">
                                                        {unit === 'MM'
                                                            ? metal.quickLook.thicknesses[selectedThicknessIndex]?.metric
                                                            : metal.quickLook.thicknesses[selectedThicknessIndex]?.value}
                                                    </span>
                                                    <span className="metal-name-accent">{metal.name}</span>
                                                </h2>
                                                <div className="specs-hero-divider"></div>
                                            </div>

                                            <Showcase images={currentSpecs.showcaseImages} />

                                            <div className="services-section-detail">
                                                <h3 className="section-title-centered">Available Service Specifications</h3>
                                                <div className="services-list-detail">
                                                    {currentSpecs.availableServices?.map((service, index) => (
                                                        <div key={index} className="service-item-detail">
                                                            <div className="service-name-with-icon">
                                                                <span className="check-icon-small">✓</span>
                                                                <span className="service-name">{service}</span>
                                                            </div>
                                                            <button className="view-specs-link-small" onClick={() => handleViewSpecs(sectionRefs[service])}>VIEW SPECS</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="specs-content-section" ref={specsRef}>
                                                <h2 className="section-title-large">Material Details & Specifications</h2>

                                                {currentSpecs.generalDetails?.length > 0 && (
                                                    <div className="specs-table-container">
                                                        <h3 className="table-header-black">{metal.name.split(' ')[0]} {currentThicknessValue} General Details</h3>
                                                        <table className="specs-table">
                                                            <tbody>
                                                                {currentSpecs.generalDetails.map((detail, index) => (
                                                                    <tr key={index}>
                                                                        <td>{detail.label}</td>
                                                                        <td>{unit === 'MM' ? detail.mm : detail.inch}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                {currentSpecs.laserCuttingSpecs?.length > 0 && (
                                                    <div className="specs-table-container" ref={laserRef}>
                                                        <h3 className="table-header-black">LASER CUTTING SPECIFICATIONS</h3>
                                                        <table className="specs-table border-bottom-none">
                                                            <tbody>
                                                                {currentSpecs.laserCuttingSpecs.map((spec, index) => (
                                                                    <tr key={index}>
                                                                        <td>{spec.label}</td>
                                                                        <td>{unit === 'MM' ? spec.mm : spec.inch}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                        <div className="specs-visual-container">
                                                            <img src={laserSpecsSvg} alt="Laser Cutting Specifications Visual" className="specs-svg" />
                                                        </div>
                                                    </div>
                                                )}

                                                {currentSpecs.anodizingSpecs?.length > 0 && (
                                                    <div className="specs-table-container" ref={anodizingRef}>
                                                        <h3 className="table-header-black">ANODIZING SPECIFICATIONS</h3>
                                                        <table className="specs-table">
                                                            <tbody>
                                                                {currentSpecs.anodizingSpecs.map((spec, index) => (
                                                                    <tr key={index}>
                                                                        <td>{spec.label}</td>
                                                                        <td>{unit === 'MM' ? spec.mm : spec.inch}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                {currentSpecs.bendingSpecs?.length > 0 && (
                                                    <div className="specs-table-container" ref={bendingRef}>
                                                        <h3 className="table-header-black">BENDING SPECIFICATIONS</h3>
                                                        <table className="specs-table">
                                                            <tbody>
                                                                {currentSpecs.bendingSpecs.map((spec, index) => (
                                                                    <tr key={index}>
                                                                        <td>{spec.label}</td>
                                                                        <td>{unit === 'MM' ? spec.mm : spec.inch}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                {currentSpecs.countersinkSpecs?.length > 0 && (
                                                    <div className="specs-table-container" ref={countersinkRef}>
                                                        <h3 className="table-header-black">COUNTERSINK SPECIFICATIONS</h3>
                                                        <table className="specs-table">
                                                            <tbody>
                                                                {currentSpecs.countersinkSpecs.map((spec, index) => (
                                                                    <tr key={index}>
                                                                        <td>{spec.label}</td>
                                                                        <td>{unit === 'MM' ? spec.mm : spec.inch}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                {currentSpecs.deburringSpecs?.length > 0 && (
                                                    <div className="specs-table-container" ref={deburringRef}>
                                                        <h3 className="table-header-black">DEBURRING SPECIFICATIONS</h3>
                                                        <table className="specs-table">
                                                            <tbody>
                                                                {currentSpecs.deburringSpecs.map((spec, index) => (
                                                                    <tr key={index}>
                                                                        <td>{spec.label}</td>
                                                                        <td>{unit === 'MM' ? spec.mm : spec.inch}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                {currentSpecs.dimpleSpecs?.length > 0 && (
                                                    <div className="specs-table-container" ref={dimpleRef}>
                                                        <h3 className="table-header-black">DIMPLE SPECIFICATIONS</h3>
                                                        <table className="specs-table">
                                                            <tbody>
                                                                {currentSpecs.dimpleSpecs.map((spec, index) => (
                                                                    <tr key={index}>
                                                                        <td>{spec.label}</td>
                                                                        <td>{unit === 'MM' ? spec.mm : spec.inch}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                {currentSpecs.hardwareSpecs?.length > 0 && (
                                                    <div className="specs-table-container" ref={hardwareRef}>
                                                        <h3 className="table-header-black">HARDWARE SPECIFICATIONS</h3>
                                                        <table className="specs-table">
                                                            <tbody>
                                                                {currentSpecs.hardwareSpecs.map((spec, index) => (
                                                                    <tr key={index}>
                                                                        <td>{spec.label}</td>
                                                                        <td>{unit === 'MM' ? spec.mm : spec.inch}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                {currentSpecs.platingSpecs?.length > 0 && (
                                                    <div className="specs-table-container" ref={platingRef}>
                                                        <h3 className="table-header-black">PLATING SPECIFICATIONS</h3>
                                                        <table className="specs-table">
                                                            <tbody>
                                                                {currentSpecs.platingSpecs.map((spec, index) => (
                                                                    <tr key={index}>
                                                                        <td>{spec.label}</td>
                                                                        <td>{unit === 'MM' ? spec.mm : spec.inch}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                {currentSpecs.powderCoatingSpecs?.length > 0 && (
                                                    <div className="specs-table-container" ref={powderCoatingRef}>
                                                        <h3 className="table-header-black">POWDER COATING SPECIFICATIONS</h3>
                                                        <table className="specs-table">
                                                            <tbody>
                                                                {currentSpecs.powderCoatingSpecs.map((spec, index) => (
                                                                    <tr key={index}>
                                                                        <td>{spec.label}</td>
                                                                        <td>{unit === 'MM' ? spec.mm : spec.inch}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                {currentSpecs.tappingSpecs?.length > 0 && (
                                                    <div className="specs-table-container" ref={tappingRef}>
                                                        <h3 className="table-header-black">TAPPING SPECIFICATIONS</h3>
                                                        <table className="specs-table">
                                                            <tbody>
                                                                {currentSpecs.tappingSpecs.map((spec, index) => (
                                                                    <tr key={index}>
                                                                        <td>{spec.label}</td>
                                                                        <td>{unit === 'MM' ? spec.mm : spec.inch}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                {currentSpecs.tumbleSpecs?.length > 0 && (
                                                    <div className="specs-table-container" ref={tumbleRef}>
                                                        <h3 className="table-header-black">TUMBLE SPECIFICATIONS</h3>
                                                        <table className="specs-table">
                                                            <tbody>
                                                                {currentSpecs.tumbleSpecs.map((spec, index) => (
                                                                    <tr key={index}>
                                                                        <td>{spec.label}</td>
                                                                        <td>{unit === 'MM' ? spec.mm : spec.inch}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                {currentSpecs.properties?.length > 0 && (
                                                    <div className="specs-table-container">
                                                        <h3 className="table-header-black">{metal.name.split(' ')[0]} PROPERTIES</h3>
                                                        <table className="specs-table">
                                                            <tbody>
                                                                {currentSpecs.properties.map((prop, index) => (
                                                                    <tr key={index}>
                                                                        <td>{prop.label}</td>
                                                                        <td>{prop.value}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'About' && (
                                <div className="about-tab-content">
                                    {metal.aboutSection ? (
                                        <div className="about-layout-custom">
                                            {metal.aboutSection.comparisonTable ? (
                                                <div className="comparison-table-section">
                                                    <div className="comparison-header-text">
                                                        <h2 className="section-title-large-centered">{metal.aboutSection.title}</h2>
                                                        <p className="section-subtitle-centered">{metal.aboutSection.text}</p>
                                                    </div>

                                                    <div className="comparison-table-wrapper">
                                                        <table className="comparison-table-premium">
                                                            <thead>
                                                                <tr>
                                                                    <th></th>
                                                                    {metal.aboutSection.comparisonTable.headers.map((header, i) => (
                                                                        <th key={i}>
                                                                            <div className="th-content">
                                                                                <span className="th-name">{header}</span>
                                                                                <span
                                                                                    className="th-view-link"
                                                                                    onClick={() => metal.aboutSection.comparisonTable.mappedIds && handleSubMetalClick(metal.aboutSection.comparisonTable.mappedIds[i])}
                                                                                >
                                                                                    VIEW MATERIAL →
                                                                                </span>
                                                                            </div>
                                                                        </th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {metal.aboutSection.comparisonTable.rows.map((row, i) => (
                                                                    <tr key={i}>
                                                                        <td className="row-label">{row.label}</td>
                                                                        {row.ratings ? row.ratings.map((rating, j) => (
                                                                            <td key={j} className="row-rating-cell">{renderDots(rating)}</td>
                                                                        )) : row.values.map((val, j) => (
                                                                            <td key={j} className="row-value-cell">{val}</td>
                                                                        ))}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="feature-chart-section">
                                                        <h2 className="section-title-large">{metal.name} feature chart</h2>
                                                        <div className="feature-grid">
                                                            {metal.aboutSection.featureChart.map((feature, index) => (
                                                                <div key={index} className="feature-row-custom">
                                                                    <span className="feature-label-name">{feature.label}</span>
                                                                    {renderDots(feature.rating)}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="about-main-content">
                                                        <div className="about-image-container">
                                                            <img src={metal.aboutSection.image} alt={metal.name} className="about-img-premium" />
                                                        </div>
                                                        <div className="about-text-content">
                                                            <h2 className="about-heading-custom">{metal.aboutSection.title}</h2>
                                                            <p className="about-p-custom">{metal.aboutSection.text}</p>
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {metal.aboutSection.capabilities && (
                                                <div className="capabilities-section-custom">
                                                    <h2 className="section-title-large">{metal.aboutSection.capabilities.title}</h2>
                                                    <p className="capabilities-text-custom">{metal.aboutSection.capabilities.text}</p>
                                                    {metal.aboutSection.capabilities.items && (
                                                        <div className="capabilities-grid-custom">
                                                            {metal.aboutSection.capabilities.items.map((item, index) => (
                                                                <div key={index} className="capability-item-custom">
                                                                    <span className="check-icon-custom">✓</span>
                                                                    <span className="capability-name-custom">{item}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="info-placeholder">
                                            <p>Detailed information about {metal.name} is coming soon.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'Services' && (
                                <div className="services-tab-content">
                                    {/* Metal-Level Services */}
                                    {resolvedServices.metalLevel.length > 0 ? (
                                        <>
                                            <h2 className="section-title-large">General Services for {metal.name}</h2>
                                            <div className="services-grid">
                                                {resolvedServices.metalLevel.map(service => (
                                                    <motion.div
                                                        key={service.id}
                                                        className="service-card"
                                                        initial={{ opacity: 0, y: 20 }}
                                                        whileInView={{ opacity: 1, y: 0 }}
                                                        viewport={{ once: true }}
                                                        whileHover={{ y: -10, transition: { duration: 0.3 } }}
                                                    >
                                                        <div className="service-image-container">
                                                            <img src={service.image_path} alt={service.title} className="service-image" />
                                                        </div>
                                                        <div className="service-info">
                                                            <h3 className="service-title">{service.title}</h3>
                                                            <p className="service-description">{service.description}</p>
                                                            <div className="service-arrow">
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                                                    <polyline points="12 5 19 12 12 19"></polyline>
                                                                </svg>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </>
                                    ) : metal.services && metal.services.length > 0 ? (
                                        /* Fallback to static data when API unavailable */
                                        <>
                                            <h2 className="section-title-large">Services available for {metal.name}</h2>
                                            <div className="services-grid">
                                                {metal.services.map(serviceId => {
                                                    const service = servicesData.find(s => s.id === serviceId);
                                                    return service ? (
                                                        <motion.div
                                                            key={service.id}
                                                            className="service-card"
                                                            initial={{ opacity: 0, y: 20 }}
                                                            whileInView={{ opacity: 1, y: 0 }}
                                                            viewport={{ once: true }}
                                                            whileHover={{ y: -10, transition: { duration: 0.3 } }}
                                                        >
                                                            <div className="service-image-container">
                                                                <img src={service.image} alt={service.title} className="service-image" />
                                                            </div>
                                                            <div className="service-info">
                                                                <h3 className="service-title">{service.title}</h3>
                                                                <p className="service-description">{service.description}</p>
                                                                <div className="service-arrow">
                                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                                                        <polyline points="12 5 19 12 12 19"></polyline>
                                                                    </svg>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    ) : null;
                                                })}
                                            </div>
                                        </>
                                    ) : null}

                                    {/* Thickness-Level Services */}
                                    {resolvedServices.thicknessLevel.length > 0 &&
                                        resolvedServices.thicknessLevel.some(t => t.services?.length > 0) && (
                                            <div className="thickness-services-section" style={{ marginTop: 40 }}>
                                                <h2 className="section-title-large">Services by Thickness</h2>
                                                {resolvedServices.thicknessLevel
                                                    .filter(t => t.services && t.services.length > 0)
                                                    .map((thicknessGroup, idx) => (
                                                        <div key={idx} className="thickness-service-group" style={{ marginBottom: 32 }}>
                                                            <h3 style={{
                                                                fontSize: '1.1rem',
                                                                fontWeight: 600,
                                                                color: '#333',
                                                                marginBottom: 16,
                                                                paddingBottom: 8,
                                                                borderBottom: '2px solid #e5e7eb',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 8
                                                            }}>
                                                                <span style={{
                                                                    background: '#1a1a2e',
                                                                    color: '#fff',
                                                                    padding: '2px 10px',
                                                                    borderRadius: 4,
                                                                    fontSize: '0.9rem'
                                                                }}>
                                                                    {thicknessGroup.thickness}
                                                                </span>
                                                                {thicknessGroup.metric && (
                                                                    <span style={{ color: '#6b7280', fontWeight: 400, fontSize: '0.9rem' }}>
                                                                        ({thicknessGroup.metric})
                                                                    </span>
                                                                )}
                                                                <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '0.85rem', marginLeft: 'auto' }}>
                                                                    {thicknessGroup.services.length} service{thicknessGroup.services.length !== 1 ? 's' : ''}
                                                                </span>
                                                            </h3>
                                                            <div className="services-grid">
                                                                {thicknessGroup.services.map(service => (
                                                                    <motion.div
                                                                        key={service.id}
                                                                        className="service-card"
                                                                        initial={{ opacity: 0, y: 20 }}
                                                                        whileInView={{ opacity: 1, y: 0 }}
                                                                        viewport={{ once: true }}
                                                                        whileHover={{ y: -10, transition: { duration: 0.3 } }}
                                                                    >
                                                                        <div className="service-image-container">
                                                                            <img src={service.image_path} alt={service.title} className="service-image" />
                                                                        </div>
                                                                        <div className="service-info">
                                                                            <h3 className="service-title">{service.title}</h3>
                                                                            <p className="service-description">{service.description}</p>
                                                                            <div className="service-arrow">
                                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                                                                    <polyline points="12 5 19 12 12 19"></polyline>
                                                                                </svg>
                                                                            </div>
                                                                        </div>
                                                                    </motion.div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        )}

                                    {/* Empty state */}
                                    {(!metal.services || metal.services.length === 0) &&
                                        resolvedServices.metalLevel.length === 0 &&
                                        !resolvedServices.thicknessLevel.some(t => t.services?.length > 0) && (
                                            <div className="info-placeholder">
                                                <p>Service information for {metal.name} is being compiled. Check back soon!</p>
                                            </div>
                                        )}
                                </div>
                            )}

                            {activeTab === 'FAQS' && (
                                <div className="faqs-tab-content">
                                    <h2 className="section-title-large">{metal.name} FAQs</h2>
                                    <div className="faq-list-custom">
                                        {metal.faqs?.map((faq, index) => (
                                            <div key={index} className={`faq-item-custom ${activeFaq === index ? 'active' : ''}`}>
                                                <div className="faq-question-row" onClick={() => toggleFaq(index)}>
                                                    <span className="faq-icon-circle">{activeFaq === index ? '−' : '+'}</span>
                                                    <h3 className="faq-question-text">{faq.question}</h3>
                                                </div>
                                                <AnimatePresence>
                                                    {activeFaq === index && (
                                                        <motion.div
                                                            className="faq-answer-row"
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.3 }}
                                                            style={{ overflow: 'hidden' }}
                                                        >
                                                            <p className="faq-answer-text">{faq.answer}</p>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        ))}
                                        {(!metal.faqs || metal.faqs.length === 0) && (
                                            <div className="info-placeholder">
                                                <p>FAQs for {metal.name} are being compiled. Check back soon!</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Custom fields for this tab */}
                            {metal.custom_fields && Object.values(metal.custom_fields).some(f => f.tab === activeTab) && (
                                <div className="custom-fields-section">
                                    <table className="specs-table">
                                        <tbody>
                                            {Object.values(metal.custom_fields)
                                                .filter(f => f.tab === activeTab && f.label && f.value)
                                                .map((f, i) => (
                                                    <tr key={i}>
                                                        <td>{f.label}</td>
                                                        <td>{f.value}</td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </motion.div >
    );
};

export default MetalDetail;
