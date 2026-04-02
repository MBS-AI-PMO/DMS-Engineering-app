import React, { useState, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { servicesData } from '../data/servicesData';
import { fetchServices } from '../utils/api';

const Services = () => {
    const [services, setServices] = useState(servicesData);

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
                        };
                    });
                    setServices(mapped);
                }
            })
            .catch(() => {
                // Silently fall back to static data
            });
    }, []);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2
            }
        }
    };

    const itemVariants = {
        hidden: { y: 30, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                duration: 0.6,
                ease: "easeOut"
            }
        }
    };

    return (
        <section className="services-section">
            <div className="services-container">
                <motion.h2
                    className="services-main-title"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                >
                    Everything you need in just a few clicks.
                </motion.h2>

                <motion.div
                    className="services-grid"
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-20px" }}
                >
                    {services.map((service) => (
                        <motion.div
                            key={service.id}
                            className="service-card"
                            variants={itemVariants}
                            whileHover={{ y: -10, transition: { duration: 0.3 } }}
                        >
                            <div className="service-image-container">
                                <img src={service.image} alt={service.title} className="service-image" loading="lazy" decoding="async" />
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
                </motion.div>

                <motion.div
                    className="services-actions"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                >
                    <button className="btn-services-outline">VIEW ALL SERVICES</button>
                    <button className="btn-services-solid">GET STARTED</button>
                </motion.div>
            </div>
        </section>
    );
};

export default Services;
