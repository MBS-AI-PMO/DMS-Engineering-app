import React from 'react';
import { Link } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';

const Hero = () => {
    const heroBgUrl = "https://upload.wikimedia.org/wikipedia/commons/8/8e/INDO-MIM_Automotive_Sector_.jpg";

    return (
        <section className="hero-section" style={{ backgroundImage: `url(${heroBgUrl})` }}>
            <div className="hero-overlay"></div>
            <div className="hero-content">
                <motion.h1
                    className="hero-title"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                >
                    Precision on demand.
                    From raw material to finished part in 48 hours.
                </motion.h1>

                <motion.p
                    className="hero-subtitle"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                >
                    Sheet metal, CNC, and beyond.
                </motion.p>

                <motion.div
                    className="hero-actions"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                >
                    <Link to="/get-instant-pricing" className="btn-hero-primary" style={{ textDecoration: 'none', display: 'inline-flex' }}>
                        BUILD NOW <span className="btn-icon">🚀</span>
                    </Link>
                </motion.div>
            </div>
        </section>
    );
};

export default Hero;
