import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { servicesData } from '../data/servicesData';
import { fetchServices } from '../utils/api';
import ThumbImage from './ThumbImage';
import '../styles/HomeServices.css';

/**
 * Home page services: a three-column index of what the shop does. Each
 * entry is a small part render on a grey tile beside its name and one
 * line of description, with a hairline above it. Admin-set services
 * replace the built-in list once they load.
 */

const Services = () => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        fetchServices()
            .then(apiServices => {
                if (apiServices && apiServices.length > 0) {
                    // Map API format (image_path) to component format (image)
                    // Keep static image as fallback if API image_path is missing
                    const mapped = apiServices.map(svc => {
                        const staticMatch = servicesData.find(s => s.id === svc.id);
                        return {
                            ...svc,
                            image: svc.image_path || staticMatch?.image || '',
                            fallbackImage: staticMatch?.image || '',
                        };
                    });
                    setServices(mapped);
                } else {
                    setServices(servicesData);
                }
            })
            .catch(() => {
                // Silently fall back to static data
                setServices(servicesData);
            })
            .finally(() => setLoading(false));
    }, []);

    const reveal = (delay = 0) => (reduceMotion ? {} : {
        initial: { opacity: 0, y: 12 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-40px' },
        transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] },
    });

    return (
        <section id="services" className="hs" aria-labelledby="hs-title">
            <div className="hs-inner">
                <motion.div className="hs-head" {...reveal()}>
                    <h2 id="hs-title" className="hs-title">Everything you need in just a few clicks.</h2>
                    <p className="hs-lede">Cutting, forming, hardware and finishing, all priced together in one order.</p>
                </motion.div>

                {loading ? (
                    <ul className="hs-grid" aria-hidden="true">
                        {[0, 1, 2, 3, 4, 5].map(i => (
                            <li key={i} className="hs-item">
                                <span className="hs-card is-skeleton">
                                    <span className="shimmer hs-media" />
                                    <span className="hs-text">
                                        <span className="shimmer hs-sk-name" />
                                        <span className="shimmer hs-sk-line" />
                                        <span className="shimmer hs-sk-line is-short" />
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                <ul className="hs-grid">
                    {services.map((service, index) => (
                        <motion.li key={service.id} className="hs-item" {...reveal(Math.min(index, 8) * 0.04)}>
                            {/* Built-in entries carry no slug; they open the full list instead. */}
                            <Link to={service.slug ? `/service/${service.slug}` : '/services'} className="hs-card">
                                <ThumbImage
                                    key={service.image}
                                    className="hs-media"
                                    src={service.image}
                                    fallback={service.fallbackImage}
                                />
                                <div className="hs-text">
                                    <h3 className="hs-name">
                                        <span>{service.title}</span>
                                        <ArrowRight size={16} aria-hidden="true" />
                                    </h3>
                                    {service.description && <p className="hs-desc">{service.description}</p>}
                                </div>
                            </Link>
                        </motion.li>
                    ))}
                </ul>
                )}

                <motion.div className="hs-actions" {...reveal(0.1)}>
                    <Link to="/services" className="hs-btn">View all services</Link>
                    <Link to="/get-instant-pricing" className="hs-btn is-primary">
                        Get started
                        <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                </motion.div>
            </div>
        </section>
    );
};

export default Services;
