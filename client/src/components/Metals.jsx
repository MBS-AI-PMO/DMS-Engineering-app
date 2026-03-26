import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { metalsData } from '../data/metalsData';
import { fetchMetals } from '../utils/api';

const Metals = () => {
    const [metals, setMetals] = useState(metalsData);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadMetals() {
            try {
                const data = await fetchMetals();
                setMetals(data.map(m => ({
                    id: m.id,
                    slug: m.slug,
                    name: m.name,
                    thickness: m.thickness,
                    image: m.image_path,
                })));
            } catch (err) {
                console.warn('API unavailable, using static data:', err.message);
            } finally {
                setLoading(false);
            }
        }
        loadMetals();
    }, []);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05,
                delayChildren: 0.2
            }
        }
    };

    const cardVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.5,
                ease: "easeOut"
            }
        }
    };

    return (
        <section id="metals" className="metals-section">
            <div className="metals-container">
                <motion.div
                    className="metals-header"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                >
                    <h2 className="metals-title">60+ Metals in stock</h2>
                    <p className="metals-subtitle">Choose from our wide range of premium metals for your custom parts.</p>
                </motion.div>

                <motion.div
                    className="metals-grid"
                    key={loading ? 'loading' : 'loaded'}
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-20px" }}
                >
                    {loading ? (
                        [...Array(6)].map((_, i) => (
                            <div key={i} className="skeleton skeleton-metal-card"></div>
                        ))
                    ) : metals.map((metal) => (
                        <motion.div key={metal.id} variants={cardVariants}>
                            <Link to={`/metal/${metal.slug || metal.id}`} className="metal-card-link">
                                <motion.div
                                    className="metal-card"
                                    whileHover={{
                                        y: -5,
                                        boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                                        transition: { duration: 0.2 }
                                    }}
                                >
                                    <div className="metal-thumbnail">
                                        <img src={metal.image} alt={metal.name} />
                                    </div>
                                    <div className="metal-info">
                                        <h3 className="metal-name">{metal.name}</h3>
                                        <p className="metal-thickness">{metal.thickness}</p>
                                    </div>
                                    <div className="metal-arrow">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                            <polyline points="12 5 19 12 12 19"></polyline>
                                        </svg>
                                    </div>
                                </motion.div>
                            </Link>
                        </motion.div>
                    ))}
                </motion.div>

                <motion.div
                    className="metals-footer-info"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: 0.5 }}
                >
                    <p>* More options coming soon including plastics and composites.</p>
                </motion.div>
            </div>
        </section>
    );
};

export default Metals;
