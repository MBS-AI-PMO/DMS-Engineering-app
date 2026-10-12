import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { ArrowRight } from 'lucide-react';
import { fetchServices } from '../utils/api';
import { servicesData } from '../data/servicesData';
import ThumbImage from '../components/ThumbImage';
import serviceHeroBg from '../assets/services/service-hero-bg.webp';
import '../styles/Shimmer.css';
import '../styles/ServicesPage.css';

/**
 * The services page: a heading band over the laser-cutting photo with live
 * counts, then the services in two groups — the main processes, each with
 * the add-ons that go with it, and the add-ons and finishes — then the
 * four steps from file to part, then a band that leads to instant pricing.
 * Counts and cards shimmer until the services have loaded.
 */

const STEPS = [
    {
        title: 'Upload your part',
        description: 'Drop in a STEP or DXF file. We read the geometry and work out the flat pattern.',
    },
    {
        title: 'Choose material and services',
        description: 'Pick a metal and thickness, then add bending, tapping, hardware or a finish.',
    },
    {
        title: 'See your price',
        description: 'The price updates as you change options, so you know the cost before you order.',
    },
    {
        title: 'We make your parts',
        description: 'Once the order is placed, your parts are cut, formed and finished, then shipped to you.',
    },
];

// The built-in picture for the same service, by id.
const staticImageFor = (service) => servicesData.find(s => s.id === service.id)?.image || '';

// A service's parents: the list when admin set several, else the single one.
const parentIdsOf = (service) => {
    const ids = Array.isArray(service.parent_ids) && service.parent_ids.length
        ? service.parent_ids
        : (service.parent_id != null ? [service.parent_id] : []);
    return ids.map(Number).filter(Number.isFinite);
};

