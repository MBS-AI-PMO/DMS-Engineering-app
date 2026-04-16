import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { fetchSettings } from '../utils/api';

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
