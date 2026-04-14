import React from 'react';
import { Link } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';

const HERO_BASE = "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/INDO-MIM_Automotive_Sector_.jpg";
const HERO_SRC = `${HERO_BASE}/1600px-INDO-MIM_Automotive_Sector_.jpg`;
const HERO_SRCSET = [
    `${HERO_BASE}/800px-INDO-MIM_Automotive_Sector_.jpg 800w`,
    `${HERO_BASE}/1200px-INDO-MIM_Automotive_Sector_.jpg 1200w`,
    `${HERO_BASE}/1600px-INDO-MIM_Automotive_Sector_.jpg 1600w`,
    `${HERO_BASE}/2000px-INDO-MIM_Automotive_Sector_.jpg 2000w`,
].join(', ');

const Hero = () => {
    return (
        <section className="hero-section" style={{ backgroundColor: '#0b0b0f', position: 'relative', overflow: 'hidden' }}>
            <img
                src={HERO_SRC}
                srcSet={HERO_SRCSET}
                sizes="100vw"
                alt=""
                aria-hidden="true"
                fetchpriority="high"
                loading="eager"
                decoding="async"
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                    zIndex: 0,
                }}
            />
            <div className="hero-overlay" style={{ position: 'absolute', inset: 0, zIndex: 1 }}></div>
            <div className="hero-content" style={{ position: 'relative', zIndex: 2 }}>
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