const ServicesPage = () => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        let cancelled = false;
        fetchServices()
            .then((apiServices) => {
                if (cancelled) return;
                setServices(Array.isArray(apiServices) ? apiServices : []);
            })
            .catch(() => {
                if (!cancelled) setServices([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    const { processes, addOns, byId } = useMemo(() => {
        const map = new Map(services.map(s => [Number(s.id), s]));
        const main = services.filter(s => s.is_production);
        // No process flagged: show everything as one group.
        const rest = main.length ? services.filter(s => !s.is_production) : services;
        return { processes: main, addOns: rest, byId: map };
    }, [services]);

    const childrenOf = (service) => addOns.filter(s => parentIdsOf(s).includes(Number(service.id)));
    // Named only when an add-on fits some processes but not all of them.
    const worksWith = (service) => {
        const parents = parentIdsOf(service).map(id => byId.get(id)).filter(p => p && p.is_production);
        return parents.length < processes.length ? parents.map(p => p.title) : [];
    };

    const reveal = (delay = 0) => (reduceMotion ? {} : {
        initial: { opacity: 0, y: 12 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-40px' },
        transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] },
    });

    const stat = (value) => (loading
        ? <span className="shimmer sp-sk-stat" aria-hidden="true" />
        : value);

    const linkTo = (service) => `/service/${service.slug || service.id}`;

    return (
        <div className="sp">
            {/* ── Heading band ── */}
            <section className="sp-hero" aria-labelledby="sp-title">
                <img
                    className="sp-hero-img"
                    src={serviceHeroBg}
                    alt=""
                    aria-hidden="true"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                />
                <div className="sp-hero-shade" aria-hidden="true" />
                <div className="sp-inner sp-hero-content">
                    <nav className="sp-crumbs" aria-label="Breadcrumb">
                        <Link to="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">Services</span>
                    </nav>
                    <h1 id="sp-title" className="sp-title">Manufacturing services</h1>
                    <p className="sp-lede">
                        Laser cutting and CNC machining, plus the bending, hardware and finishing that go
                        with them, all priced together in one order.
                    </p>

                    <dl className="sp-stats" aria-busy={loading}>
                        <div className="sp-stat">
                            <dt>Services</dt>
                            <dd>{stat(services.length)}</dd>
                        </div>
                        {(loading || processes.length > 0) && (
                            <div className="sp-stat">
                                <dt>Processes</dt>
                                <dd>{stat(processes.length)}</dd>
                            </div>
                        )}
                        {(loading || processes.length > 0) && (
                            <div className="sp-stat">
                                <dt>Add-ons and finishes</dt>
                                <dd>{stat(addOns.length)}</dd>
                            </div>
                        )}
                    </dl>

                    <div className="sp-hero-actions">
                        <Link to="/get-instant-pricing" className="sp-btn is-primary">
                            Get instant pricing
                            <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                        <Link to="/metals" className="sp-hero-link">Browse metals</Link>
                    </div>
                </div>
            </section>

            {/* ── Services ── */}
            <section className="sp-catalog" aria-label="Services">
                <div className="sp-inner">
                    {loading ? (
                        <div aria-hidden="true">
                            <div className="sp-group-head">
                                <span className="shimmer sp-sk-heading" />
                            </div>
                            <div className="sp-process-grid">
                                {[0, 1].map(i => (
                                    <div key={i} className="sp-process is-skeleton">
                                        <span className="shimmer sp-process-media" />
                                        <span className="sp-process-body">
                                            <span className="shimmer sp-sk-line is-name" />
                                            <span className="shimmer sp-sk-line" />
                                            <span className="shimmer sp-sk-line is-short" />
                                            <span className="sp-sk-chips">
                                                <span className="shimmer sp-sk-chip" />
                                                <span className="shimmer sp-sk-chip" />
                                                <span className="shimmer sp-sk-chip" />
                                            </span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="sp-group-head is-second">
                                <span className="shimmer sp-sk-heading" />
                            </div>
                            <div className="sp-addon-grid">
                                {[0, 1, 2, 3].map(i => (
                                    <div key={i} className="sp-addon is-skeleton">
                                        <span className="shimmer sp-addon-media" />
                                        <span className="sp-addon-body">
                                            <span className="shimmer sp-sk-line is-name" />
                                            <span className="shimmer sp-sk-line" />
                                            <span className="shimmer sp-sk-line is-short" />
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : services.length === 0 ? (
                        <div className="sp-empty">
                            <h2 className="sp-empty-title">Services could not be loaded</h2>
                            <p>Please refresh the page in a moment, or get a price straight away.</p>
                            <Link to="/get-instant-pricing" className="sp-btn">Get instant pricing</Link>
                        </div>
                    ) : (
                        <>
                            {processes.length > 0 && (
                                <>
                                    <motion.div className="sp-group-head" {...reveal()}>
                                        <h2 className="sp-group-title">Processes</h2>
                                        <p className="sp-group-text">Every part starts with one of these.</p>
                                    </motion.div>
                                    <div className="sp-process-grid">
                                        {processes.map((service, index) => {
                                            const children = childrenOf(service);
                                            return (
                                                <motion.article key={service.id} className="sp-process" {...reveal(index * 0.06)}>
                                                    <ThumbImage
                                                        key={service.image_path}
                                                        className="sp-process-media"
                                                        src={service.image_path}
                                                        fallback={staticImageFor(service)}
                                                    />
                                                    <div className="sp-process-body">
                                                        <h3 className="sp-process-name">
                                                            <Link to={linkTo(service)} className="sp-stretch">{service.title}</Link>
                                                        </h3>
                                                        {service.description && <p className="sp-process-desc">{service.description}</p>}
                                                        {children.length > 0 && children.length === addOns.length && (
                                                            <p className="sp-process-all">Works with every add-on and finish below.</p>
                                                        )}
                                                        {children.length > 0 && children.length < addOns.length && (
                                                            <div className="sp-process-adds">
                                                                <span className="sp-label">Add-ons</span>
                                                                <ul className="sp-chips">
                                                                    {children.map(child => (
                                                                        <li key={child.id}>
                                                                            <Link to={linkTo(child)} className="sp-chip">{child.title}</Link>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                        <span className="sp-more" aria-hidden="true">
                                                            View details
                                                            <ArrowRight size={15} />
                                                        </span>
                                                    </div>
                                                </motion.article>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            {addOns.length > 0 && (
                                <>
                                    <motion.div className={`sp-group-head${processes.length ? ' is-second' : ''}`} {...reveal()}>
                                        <h2 className="sp-group-title">{processes.length ? 'Add-ons and finishes' : 'All services'}</h2>
                                        {processes.length > 0 && (
                                            <p className="sp-group-text">Added to a cut or machined part in the same order.</p>
                                        )}
                                    </motion.div>
                                    <ul className="sp-addon-grid">
                                        {addOns.map((service, index) => {
                                            const parents = worksWith(service);
                                            return (
                                                <motion.li key={service.id} className="sp-addon-item" {...reveal(Math.min(index, 8) * 0.04)}>
                                                    <Link to={linkTo(service)} className="sp-addon">
                                                        <ThumbImage
                                                            key={service.image_path}
                                                            className="sp-addon-media"
                                                            src={service.image_path}
                                                            fallback={staticImageFor(service)}
                                                        />
                                                        <div className="sp-addon-body">
                                                            <h3 className="sp-addon-name">
                                                                <span>{service.title}</span>
                                                                <ArrowRight size={16} aria-hidden="true" />
                                                            </h3>
                                                            {service.description && <p className="sp-addon-desc">{service.description}</p>}
                                                            {parents.length > 0 && (
                                                                <p className="sp-addon-with">Works with {parents.join(', ')}</p>
                                                            )}
                                                        </div>
                                                    </Link>
                                                </motion.li>
                                            );
                                        })}
                                    </ul>
                                </>
                            )}
                        </>
                    )}
                </div>
            </section>

            {/* ── From file to part ── */}
            <section className="sp-steps" aria-labelledby="sp-steps-title">
                <div className="sp-inner">
                    <motion.div className="sp-steps-head" {...reveal()}>
                        <h2 id="sp-steps-title" className="sp-steps-title">From file to finished part</h2>
                        <p className="sp-steps-text">Four steps, all online.</p>
                    </motion.div>
                    <ol className="sp-step-list">
                        {STEPS.map((step, index) => (
                            <motion.li key={step.title} className="sp-step" {...reveal(index * 0.06)}>
                                <span className="sp-step-num" aria-hidden="true">{index + 1}</span>
                                <h3 className="sp-step-title">{step.title}</h3>
                                <p className="sp-step-text">{step.description}</p>
                            </motion.li>
                        ))}
                    </ol>
                </div>
            </section>

        </div>
    );
};

export default ServicesPage;
