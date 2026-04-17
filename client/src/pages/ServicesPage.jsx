import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Clock3, Layers3, ShieldCheck } from 'lucide-react';
import { fetchServices } from '../utils/api';
import serviceHeroBg from '../assets/services/service-hero-bg.webp';
import './ServicesPage.css';

const PROCESS_STEPS = [
    {
        title: 'Upload and Configure',
        description: 'Upload your part, select the process, choose material and thickness, and define precision options.',
    },
    {
        title: 'Instant Validation',
        description: 'Our workflow validates manufacturability, dimensional fit, and compatible finishing selections.',
    },
    {
        title: 'Production Kickoff',
        description: 'Once approved, your job enters production with quality checkpoints tied to your selected process.',
    },
    {
        title: 'Delivery and Support',
        description: 'Receive your parts with full support for revisions, repeat builds, and scaling to higher volumes.',
    },
];

const QUALITY_PILLARS = [
    'Consistent quality controls for every operation',
    'Fast quoting and transparent production readiness',
    'Process guidance for prototype and production runs',
    'Designed for repeatable, scalable manufacturing workflows',
];

const fadeInUp = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.18 },
    transition: { duration: 0.5, ease: 'easeOut' },
};

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.08,
        },
    },
};

const staggerItem = {
    hidden: { opacity: 0, y: 18 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

const ServicesPage = () => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchServices()
            .then((apiServices) => {
                if (!Array.isArray(apiServices) || apiServices.length === 0) {
                    setServices([]);
                    return;
                }
                const mapped = apiServices.map((service) => {
                    return {
                        ...service,
                        image: service.image_path || '',
                        description: service.description || 'Precision manufacturing service.',
                    };
                });
                setServices(mapped);
            })
            .catch(() => {
                setServices([]);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    const primaryServices = useMemo(() => services.slice(0, 6), [services]);

    return (
        <div className="services-page-light">
            <section className="services-page-hero">
                <div className="services-page-hero-bg">
                    <img
                        src={serviceHeroBg}
                        alt="Manufacturing floor equipment and precision parts"
                        loading="eager"
                        fetchPriority="high"
                        decoding="async"
                    />
                </div>
                <div className="services-page-hero-overlay" />

                <div className="container services-page-hero-content">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="services-page-hero-intro"
                    >
                        {loading ? (
                            <div className="services-page-hero-intro-skeleton">
                                <div className="skeleton services-skeleton-badge" />
                                <div className="skeleton services-skeleton-hero-title" />
                                <div className="skeleton services-skeleton-hero-title short" />
                                <div className="skeleton services-skeleton-hero-line" />
                                <div className="skeleton services-skeleton-hero-line medium" />
                                <div className="skeleton services-skeleton-hero-button" />
                            </div>
                        ) : (
                            <>
                                <motion.span {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.04 }} className="services-page-badge">
                                    DMS Service Platform
                                </motion.span>
                                <motion.h1 {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.08 }}>
                                    Full-Spectrum Manufacturing Services in One Workflow
                                </motion.h1>
                                <motion.p {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.12 }}>
                                    Browse every production and finishing capability from one place. Configure parts with
                                    clear options, practical limits, and reliable turnaround built for both prototypes and
                                    production runs.
                                </motion.p>
                                <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.16 }} className="services-page-hero-actions">
                                    <Link to="/get-instant-pricing" className="services-page-btn primary">
                                        Start Instant Pricing <ArrowRight size={18} />
                                    </Link>
                                </motion.div>
                            </>
                        )}
                    </motion.div>

                    <motion.div
                        className="services-page-hero-grid"
                        variants={staggerContainer}
                        initial="hidden"
                        animate="visible"
                    >
                        {loading
                            ? [...Array(6)].map((_, idx) => (
                                <div key={`hero-skeleton-${idx}`} className="services-page-hero-card skeleton-card services-page-hero-card-skeleton">
                                    <div className="services-page-hero-card-media skeleton" />
                                    <div className="services-page-hero-card-text">
                                        <div className="skeleton services-skeleton-title-line" />
                                        <div className="skeleton services-skeleton-body-line" />
                                        <div className="skeleton services-skeleton-body-line short" />
                                    </div>
                                </div>
                            ))
                            : services.map((service) => (
                                <motion.div key={service.id} variants={staggerItem}>
                                    <Link to={`/service/${service.slug || service.id}`} className="services-page-hero-card">
                                        <div className="services-page-hero-card-media">
                                            {service.image ? (
                                                <img src={service.image} alt={service.title} loading="lazy" decoding="async" />
                                            ) : (
                                                <div className="services-page-hero-card-fallback">
                                                    <Layers3 size={18} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="services-page-hero-card-text">
                                            <h3>{service.title}</h3>
                                            <p>{service.description}</p>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        {!loading && services.length === 0 && (
                            <div className="services-page-empty">
                                <h3>No services available right now</h3>
                                <p>We could not load services from the API at this time. Please try again shortly.</p>
                            </div>
                        )}
                    </motion.div>
                </div>
            </section>

            <section className="services-page-section">
                <div className="container services-page-process">
                    {loading ? (
                        <>
                            <div className="services-page-section-head services-page-section-head-skeleton">
                                <div className="skeleton services-skeleton-section-title" />
                                <div className="skeleton services-skeleton-section-line" />
                                <div className="skeleton services-skeleton-section-line medium" />
                            </div>
                            <div className="services-page-step-grid">
                                {[...Array(4)].map((_, idx) => (
                                    <article key={`step-skeleton-${idx}`} className="services-page-step-card skeleton-card">
                                        <div className="skeleton services-skeleton-step-index" />
                                        <div className="skeleton services-skeleton-step-title" />
                                        <div className="skeleton services-skeleton-step-line" />
                                        <div className="skeleton services-skeleton-step-line medium" />
                                    </article>
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <motion.div className="services-page-section-head" {...fadeInUp}>
                                <h2>How Our Service Workflow Works</h2>
                                <p>
                                    The platform is built to reduce back-and-forth and make service selection clear from the
                                    first upload to final delivery.
                                </p>
                            </motion.div>

                            <motion.div className="services-page-step-grid" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}>
                                {PROCESS_STEPS.map((step, idx) => (
                                    <motion.article key={step.title} className="services-page-step-card" variants={staggerItem}>
                                        <span className="services-page-step-index">0{idx + 1}</span>
                                        <h3>{step.title}</h3>
                                        <p>{step.description}</p>
                                    </motion.article>
                                ))}
                            </motion.div>
                        </>
                    )}
                </div>
            </section>

            <section className="services-page-section alt">
                <div className="container services-page-value-wrap">
                    {loading ? (
                        <>
                            <div className="services-page-value-copy skeleton-card">
                                <div className="skeleton services-skeleton-value-title" />
                                <div className="skeleton services-skeleton-value-title short" />
                                <div className="skeleton services-skeleton-value-line" />
                                <div className="skeleton services-skeleton-value-line medium" />
                                <div className="skeleton services-skeleton-value-line short" />
                                <div className="skeleton services-skeleton-value-line" />
                                <div className="services-page-mini-pills">
                                    <span className="skeleton services-skeleton-pill" />
                                    <span className="skeleton services-skeleton-pill" />
                                    <span className="skeleton services-skeleton-pill" />
                                </div>
                            </div>
                            <div className="services-page-pillar-panel skeleton-card">
                                <div className="skeleton services-skeleton-pillar-title" />
                                {[...Array(4)].map((_, idx) => (
                                    <div key={`pillar-line-${idx}`} className="skeleton services-skeleton-pillar-line" />
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <motion.div className="services-page-value-copy" {...fadeInUp}>
                                <h2>
                                    <span className="services-page-inline-heading-icon"><Layers3 size={18} /></span>
                                    Built for Teams That Need Speed and Repeatability
                                </h2>
                                <p>
                                    From first article samples to repeat production, our services are designed to stay
                                    consistent as your part count grows. You get predictable process control, clearer
                                    manufacturing limits, and better coordination between cutting, machining, and finishing.
                                </p>
                                <p>
                                    Every service is configured to work with real engineering constraints. That means fewer
                                    surprises, faster approvals, and cleaner handoffs between design, procurement, and
                                    manufacturing.
                                </p>
                                <div className="services-page-mini-pills">
                                    <span><Clock3 size={14} /> Fast turnaround</span>
                                    <span><ShieldCheck size={14} /> Reliable quality</span>
                                    <span><CheckCircle2 size={14} /> Production ready</span>
                                </div>
                            </motion.div>

                            <motion.div className="services-page-pillar-panel" {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.08 }}>
                                <div className="services-page-pillar-header">
                                    <ShieldCheck size={20} />
                                    <h3>Quality and Delivery Pillars</h3>
                                </div>
                                <ul>
                                    {QUALITY_PILLARS.map((item) => (
                                        <li key={item}>
                                            <CheckCircle2 size={16} />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                        </>
                    )}
                </div>
            </section>

            <section className="services-page-section">
                <div className="container">
                    {loading ? (
                        <div className="services-page-section-head services-page-section-head-skeleton">
                            <div className="skeleton services-skeleton-section-title" />
                            <div className="skeleton services-skeleton-section-line" />
                            <div className="skeleton services-skeleton-section-line medium" />
                        </div>
                    ) : (
                        <motion.div className="services-page-section-head" {...fadeInUp}>
                            <h2>Explore Service Capabilities</h2>
                            <p>
                                Select any service to review detailed constraints, available options, and where it fits in
                                your production plan.
                            </p>
                        </motion.div>
                    )}

                    <motion.div className="services-page-catalog" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}>
                        {loading
                            ? [...Array(6)].map((_, idx) => (
                                <article key={`catalog-skeleton-${idx}`} className="services-page-catalog-item skeleton-card">
                                    <div className="services-page-catalog-media skeleton" />
                                    <div className="services-page-catalog-copy">
                                        <div className="skeleton services-skeleton-catalog-title" />
                                        <div className="skeleton services-skeleton-catalog-line" />
                                        <div className="skeleton services-skeleton-catalog-line medium" />
                                        <div className="skeleton services-skeleton-catalog-link" />
                                    </div>
                                </article>
                            ))
                            : primaryServices.map((service) => (
                                <motion.article key={service.id} className="services-page-catalog-item" variants={staggerItem}>
                                    <div className="services-page-catalog-media">
                                        {service.image ? (
                                            <img src={service.image} alt={service.title} loading="lazy" decoding="async" />
                                        ) : (
                                            <div className="services-page-catalog-fallback">
                                                <Layers3 size={18} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="services-page-catalog-copy">
                                        <h3>{service.title}</h3>
                                        <p>{service.description}</p>
                                        <Link to={`/service/${service.slug || service.id}`} className="services-page-inline-link">
                                            View Service Details <ArrowRight size={16} />
                                        </Link>
                                    </div>
                                </motion.article>
                            ))}
                        {!loading && primaryServices.length === 0 && (
                            <article className="services-page-catalog-item services-page-catalog-empty">
                                <div className="services-page-catalog-copy">
                                    <h3>Catalog temporarily unavailable</h3>
                                    <p>Service data is currently unavailable from the API. Please check again shortly.</p>
                                </div>
                            </article>
                        )}
                    </motion.div>
                </div>
            </section>

            <section className="services-page-section alt">
                <motion.div className="container services-page-bottom-grid" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}>
                    {loading ? [...Array(3)].map((_, idx) => (
                        <article key={`info-skeleton-${idx}`} className="services-page-info-card skeleton-card">
                            <div className="skeleton services-skeleton-info-icon" />
                            <div className="skeleton services-skeleton-info-title" />
                            <div className="skeleton services-skeleton-info-line" />
                            <div className="skeleton services-skeleton-info-line medium" />
                        </article>
                    )) : (
                        <>
                            <motion.article className="services-page-info-card" variants={staggerItem}>
                                <div className="services-page-info-icon">
                                    <Clock3 size={20} />
                                </div>
                                <h3>Faster Time to Production</h3>
                                <p>
                                    Service bundling, clear constraints, and immediate option checks help teams move from
                                    design intent to production-ready parts with less delay.
                                </p>
                            </motion.article>

                            <motion.article className="services-page-info-card" variants={staggerItem}>
                                <div className="services-page-info-icon">
                                    <ShieldCheck size={20} />
                                </div>
                                <h3>Predictable Manufacturing Outcomes</h3>
                                <p>
                                    Consistent workflows help ensure your selected service stack aligns with process limits,
                                    material realities, and production requirements.
                                </p>
                            </motion.article>

                            <motion.article className="services-page-info-card" variants={staggerItem}>
                                <div className="services-page-info-icon">
                                    <Layers3 size={20} />
                                </div>
                                <h3>Flexible for Every Build Stage</h3>
                                <p>
                                    Whether you are validating prototypes or scaling order volume, the same service architecture
                                    supports iterative builds and repeat orders.
                                </p>
                            </motion.article>
                        </>
                    )}
                </motion.div>
            </section>

            <section className="services-page-cta">
                <div className="container services-page-cta-box">
                    {loading ? (
                        <div className="services-page-cta-skeleton">
                            <div className="skeleton services-skeleton-cta-title" />
                            <div className="skeleton services-skeleton-cta-line" />
                            <div className="skeleton services-skeleton-cta-line medium" />
                            <div className="services-page-cta-actions">
                                <div className="skeleton services-skeleton-cta-btn" />
                                <div className="skeleton services-skeleton-cta-btn secondary" />
                            </div>
                        </div>
                    ) : (
                        <>
                            <motion.h2 {...fadeInUp}>Ready to Configure Your Next Project?</motion.h2>
                            <motion.p {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.06 }}>
                                Pick your service path, validate manufacturability, and launch production with confidence.
                            </motion.p>
                            <motion.div className="services-page-cta-actions" {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.12 }}>
                                <Link to="/get-instant-pricing" className="services-page-btn primary">
                                    Get Instant Pricing <ArrowRight size={18} />
                                </Link>
                                <Link to="/metals" className="services-page-btn secondary">
                                    Explore Metals
                                </Link>
                            </motion.div>
                        </>
                    )}
                </div>
            </section>
        </div>
    );
};

export default ServicesPage;
