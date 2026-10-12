import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { metalsData } from '../data/metalsData';
import { fetchMetals } from '../utils/api';
import { displayMetalName, displayThickness } from '../utils/metalDisplay';
import ThumbImage from './ThumbImage';
import '../styles/HomeMetals.css';

/**
 * Home page metals: the sheet stock as a list, one column per family
 * (aluminum, steel, ...), each metal a row with a small swatch of the
 * material, its name, and how many thicknesses it comes in.
 */

// The built-in picture for the same metal (ids differ between the two
// lists, names don't).
const staticImageFor = (metal) => {
    const name = metal.name?.toLowerCase();
    return metalsData.find(s => s.name?.toLowerCase() === name)?.image || '';
};

const groupByCategory = (metals) => {
    const groups = [];
    metals.forEach((metal) => {
        const name = metal.category || 'Metals';
        let group = groups.find(g => g.name === name);
        if (!group) {
            group = { name, items: [] };
            groups.push(group);
        }
        group.items.push(metal);
    });
    return groups;
};

const Metals = () => {
    const [metals, setMetals] = useState(metalsData);
    const [loading, setLoading] = useState(true);
    const reduceMotion = useReducedMotion();
    const metalCount = metals.length;
    const metalCountLabel = `${metalCount === 1 ? 'metal' : 'metals'} in stock`;
    const groups = groupByCategory(metals);
    const isSingle = groups.length === 1;

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
                    category: m.category_name || '',
                })));
            } catch (err) {
                console.warn('API unavailable, using static data:', err.message);
            } finally {
                setLoading(false);
            }
        }
        loadMetals();
    }, []);

    const reveal = (delay = 0) => (reduceMotion ? {} : {
        initial: { opacity: 0, y: 12 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-40px' },
        transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] },
    });

    return (
        <section id="metals" className="hm" aria-labelledby="hm-title">
            <div className="hm-inner">
                <motion.div className="hm-head" {...reveal()}>
                    <div className="hm-head-copy">
                        <h2 id="hm-title" className="hm-title">
                            {loading ? <span className="shimmer hm-sk-count" aria-hidden="true" /> : metalCount}
                            {' '}{metalCountLabel}
                        </h2>
                        <p className="hm-lede">Choose from our wide range of premium metals for your custom parts.</p>
                    </div>
                    <Link to="/metals" className="hm-all">
                        All metals
                        <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                </motion.div>

                {loading ? (
                    <div className="hm-groups" aria-hidden="true">
                        {[0, 1, 2].map(col => (
                            <div key={col} className="hm-group">
                                <span className="shimmer hm-sk-head" />
                                {[0, 1, 2].map(row => (
                                    <span key={row} className="hm-sk-row">
                                        <span className="shimmer hm-swatch" />
                                        <span className="hm-sk-lines">
                                            <span className="shimmer hm-sk-line" />
                                            <span className="shimmer hm-sk-line is-short" />
                                        </span>
                                    </span>
                                ))}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={`hm-groups${isSingle ? ' is-single' : ''}`}>
                        {groups.map((group, groupIndex) => (
                            <motion.div key={group.name} className="hm-group" {...reveal(Math.min(groupIndex, 4) * 0.06)}>
                                {!isSingle && (
                                    <h3 className="hm-group-name">
                                        {group.name}
                                        <span className="hm-group-count">{group.items.length}</span>
                                    </h3>
                                )}
                                <ul className="hm-list">
                                    {group.items.map(metal => (
                                        <li key={metal.id} className="hm-item">
                                            <Link to={`/metal/${metal.slug || metal.id}`} className="hm-row">
                                                <ThumbImage
                                                    key={metal.image}
                                                    className="hm-swatch"
                                                    src={metal.image}
                                                    fallback={staticImageFor(metal)}
                                                />
                                                <span className="hm-text">
                                                    <span className="hm-name">{displayMetalName(metal.name)}</span>
                                                    {metal.thickness && <span className="hm-spec">{displayThickness(metal.thickness)}</span>}
                                                </span>
                                                <ArrowRight size={16} className="hm-arrow" aria-hidden="true" />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                        ))}
                    </div>
                )}

                <p className="hm-note">More options coming soon, including plastics and composites.</p>
            </div>
        </section>
    );
};

export default Metals;
