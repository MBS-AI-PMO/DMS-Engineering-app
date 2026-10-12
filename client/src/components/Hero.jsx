import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { fetchSettings } from '../utils/api';
import '../styles/HomeHero.css';

const HERO_DEFAULT = {
    avif: '/assets/hero-home.avif',
    webp: '/assets/hero-home.webp',
    jpg: '/assets/hero-home.jpg',
};

const normalizeHeroSetting = (value) => {
    if (!value) return null;

    if (typeof value === 'string') {
        const src = value.trim().replace(/^"(.*)"$/, '$1');
        return src ? { src } : null;
    }

    if (typeof value === 'object') {
        const pick = (key) => (typeof value?.[key] === 'string' ? value[key].trim() : '');
        const normalized = {
            avif: pick('avif'),
            webp: pick('webp'),
            jpg: pick('jpg') || pick('jpeg') || pick('png'),
            src: pick('src') || pick('url'),
        };
        if (normalized.avif || normalized.webp || normalized.jpg || normalized.src) {
            return normalized;
        }
    }

    return null;
};

const resolveHeroSources = (setting) => {
    const next = { ...HERO_DEFAULT };
    if (!setting) return next;

    if (setting.avif) next.avif = setting.avif;
    if (setting.webp) next.webp = setting.webp;
    if (setting.jpg) next.jpg = setting.jpg;

    if (!setting.avif && !setting.webp && !setting.jpg && setting.src) {
        const lower = setting.src.split('?')[0].toLowerCase();
        if (lower.endsWith('.avif')) next.avif = setting.src;
        else if (lower.endsWith('.webp')) next.webp = setting.src;
        else next.jpg = setting.src;
    }

    return next;
};

const Hero = () => {
    const [heroSources, setHeroSources] = useState(HERO_DEFAULT);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        let mounted = true;

        fetchSettings()
            .then((settings) => {
                if (!mounted) return;
                const normalized = normalizeHeroSetting(settings?.hero_image);
                if (!normalized) return;
                setHeroSources(resolveHeroSources(normalized));
            })
            .catch(() => {
                // Keep static fallback image when settings API is unavailable.
            });

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <section className="hero-section" style={{ backgroundColor: '#0b0b0f', position: 'relative', overflow: 'hidden' }}>
            <picture
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 0,
                }}
            >
                <source srcSet={heroSources.avif} type="image/avif" />
                <source srcSet={heroSources.webp} type="image/webp" />
                <img
                    src={heroSources.jpg || heroSources.webp || heroSources.avif}
                    sizes="100vw"
                    alt=""
                    aria-hidden="true"
                    fetchPriority="high"
                    loading="eager"
                    decoding="async"
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center',
                    }}
                />
            </picture>
            <div className="hero-overlay" style={{ position: 'absolute', inset: 0, zIndex: 1 }}></div>
            <div className="hero-content home-hero" style={{ position: 'relative', zIndex: 2 }}>
                <motion.h1
                    className="home-hero-title"
                    initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                >
                    <span className="home-hero-title-lead">Precision on demand.</span>{' '}
                    <span className="home-hero-title-rest">From raw material to finished part in 48&nbsp;hours.</span>
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
