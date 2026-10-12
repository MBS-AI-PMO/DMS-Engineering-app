import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { ArrowRight, Check } from 'lucide-react';
import {
    fetchServiceBySlug,
    fetchServices,
    fetchMetalsByServiceId,
    fetchAllHardwareWithItems,
    fetchMetals,
    fetchHardwareTypes,
    fetchHardwareItemsByType,
    fetchGuideline,
} from '../utils/api';
import { metalsData } from '../data/metalsData';
import { servicesData } from '../data/servicesData';
import { displayMetalName, displayThickness } from '../utils/metalDisplay';
import ThumbImage from '../components/ThumbImage';
import serviceHeroBg from '../assets/services/service-hero-bg.webp';
// Not used by this page any more, but other pages lean on its global rules
// (.detail-breadcrumb on metal pages, .stat-label in admin, .large on
// Orders), so it stays loaded exactly as before.
import './ServiceDetail.css';
import '../styles/Shimmer.css';
import '../styles/ServiceDetailPage.css';

/**
 * One service (/service/:slug): a heading band over the service's own hero
 * picture (set in admin) with its size limits, then what can be chosen for
 * it (thread sizes, countersink profiles, colours, hardware), what to check
 * before ordering, the metals it works with and the other services. The
 * footer's band leads on to instant pricing. Data shimmers until loaded.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const BACKEND_URL = (() => {
    const explicit = String(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
    if (explicit) return explicit;
    const fromApiBase = String(API_BASE_URL || '');
    if (/^https?:\/\//i.test(fromApiBase)) {
        return fromApiBase.replace(/\/api\/?$/, '').replace(/\/+$/, '');
    }
    return '';
})();

const toBackendAssetUrl = (value) => {
    if (!value) return '';
    const raw = String(value).trim();
    if (!raw) return '';
    if (/^(?:https?:)?\/\//i.test(raw) || raw.startsWith('blob:') || raw.startsWith('data:')) return raw;
    const cleaned = raw.replace(/^\/+/, '');
    return BACKEND_URL ? `${BACKEND_URL}/${cleaned}` : `/${cleaned}`;
};

// The admin hero picture: a path, or { avif, webp, jpg, src }.
const heroSourcesOf = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
        const src = value.trim().replace(/^"(.*)"$/, '$1');
        return src ? { avif: '', webp: '', jpg: src } : null;
    }
    if (typeof value === 'object') {
        const jpg = value.jpg || value.jpeg || value.png || value.src || value.url || '';
        const webp = value.webp || '';
        const avif = value.avif || '';
        return jpg || webp || avif ? { avif, webp, jpg: jpg || webp || avif } : null;
    }
    return null;
};

const parseOptions = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string' && raw.trim()) {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
};

const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};
// 0.25 -> '.25"', 120 -> '120"', 5.0013 mm -> '5 mm'
const size = (value, unit) => {
    const n = num(value);
    if (n === null || n <= 0) return null;
    if (unit === 'mm') return `${Math.round(n)} mm`;
    const text = String(Number(n.toFixed(3)));
    return `${text.replace(/^0(?=\.)/, '')}"`;
};
const inch = (value) => {
    const n = num(value);
    return n === null ? '—' : `${n.toFixed(3).replace(/^0(?=\.)/, '')}"`;
};
const money = (value) => {
    const n = num(value);
    return n === null ? '—' : `$${n.toFixed(2)}`;
};

// Powder coat / anodize finish words from the stored gloss number.
const finishOf = (option) => {
    if (option.is_wrinkled) return 'Wrinkle';
    const gloss = num(option.gloss);
    if (gloss === null) return null;
    if (gloss >= 80) return 'Gloss';
    if (gloss <= 25) return 'Matte';
    return 'Satin';
};

const staticServiceImage = (service) => servicesData.find(s => s.id === service.id)?.image || '';
const staticMetalImage = (metal) => {
    const name = metal.name?.toLowerCase();
    return metalsData.find(s => s.name?.toLowerCase() === name)?.image || '';
};

const ServiceDetail = () => {
    const { slug } = useParams();
    const reduceMotion = useReducedMotion();
    const [service, setService] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [metals, setMetals] = useState(null);       // null = loading
    const [hardware, setHardware] = useState(null);   // null = loading or not hardware
    const [guideline, setGuideline] = useState(null); // null = loading or none
    const [guidelineDone, setGuidelineDone] = useState(false);
    const [others, setOthers] = useState([]);
    const [hwType, setHwType] = useState(null);
    const [heroFailed, setHeroFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setNotFound(false);
        setService(null);
        setMetals(null);
        setHardware(null);
        setGuideline(null);
        setGuidelineDone(false);
        setHwType(null);
        setHeroFailed(false);
        window.scrollTo(0, 0);

        (async () => {
            let svc;
            try {
                svc = await fetchServiceBySlug(slug);
            } catch (err) {
                console.error('Failed to load service detail:', err);
            }
            if (cancelled) return;
            if (!svc) {
                setNotFound(true);
                setLoading(false);
                return;
            }
            setService(svc);
            setLoading(false);

            const isHw = /hardware/i.test(svc.title || '');

            // Hardware works with every metal; other services list theirs.
            (isHw ? fetchMetals() : fetchMetalsByServiceId(svc.id))
                .then(list => { if (!cancelled) setMetals(Array.isArray(list) ? list : []); })
                .catch(() => { if (!cancelled) setMetals([]); });

            fetchGuideline(svc.id)
                .then(g => { if (!cancelled) setGuideline(g || null); })
                .catch(() => {})
                .finally(() => { if (!cancelled) setGuidelineDone(true); });

            fetchServices()
                .then(list => { if (!cancelled) setOthers((list || []).filter(s => s.id !== svc.id)); })
                .catch(() => {});

            if (isHw) {
                let groups = [];
                try {
                    groups = await fetchAllHardwareWithItems();
                    if (!Array.isArray(groups) || groups.length === 0) throw new Error('empty');
                } catch {
                    try {
                        const typesRes = await fetchHardwareTypes();
                        const types = (typesRes?.data || []).filter(t => !t.name?.toLowerCase().includes('countersink'));
                        groups = await Promise.all(types.map(async (t) => {
                            try {
                                const items = await fetchHardwareItemsByType(t.id);
                                return { ...t, items: Array.isArray(items) ? items : [] };
                            } catch {
                                return { ...t, items: [] };
                            }
                        }));
                    } catch (e2) {
                        console.warn('Could not load hardware items:', e2);
                        groups = [];
                    }
                }
                if (!cancelled) setHardware(groups.filter(g => (g.items || []).length > 0));
            }
        })();

        return () => { cancelled = true; };
    }, [slug]);

    const options = useMemo(() => parseOptions(service?.service_options), [service]);
    const title = service?.title || '';
    const kind = /tap/i.test(title) ? 'tap'
        : /countersink/i.test(title) ? 'sink'
            : /hardware/i.test(title) ? 'hardware'
                : options.some(o => o && typeof o === 'object' && o.color) ? 'colour'
                    : options.length ? 'list' : null;

    const unit = service?.dimensions_unit === 'mm' ? 'mm' : 'in';
    const facts = useMemo(() => {
        if (!service) return [];
        const list = [];
        const minL = size(service.min_length, unit);
        const maxL = size(service.max_length, unit);
        const minW = size(service.min_width, unit);
        const maxW = size(service.max_width, unit);
        const minH = size(service.min_height, unit);
        const maxH = size(service.max_height, unit);
        if (maxL && maxW) list.push({ label: 'Largest part', value: `${maxL} × ${maxW}` });
        if (minL && minW) list.push({ label: 'Smallest part', value: `${minL} × ${minW}` });
        if (minH && maxH) list.push({ label: unit === 'mm' ? 'Stock height' : 'Thickness', value: `${minH} – ${maxH}` });
        return list;
    }, [service, unit]);

    const activeHw = hardware?.find(g => g.id === hwType) || hardware?.[0];
    const optionCount = kind === 'hardware' ? (hardware || []).reduce((n, g) => n + g.items.length, 0) : options.length;
    const optionWord = { tap: 'thread sizes', sink: 'countersink profiles', hardware: 'hardware parts', colour: 'colours', list: 'options' }[kind];

    const reveal = (delay = 0) => (reduceMotion ? {} : {
        initial: { opacity: 0, y: 12 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-40px' },
        transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] },
    });

    const hero = heroFailed ? null : heroSourcesOf(service?.hero_image);

    if (notFound) {
        return (
            <div className="sd">
                <section className="sd-hero is-plain">
                    <div className="sd-inner sd-hero-content">
                        <nav className="sd-crumbs" aria-label="Breadcrumb">
                            <Link to="/">Home</Link><span aria-hidden="true">/</span>
                            <Link to="/services">Services</Link>
                        </nav>
                        <h1 className="sd-title">Service not found</h1>
                        <p className="sd-lede">This service may have been renamed or removed.</p>
                        <div className="sd-hero-actions">
                            <Link to="/services" className="sd-btn is-primary">See all services <ArrowRight size={16} aria-hidden="true" /></Link>
                        </div>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className="sd">
            {/* ── Heading band ── */}
            <section className="sd-hero" aria-labelledby="sd-title">
                <picture className="sd-hero-pic" aria-hidden="true">
                    {hero?.avif && <source srcSet={hero.avif} type="image/avif" />}
                    {hero?.webp && <source srcSet={hero.webp} type="image/webp" />}
                    <img
                        key={hero ? hero.jpg : 'default'}
                        className="sd-hero-img"
                        src={hero ? hero.jpg : serviceHeroBg}
                        alt=""
                        loading="eager"
                        fetchPriority="high"
                        decoding="async"
                        onError={() => { if (hero) setHeroFailed(true); }}
                    />
                </picture>
                <div className="sd-hero-shade" aria-hidden="true" />
                <div className="sd-inner sd-hero-content">
                    <nav className="sd-crumbs" aria-label="Breadcrumb">
                        <Link to="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <Link to="/services">Services</Link>
                        <span aria-hidden="true">/</span>
                        {loading ? <span className="shimmer sd-sk-crumb" aria-hidden="true" /> : <span aria-current="page">{title}</span>}
                    </nav>

                    {loading ? (
                        <div aria-hidden="true">
                            <span className="shimmer sd-sk-title" />
                            <span className="shimmer sd-sk-lede" />
                            <span className="shimmer sd-sk-lede is-short" />
                        </div>
                    ) : (
                        <>
                            <h1 id="sd-title" className="sd-title">{title}</h1>
                            {service.description && <p className="sd-lede">{service.description}</p>}
                        </>
                    )}

                    {loading ? (
                        <div className="sd-facts" aria-hidden="true">
                            {[0, 1].map(i => (
                                <div key={i} className="sd-fact">
                                    <span className="shimmer sd-sk-fact-label" />
                                    <span className="shimmer sd-sk-fact" />
                                </div>
                            ))}
                        </div>
                    ) : (facts.length > 0 || optionCount > 0 || (metals && metals.length > 0)) && (
                        <dl className="sd-facts">
                            {facts.map(f => (
                                <div key={f.label} className="sd-fact">
                                    <dt>{f.label}</dt>
                                    <dd>{f.value}</dd>
                                </div>
                            ))}
                            {metals && metals.length > 0 && (
                                <div className="sd-fact">
                                    <dt>Metals</dt>
                                    <dd>{metals.length}</dd>
                                </div>
                            )}
                            {optionCount > 0 && (
                                <div className="sd-fact">
                                    <dt>{optionWord.charAt(0).toUpperCase() + optionWord.slice(1)}</dt>
                                    <dd>{optionCount}</dd>
                                </div>
                            )}
                        </dl>
                    )}

                    <div className="sd-hero-actions">
                        <Link to="/get-instant-pricing" className="sd-btn is-primary">
                            Get instant pricing
                            <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                        {!loading && guideline && (
                            <Link to={`/guidelines?service=${encodeURIComponent(service.id)}`} className="sd-hero-link">Design guidelines</Link>
                        )}
                    </div>
                </div>
            </section>

            {/* ── Body ── */}
            <div className="sd-body">
                <div className="sd-inner sd-stack">
                    {loading ? (
                        <section className="sd-panel" aria-hidden="true">
                            <span className="shimmer sd-sk-h2" />
                            <span className="sd-sk-table">
                                {[0, 1, 2, 3, 4].map(r => (
                                    <span key={r} className={`sd-sk-row${r === 0 ? ' is-head' : ''}`}>
                                        {[0, 1, 2, 3].map(c => <span key={c} className="shimmer sd-sk-cell" />)}
                                    </span>
                                ))}
                            </span>
                        </section>
                    ) : (
                        <>
                            {/* What can be chosen */}
                            {kind && (kind !== 'hardware' || hardware === null || hardware.length > 0) && (
                                <motion.section className="sd-panel" aria-labelledby="sd-options" {...reveal()}>
                                    <div className="sd-panel-head">
                                        <h2 id="sd-options" className="sd-h2">
                                            {kind === 'tap' && 'Thread sizes'}
                                            {kind === 'sink' && 'Countersink profiles'}
                                            {kind === 'hardware' && 'Hardware we install'}
                                            {kind === 'colour' && 'Colours'}
                                            {kind === 'list' && 'Options'}
                                        </h2>
                                        {optionCount > 0 && <span className="sd-panel-count">{optionCount} {optionWord}</span>}
                                    </div>

                                    {kind === 'tap' && (
                                        <div className="sd-table-wrap" tabIndex={0} aria-label="Thread sizes">
                                            <table className="sd-table">
                                                <thead>
                                                    <tr>
                                                        <th scope="col">Thread</th>
                                                        <th scope="col">Hole size</th>
                                                        <th scope="col">Max depth</th>
                                                        <th scope="col" className="is-num">Price</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {options.map((opt, i) => (
                                                        <tr key={`${opt.name}-${i}`}>
                                                            <th scope="row">{opt.name}</th>
                                                            <td>{inch(opt.min_diameter)} – {inch(opt.max_diameter)}</td>
                                                            <td>{opt.max_depth ? inch(opt.max_depth) : '—'}</td>
                                                            <td className="is-num">{money(opt.price)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {kind === 'sink' && (
                                        <div className="sd-table-wrap" tabIndex={0} aria-label="Countersink profiles">
                                            <table className="sd-table">
                                                <thead>
                                                    <tr>
                                                        <th scope="col">Profile</th>
                                                        <th scope="col">Angle</th>
                                                        <th scope="col">Major Ø</th>
                                                        <th scope="col">Minor Ø</th>
                                                        <th scope="col" className="is-num">Price</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {options.map((opt, i) => (
                                                        <tr key={`${opt.name}-${i}`}>
                                                            <th scope="row">{opt.name}</th>
                                                            <td>{opt.angle ? `${opt.angle}°` : '—'}</td>
                                                            <td>{inch(opt.major_dia)}</td>
                                                            <td>{inch(opt.minor_dia)}</td>
                                                            <td className="is-num">{money(opt.price)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {kind === 'hardware' && (hardware === null ? (
                                        <span className="sd-sk-table" aria-hidden="true">
                                            {[0, 1, 2, 3].map(r => (
                                                <span key={r} className={`sd-sk-row${r === 0 ? ' is-head' : ''}`}>
                                                    {[0, 1, 2, 3].map(c => <span key={c} className="shimmer sd-sk-cell" />)}
                                                </span>
                                            ))}
                                        </span>
                                    ) : (
                                        <>
                                            <div className="sd-chips" role="group" aria-label="Hardware type">
                                                {hardware.map(g => {
                                                    const active = activeHw?.id === g.id;
                                                    return (
                                                        <button
                                                            key={g.id}
                                                            type="button"
                                                            className={`sd-chip${active ? ' is-active' : ''}`}
                                                            aria-pressed={active}
                                                            onClick={() => setHwType(g.id)}
                                                        >
                                                            {g.name}
                                                            <span className="sd-chip-count">{g.items.length}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {activeHw && (
                                                <div className="sd-table-wrap" tabIndex={0} aria-label={`${activeHw.name} sizes`}>
                                                    <table className="sd-table">
                                                        <thead>
                                                            <tr>
                                                                <th scope="col">Part</th>
                                                                <th scope="col">Thread</th>
                                                                <th scope="col">Length</th>
                                                                <th scope="col">Edge distance</th>
                                                                <th scope="col" className="is-num">Price</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {activeHw.items.map(item => (
                                                                <tr key={item.id}>
                                                                    <th scope="row">{item.name || '—'}</th>
                                                                    <td>{item.size_spec || '—'}</td>
                                                                    <td>{item.length ? inch(item.length) : '—'}</td>
                                                                    <td>{item.min_edge_distance ? inch(item.min_edge_distance) : '—'}</td>
                                                                    <td className="is-num">{money(item.price)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </>
                                    ))}

                                    {kind === 'colour' && (
                                        <ul className="sd-colours">
                                            {options.map((opt, i) => {
                                                const finish = finishOf(opt);
                                                const price = num(opt.price);
                                                return (
                                                    <li key={`${opt.name}-${i}`} className="sd-colour">
                                                        <span
                                                            className={`sd-swatch${opt.is_wrinkled ? ' is-wrinkle' : ''}`}
                                                            style={{ backgroundColor: opt.color || '#d1d5db' }}
                                                            aria-hidden="true"
                                                        />
                                                        <span className="sd-colour-text">
                                                            <span className="sd-colour-name">{opt.name}</span>
                                                            {(finish || price > 0) && (
                                                                <span className="sd-colour-meta">
                                                                    {[finish, price > 0 ? money(price) : null].filter(Boolean).join(' · ')}
                                                                </span>
                                                            )}
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}

                                    {kind === 'list' && (
                                        <ul className="sd-option-list">
                                            {options.map((opt, i) => (
                                                <li key={i}>{typeof opt === 'string' ? opt : opt.name}</li>
                                            ))}
                                        </ul>
                                    )}
                                </motion.section>
                            )}

                            {/* Before you order */}
                            {!guidelineDone ? (
                                <section className="sd-panel" aria-hidden="true">
                                    <span className="shimmer sd-sk-h2" />
                                    <span className="sd-sk-checks">
                                        {[0, 1, 2, 3].map(i => <span key={i} className="shimmer sd-sk-line" />)}
                                    </span>
                                </section>
                            ) : guideline && ((guideline.requirements || []).length > 0 || (guideline.tables || []).length > 0) && (
                                <motion.section className="sd-panel" aria-labelledby="sd-before" {...reveal()}>
                                    <div className="sd-panel-head">
                                        <h2 id="sd-before" className="sd-h2">Before you order</h2>
                                        <Link to={`/guidelines?service=${encodeURIComponent(service.id)}`} className="sd-link">
                                            {(guideline.tables || []).length > 0 ? 'Size limits by material' : 'Design guidelines'}
                                            <ArrowRight size={15} aria-hidden="true" />
                                        </Link>
                                    </div>
                                    {(guideline.requirements || []).length > 0 ? (
                                        <ul className="sd-checks">
                                            {guideline.requirements.map((req, i) => (
                                                <li key={i}>
                                                    <span className="sd-check" aria-hidden="true"><Check size={13} /></span>
                                                    <span>{req}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="sd-muted">
                                            Smallest and largest part sizes for {title.toLowerCase()} are listed for each material and thickness.
                                        </p>
                                    )}
                                </motion.section>
                            )}

                            {/* Metals */}
                            <motion.section className="sd-panel" aria-labelledby="sd-metals" {...reveal()}>
                                <div className="sd-panel-head">
                                    <h2 id="sd-metals" className="sd-h2">Metals</h2>
                                    {metals && metals.length > 0 && (
                                        <span className="sd-panel-count">Works with {metals.length} {metals.length === 1 ? 'metal' : 'metals'}</span>
                                    )}
                                </div>
                                {metals === null ? (
                                    <ul className="sd-metals" aria-hidden="true">
                                        {[0, 1, 2, 3, 4, 5].map(i => (
                                            <li key={i} className="sd-metal is-skeleton">
                                                <span className="shimmer sd-metal-swatch" />
                                                <span className="sd-metal-text">
                                                    <span className="shimmer sd-sk-line is-name" />
                                                    <span className="shimmer sd-sk-line is-short" />
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : metals.length > 0 ? (
                                    <ul className="sd-metals">
                                        {metals.map(metal => (
                                            <li key={metal.id}>
                                                <Link to={`/metal/${metal.slug || metal.id}`} className="sd-metal">
                                                    <ThumbImage
                                                        key={metal.image_path}
                                                        className="sd-metal-swatch"
                                                        src={toBackendAssetUrl(metal.image_path)}
                                                        fallback={staticMetalImage(metal)}
                                                    />
                                                    <span className="sd-metal-text">
                                                        {metal.category_name && <span className="sd-metal-family">{metal.category_name}</span>}
                                                        <span className="sd-metal-name">{displayMetalName(metal.name)}</span>
                                                        {metal.thickness && <span className="sd-metal-spec">{displayThickness(metal.thickness)}</span>}
                                                    </span>
                                                    <ArrowRight size={16} className="sd-metal-arrow" aria-hidden="true" />
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="sd-muted">
                                        No metals are linked to this service yet. <Link to="/contact" className="sd-inline-link">Ask us</Link> about the material you need.
                                    </p>
                                )}
                            </motion.section>

                            {/* Other services */}
                            {others.length > 0 && (
                                <motion.section className="sd-others" aria-labelledby="sd-others" {...reveal()}>
                                    <h2 id="sd-others" className="sd-h2">Other services</h2>
                                    <ul className="sd-other-list">
                                        {others.map(other => (
                                            <li key={other.id}>
                                                <Link to={`/service/${other.slug || other.id}`} className="sd-other">
                                                    <ThumbImage
                                                        key={other.image_path}
                                                        className="sd-other-media"
                                                        src={toBackendAssetUrl(other.image_path)}
                                                        fallback={staticServiceImage(other)}
                                                    />
                                                    <span>{other.title}</span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </motion.section>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ServiceDetail;
