import React from 'react';
import { Link } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import usePageHero from '../hooks/usePageHero';
import '../styles/HomeHero.css';

const Hero = () => {
    const hero = usePageHero('home');
    const reduceMotion = useReducedMotion();

    return (
        <section className="hero-section" style={{ backgroundColor: '#0b0b0f', position: 'relative', overflow: 'hidden' }}>
            {hero.src && (
                <img
                    src={hero.src}
                    srcSet={hero.srcSet}
                    sizes="100vw"
                    alt=""
                    aria-hidden="true"
                    fetchPriority="high"
                    loading="eager"
                    decoding="async"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, objectFit: 'cover', objectPosition: 'center' }}
                />
            )}
            <div className="hero-overlay" style={{ position: 'absolute', inset: 0, zIndex: 1 }}></div>
            <div className="hero-content home-hero" style={{ position: 'relative', zIndex: 2 }}>
                <motion.h1
                    className="home-hero-title"
                    initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                >
                    <span className="home-hero-title-lead">Precision on demand.</span>{' '}
                    <span className="home-hero-title-rest">From raw material to finished part in <span style={{ whiteSpace: 'nowrap' }}>2–4 business days.</span></span>
                </motion.h1>

                <motion.p
                    className="home-hero-lede"
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
                >
                    <span>Sheet metal</span>
                    <span className="home-hero-dot" aria-hidden="true" />
                    <span>CNC</span>
                    <span className="home-hero-dot" aria-hidden="true" />
                    <span>and beyond</span>
                </motion.p>

                <motion.div
                    className="home-hero-actions"
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
                >
                    <Link to="/get-instant-pricing" className="home-hero-cta">
                        Build now
                        <ArrowRight size={18} aria-hidden="true" />
                    </Link>
                </motion.div>
            </div>
        </section>
    );
};

export default Hero;
