import React, { useState, useEffect, useMemo, useRef, useId } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { ArrowRight, Check, Plus } from 'lucide-react';
import { metalsData } from '../data/metalsData';
import { servicesData } from '../data/servicesData';
import metalHeroBg from '../assets/metals/metal-hero-bg.webp';
import { fetchMetalBySlug, fetchMetalServices } from '../utils/api';
import { displayMetalName } from '../utils/metalDisplay';
import ThumbImage from './ThumbImage';
import Dropdown from './Dropdown';
import '../styles/Shimmer.css';
import '../styles/MetalDetailPage.css';

/**
 * One metal (/metal/:slug). Everything on it comes from admin: a heading
 * band with the metal's name, swatch and key numbers; a bar of section
 * links that stays at the top; then part sizes and thicknesses, every spec
 * table stored for the picked thickness (inch or mm), the services, the
 * "about" text with its feature chart, FAQs, and any custom fields admin
 * added, each under the section it was filed for. Shimmers until loaded.
 */

// Spec tables stored per thickness, in the order they read best.
const SPEC_TITLES = {
    generalDetails: 'General details',
    laserCuttingSpecs: 'Laser cutting',
    bendingSpecs: 'Bending',
    countersinkSpecs: 'Countersinking',
    tappingSpecs: 'Tapping',
    hardwareSpecs: 'Hardware',
    dimpleSpecs: 'Dimple forming',
    deburringSpecs: 'Deburring',
    tumbleSpecs: 'Tumbling',
    anodizingSpecs: 'Anodizing',
    powderCoatingSpecs: 'Powder coating',
    platingSpecs: 'Plating',
};
const NOT_SPEC_TABLES = new Set(['availableServices', 'available_services', 'showcaseImages', 'properties']);
const humanize = (key) => {
    const words = key.replace(/Specs?$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim().toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
};

// Some stored text was saved twice-encoded ("â€“" for "–"); show it right.
const MOJIBAKE = [
    ['â€“', '–'], ['â€”', '—'], ['â€™', '’'], ['â€˜', '‘'], ['â€œ', '“'], ['â€\u009d', '”'],
    ['â€¦', '…'], ['Â°', '°'], ['Â±', '±'], ['Âµ', 'µ'], ['Â²', '²'], ['Â³', '³'], ['Â ', ' '],
];
const clean = (value) => {
    if (value == null) return '';
    let text = String(value);
    if (!/[âÂ]/.test(text)) return text;
    MOJIBAKE.forEach(([bad, good]) => { text = text.split(bad).join(good); });
    return text;
};

// '+/- .005"' -> '±.005"'
const tolerance = (value) => clean(value).replace(/^\s*\+\/-\s*/, '±');

const inches = (text) => {
    const out = [];
    for (const m of String(text || '').matchAll(/(\d*\.\d+|\d+(?:\.\d+)?)/g)) {
        const n = Number(m[1]);
        if (Number.isFinite(n)) out.push(n);
    }
    return out;
};
const fmtInch = (n) => `${String(Number(n.toFixed(4))).replace(/^0(?=\.)/, '')}"`;

const SECTION_FOR_TAB = { 'Quick Look': 'overview', Specifications: 'specs', About: 'about', Services: 'services', FAQS: 'faqs' };

const staticSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

// A small outline of a part size, scaled against the largest one shown.
const SizeShape = ({ w, h, max }) => {
    const box = 40;
    const scale = max > 0 ? box / max : 1;
    const sw = Math.max(6, Math.min(box, w * scale));
    const sh = Math.max(6, Math.min(box, h * scale));
    return (
        <span className="md-size-shape" aria-hidden="true">
            <span style={{ width: sw, height: sh }} />
        </span>
    );
};

const FaqList = ({ items }) => {
    const [open, setOpen] = useState(null);
    const baseId = useId();
    return (
        <ul className="md-faqs">
            {items.map((faq, i) => {
                const isOpen = open === i;
                return (
                    <li key={i} className={`md-faq${isOpen ? ' is-open' : ''}`}>
                        <h3 className="md-faq-q">
                            <button
                                type="button"
                                id={`${baseId}-q${i}`}
                                aria-expanded={isOpen}
                                aria-controls={`${baseId}-a${i}`}
                                onClick={() => setOpen(isOpen ? null : i)}
                            >
                                <span>{clean(faq.question)}</span>
                                <span className="md-faq-icon" aria-hidden="true"><Plus size={16} /></span>
                            </button>
                        </h3>
                        <div id={`${baseId}-a${i}`} className="md-faq-a" role="region" aria-labelledby={`${baseId}-q${i}`} inert={!isOpen}>
                            <div><p>{clean(faq.answer)}</p></div>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
};

const CustomFields = ({ fields }) => (fields.length > 0 ? (
    <dl className="md-custom">
        {fields.map((f, i) => (
            <div key={i}>
                <dt>{clean(f.label)}</dt>
                <dd>{clean(f.value)}</dd>
            </div>
        ))}
    </dl>
) : null);

const MetalDetail = () => {
    const { slug, id } = useParams();
    const reduceMotion = useReducedMotion();
    const [metal, setMetal] = useState(null);
    const [loading, setLoading] = useState(true);
    const [resolvedServices, setResolvedServices] = useState(null);
    const [unit, setUnit] = useState('in');
    const [thicknessIndex, setThicknessIndex] = useState(0);
    const [activeSection, setActiveSection] = useState('overview');
    const specsRef = useRef(null);
    const lookupSlug = slug || id;

    // A different metal: start over (adjusted during render, as React
    // recommends for state that follows a value).
    const [seenSlug, setSeenSlug] = useState(lookupSlug);
    if (seenSlug !== lookupSlug) {
        setSeenSlug(lookupSlug);
        setLoading(true);
        setMetal(null);
        setResolvedServices(null);
        setThicknessIndex(0);
        setActiveSection('overview');
    }

    useEffect(() => {
        let cancelled = false;
        window.scrollTo(0, 0);

        (async () => {
            try {
                const data = await fetchMetalBySlug(lookupSlug);
                if (cancelled) return;
                setMetal({
                    id: data.id,
                    slug: data.slug,
                    name: data.name,
                    thickness: data.thickness,
                    image: data.image_path,
                    description: data.description,
                    quickLook: data.quick_look,
                    specifications: data.specifications,
                    thicknessSpecs: data.thickness_specs,
                    aboutSection: data.about_section,
                    faqs: data.faqs,
                    services: data.services,
                    category: data.category_name,
                    customFields: data.custom_fields,
                });
                setLoading(false);
                fetchMetalServices(lookupSlug)
                    .then(svc => { if (!cancelled) setResolvedServices(svc || { metalLevel: [], thicknessLevel: [] }); })
                    .catch(() => { if (!cancelled) setResolvedServices({ metalLevel: [], thicknessLevel: [] }); });
            } catch (err) {
                if (cancelled) return;
                console.warn('API fetch failed, using static data fallback:', err.message);
                let found = metalsData.find(m => staticSlug(m.name) === lookupSlug);
                if (!found && !Number.isNaN(Number(lookupSlug))) found = metalsData.find(m => m.id === Number(lookupSlug));
                setMetal(found || null);
                setResolvedServices({ metalLevel: [], thicknessLevel: [] });
                setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [lookupSlug]);

    const quickLook = useMemo(() => metal?.quickLook || {}, [metal]);
    const thicknesses = useMemo(() => (Array.isArray(quickLook.thicknesses) ? quickLook.thicknesses : []), [quickLook]);
    const cutSizes = useMemo(() => (Array.isArray(quickLook.cutSizes) ? quickLook.cutSizes : []), [quickLook]);
    const current = thicknesses[Math.min(thicknessIndex, Math.max(thicknesses.length - 1, 0))];
    const currentValue = current?.value;
    const specs = useMemo(() => ({
        ...(metal?.specifications || {}),
        ...((currentValue && metal?.thicknessSpecs?.[currentValue]) || {}),
    }), [metal, currentValue]);

    const specGroups = useMemo(() => {
        const order = Object.keys(SPEC_TITLES);
        return Object.entries(specs)
            .filter(([key, rows]) => !NOT_SPEC_TABLES.has(key) && Array.isArray(rows) && rows.some(r => r && typeof r === 'object' && r.label))
            .sort(([a], [b]) => {
                const ia = order.indexOf(a);
                const ib = order.indexOf(b);
                return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
            })
            .map(([key, rows]) => ({ key, title: SPEC_TITLES[key] || humanize(key), rows: rows.filter(r => r && r.label) }));
    }, [specs]);
    const properties = Array.isArray(specs.properties) ? specs.properties.filter(p => p && p.label) : [];
    const showcase = Array.isArray(specs.showcaseImages) ? specs.showcaseImages.filter(Boolean) : [];

    const valueOf = (row) => clean(unit === 'mm' ? (row.mm ?? row.value ?? row.inch) : (row.inch ?? row.value ?? row.mm)) || '—';

    // Services: metal-wide ones plus those that depend on thickness.
    const services = useMemo(() => {
        if (!resolvedServices) return null;
        const byId = new Map();
        (resolvedServices.metalLevel || []).forEach(s => byId.set(s.id, { ...s, count: 0, metalWide: true }));
        (resolvedServices.thicknessLevel || []).forEach(t => (t.services || []).forEach(s => {
            const entry = byId.get(s.id) || { ...s, count: 0, metalWide: false };
            entry.count += 1;
            byId.set(s.id, entry);
        }));
        if (byId.size === 0 && Array.isArray(metal?.services)) {
            metal.services.forEach(sid => {
                const s = servicesData.find(x => x.id === sid);
                if (s) byId.set(s.id, { ...s, image_path: '', count: 0, metalWide: true });
            });
        }
        return [...byId.values()];
    }, [resolvedServices, metal]);
    const thicknessServices = useMemo(() => {
        const level = (resolvedServices?.thicknessLevel || []).find(t => t.thickness === currentValue);
        if (level?.services?.length) return level.services.map(s => ({ id: s.id, title: s.title, slug: s.slug }));
        return (Array.isArray(specs.availableServices) ? specs.availableServices : []).map(name => ({ id: name, title: name }));
    }, [resolvedServices, currentValue, specs]);

    const customByTab = useMemo(() => {
        const groups = {};
        Object.values(metal?.customFields || {}).forEach(f => {
            if (!f || !f.label || !f.value) return;
            const section = SECTION_FOR_TAB[f.tab] || 'overview';
            (groups[section] = groups[section] || []).push(f);
        });
        return groups;
    }, [metal]);

    const about = metal?.aboutSection || null;
    const features = Array.isArray(about?.featureChart) ? about.featureChart : [];
    const faqs = Array.isArray(metal?.faqs) ? metal.faqs.filter(f => f && f.question) : [];

    const sections = [
        { id: 'overview', label: 'Overview', show: true },
        { id: 'specs', label: 'Specifications', show: specGroups.length > 0 || properties.length > 0 || !!customByTab.specs },
        { id: 'services', label: 'Services', show: services === null || services.length > 0 || !!customByTab.services },
        { id: 'about', label: 'About', show: !!about || !!customByTab.about },
        { id: 'faqs', label: 'FAQs', show: faqs.length > 0 || !!customByTab.faqs },
    ].filter(s => s.show);

    // Mark the section in view in the bar.
    useEffect(() => {
        if (loading || !metal) return undefined;
        const nodes = sections.map(s => document.getElementById(`md-${s.id}`)).filter(Boolean);
        if (!nodes.length || typeof IntersectionObserver === 'undefined') return undefined;
        const observer = new IntersectionObserver((entries) => {
            const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
            if (visible[0]) setActiveSection(visible[0].target.id.replace('md-', ''));
        }, { rootMargin: '-140px 0px -55% 0px' });
        nodes.forEach(n => observer.observe(n));
        return () => observer.disconnect();
    }, [loading, metal, sections.map(s => s.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

    const goTo = (sectionId) => {
        document.getElementById(`md-${sectionId}`)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    };
    const pickThickness = (index, scroll) => {
        setThicknessIndex(index);
        if (scroll) specsRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    };

    // Hero numbers.
    const facts = useMemo(() => {
        if (!metal) return [];
        const list = [];
        if (thicknesses.length) {
            list.push({ label: 'Thicknesses', value: thicknesses.length });
            const values = thicknesses.flatMap(t => inches(t.value));
            if (values.length) {
                const lo = Math.min(...values);
                const hi = Math.max(...values);
                list.push({ label: 'Range', value: lo === hi ? fmtInch(lo) : `${fmtInch(lo)} – ${fmtInch(hi)}` });
            }
        }
        if (quickLook.tolerance) list.push({ label: 'Cut tolerance', value: tolerance(quickLook.tolerance) });
        const largest = cutSizes.find(c => /instant/i.test(c.action || '') && /max/i.test(c.size || ''));
        if (largest) list.push({ label: 'Largest instant-price part', value: clean(largest.size).replace(/\s*max\s*$/i, '') });
        return list;
    }, [metal, thicknesses, quickLook.tolerance, cutSizes]);

    const reveal = (delay = 0) => (reduceMotion ? {} : {
        initial: { opacity: 0, y: 12 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-40px' },
        transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] },
    });

    const staticImage = (() => {
        const name = metal?.name?.toLowerCase();
        return metalsData.find(s => s.name?.toLowerCase() === name)?.image || '';
    })();
    const maxCut = Math.max(0, ...cutSizes.flatMap(c => inches(c.size).slice(0, 2)));

    if (!loading && !metal) {
        return (
            <div className="md">
                <section className="md-hero">
                    <img className="md-hero-img" src={metalHeroBg} alt="" aria-hidden="true" />
                    <div className="md-hero-shade" aria-hidden="true" />
                    <div className="md-inner md-hero-content">
                        <nav className="md-crumbs" aria-label="Breadcrumb">
                            <Link to="/">Home</Link><span aria-hidden="true">/</span><Link to="/metals">Metals</Link>
                        </nav>
                        <h1 className="md-title">Metal not found</h1>
                        <p className="md-lede">This metal may have been renamed or removed.</p>
                        <div className="md-hero-actions">
                            <Link to="/metals" className="md-btn is-primary">See all metals <ArrowRight size={16} aria-hidden="true" /></Link>
                        </div>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className="md">
            {/* ── Heading band ── */}
            <section className="md-hero" aria-labelledby="md-title">
                <img className="md-hero-img" src={metalHeroBg} alt="" aria-hidden="true" loading="eager" fetchPriority="high" decoding="async" />
                <div className="md-hero-shade" aria-hidden="true" />
                <div className="md-inner md-hero-content">
                    <nav className="md-crumbs" aria-label="Breadcrumb">
                        <Link to="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <Link to="/metals">Metals</Link>
                        <span aria-hidden="true">/</span>
                        {loading ? <span className="shimmer md-sk-crumb" aria-hidden="true" /> : <span aria-current="page">{displayMetalName(metal.name)}</span>}
                    </nav>

                    {loading ? (
                        <div className="md-hero-head" aria-hidden="true">
                            <span className="shimmer md-swatch" />
                            <span className="md-hero-names">
                                <span className="shimmer md-sk-family" />
                                <span className="shimmer md-sk-title" />
                            </span>
                        </div>
                    ) : (
                        <div className="md-hero-head">
                            <ThumbImage key={metal.image} className="md-swatch" src={metal.image} fallback={staticImage} />
                            <span className="md-hero-names">
                                {metal.category && <span className="md-family">{metal.category}</span>}
                                <h1 id="md-title" className="md-title">{displayMetalName(metal.name)}</h1>
                            </span>
                        </div>
                    )}

                    {loading ? (
                        <span className="md-sk-lede-wrap" aria-hidden="true">
                            <span className="shimmer md-sk-lede" />
                            <span className="shimmer md-sk-lede is-short" />
                        </span>
                    ) : metal.description && <p className="md-lede">{clean(metal.description)}</p>}

                    {loading ? (
                        <div className="md-facts" aria-hidden="true">
                            {[0, 1, 2].map(i => (
                                <div key={i} className="md-fact">
                                    <span className="shimmer md-sk-fact-label" />
                                    <span className="shimmer md-sk-fact" />
                                </div>
                            ))}
                        </div>
                    ) : facts.length > 0 && (
                        <dl className="md-facts">
                            {facts.map(f => (
                                <div key={f.label} className="md-fact">
                                    <dt>{f.label}</dt>
                                    <dd>{f.value}</dd>
                                </div>
                            ))}
                        </dl>
                    )}

                    <div className="md-hero-actions">
                        <Link to="/get-instant-pricing" className="md-btn is-primary">
                            Get instant pricing
                            <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                        <Link to="/metals" className="md-hero-link">All metals</Link>
                    </div>
                </div>
            </section>

            {/* ── Section bar ── */}
            <nav className="md-bar" aria-label="On this page">
                <div className="md-inner md-bar-inner">
                    {loading ? (
                        [88, 110, 72, 64, 56].map((w, i) => <span key={i} className="shimmer md-sk-tab" style={{ width: w }} aria-hidden="true" />)
                    ) : sections.map(s => (
                        <a
                            key={s.id}
                            href={`#md-${s.id}`}
                            className={`md-bar-link${activeSection === s.id ? ' is-active' : ''}`}
                            aria-current={activeSection === s.id ? 'location' : undefined}
                            onClick={(e) => { e.preventDefault(); goTo(s.id); }}
                        >
                            {s.label}
                        </a>
                    ))}
                </div>
            </nav>

            <div className="md-body">
                <div className="md-inner md-stack">
                    {loading ? (
                        <div className="md-grid-2" aria-hidden="true">
                            {[0, 1].map(p => (
                                <div key={p} className="md-panel">
                                    <span className="shimmer md-sk-h2" />
                                    {[0, 1, 2, 3].map(r => (
                                        <span key={r} className="md-sk-row">
                                            <span className="shimmer md-sk-line" />
                                            <span className="shimmer md-sk-line is-short" />
                                        </span>
                                    ))}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            {/* Overview */}
                            <section id="md-overview" className="md-section" aria-labelledby="md-overview-title">
                                <h2 id="md-overview-title" className="md-sr">Overview</h2>
                                {Array.isArray(metal.subMetals) && metal.subMetals.length > 0 ? (
                                    <div className="md-panel">
                                        <h3 className="md-h3">Grades</h3>
                                        <ul className="md-subs">
                                            {metal.subMetals.map((sub, i) => (
                                                <li key={i}>
                                                    <Link to={`/metal/${sub.id}`} className="md-sub">
                                                        <span>{displayMetalName(sub.name)}</span>
                                                        {Array.isArray(sub.tags) && <span className="md-sub-tags">{sub.tags.join(' · ')}</span>}
                                                        <ArrowRight size={16} aria-hidden="true" />
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : (
                                    <div className="md-grid-2">
                                        {cutSizes.length > 0 && (
                                            <motion.div className="md-panel" {...reveal()}>
                                                <h3 className="md-h3">Part sizes</h3>
                                                <ul className="md-sizes">
                                                    {cutSizes.map((c, i) => {
                                                        const [w, h] = inches(c.size);
                                                        const isQuote = /quote/i.test(c.action || '');
                                                        return (
                                                            <li key={i} className="md-size">
                                                                <SizeShape w={w || 1} h={h || 1} max={maxCut} />
                                                                <span className="md-size-text">
                                                                    <span className="md-size-value">{clean(c.size).replace(/\s*(min|max)\s*$/i, '')}</span>
                                                                    <span className="md-size-kind">{/min/i.test(c.size) ? 'Smallest part' : 'Largest part'}</span>
                                                                </span>
                                                                {c.action && (
                                                                    isQuote
                                                                        ? <Link to="/contact" className="md-tag is-quote">{c.action}</Link>
                                                                        : <Link to="/get-instant-pricing" className="md-tag">{c.action}</Link>
                                                                )}
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </motion.div>
                                        )}
                                        {thicknesses.length > 0 && (
                                            <motion.div className="md-panel" {...reveal(0.05)}>
                                                <div className="md-panel-head">
                                                    <h3 className="md-h3">Thicknesses</h3>
                                                    {quickLook.tolerance && <span className="md-panel-note">Laser cut, {tolerance(quickLook.tolerance)} tolerance</span>}
                                                </div>
                                                <ul className="md-thicks">
                                                    {thicknesses.map((t, i) => (
                                                        <li key={`${t.value}-${i}`}>
                                                            <button
                                                                type="button"
                                                                className={`md-thick${i === thicknessIndex ? ' is-active' : ''}`}
                                                                onClick={() => pickThickness(i, true)}
                                                                aria-label={`${t.value} (${t.metric}): see specifications`}
                                                            >
                                                                <span className="md-thick-in">{clean(t.value)}</span>
                                                                {t.metric && <span className="md-thick-mm">{clean(t.metric)}</span>}
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                                <p className="md-panel-hint">Pick a thickness to see its specifications.</p>
                                            </motion.div>
                                        )}
                                    </div>
                                )}
                                <CustomFields fields={customByTab.overview || []} />
                            </section>

                            {/* Specifications */}
                            {sections.some(s => s.id === 'specs') && (
                                <section id="md-specs" ref={specsRef} className="md-section" aria-labelledby="md-specs-title">
                                    <div className="md-section-head">
                                        <h2 id="md-specs-title" className="md-h2">
                                            Specifications{currentValue ? <span className="md-h2-sub"> · {clean(unit === 'mm' && current?.metric ? current.metric : currentValue)}</span> : null}
                                        </h2>
                                        <div className="md-controls">
                                            {thicknesses.length > 1 && (
                                                <Dropdown
                                                    label="Thickness"
                                                    value={thicknessIndex}
                                                    onChange={(i) => pickThickness(i, false)}
                                                    options={thicknesses.map((t, i) => ({ value: i, label: `${clean(t.value)}${t.metric ? `  ·  ${clean(t.metric)}` : ''}` }))}
                                                />
                                            )}
                                            <div className="md-units" role="group" aria-label="Units">
                                                {[['in', 'Inch'], ['mm', 'mm']].map(([key, label]) => (
                                                    <button key={key} type="button" className={unit === key ? 'is-active' : ''} aria-pressed={unit === key} onClick={() => setUnit(key)}>
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {thicknessServices.length > 0 && (
                                        <div className="md-avail">
                                            <span className="md-avail-label">Services at this thickness</span>
                                            <ul className="md-avail-list">
                                                {thicknessServices.map(s => (
                                                    <li key={s.id}>
                                                        {s.slug
                                                            ? <Link to={`/service/${s.slug}`} className="md-chip"><Check size={13} aria-hidden="true" />{s.title}</Link>
                                                            : <span className="md-chip"><Check size={13} aria-hidden="true" />{s.title}</span>}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {showcase.length > 0 && (
                                        <div className="md-showcase">
                                            {showcase.slice(0, 3).map(src => (
                                                <ThumbImage key={src} className="md-showcase-img" src={src} />
                                            ))}
                                        </div>
                                    )}

                                    <div className="md-spec-grid">
                                        {specGroups.map(group => (
                                            <div key={group.key} className="md-spec">
                                                <h3 className="md-spec-title">{group.title}</h3>
                                                <dl className="md-spec-rows">
                                                    {group.rows.map((row, i) => (
                                                        <div key={i}>
                                                            <dt>{clean(row.label)}</dt>
                                                            <dd>{valueOf(row)}</dd>
                                                        </div>
                                                    ))}
                                                </dl>
                                            </div>
                                        ))}
                                    </div>

                                    {properties.length > 0 && (
                                        <div className="md-panel md-props">
                                            <h3 className="md-h3">Material properties</h3>
                                            <dl className="md-spec-rows is-wide">
                                                {properties.map((p, i) => (
                                                    <div key={i}>
                                                        <dt>{clean(p.label)}</dt>
                                                        <dd>{clean(p.value ?? (unit === 'mm' ? p.mm : p.inch)) || '—'}</dd>
                                                    </div>
                                                ))}
                                            </dl>
                                        </div>
                                    )}
                                    <CustomFields fields={customByTab.specs || []} />
                                </section>
                            )}

                            {/* Services */}
                            {sections.some(s => s.id === 'services') && (
                                <section id="md-services" className="md-section" aria-labelledby="md-services-title">
                                    <div className="md-section-head">
                                        <h2 id="md-services-title" className="md-h2">Services</h2>
                                        {services && services.length > 0 && <span className="md-panel-note">{services.length} for {displayMetalName(metal.name)}</span>}
                                    </div>
                                    {services === null ? (
                                        <ul className="md-services" aria-hidden="true">
                                            {[0, 1, 2, 3].map(i => (
                                                <li key={i} className="md-service is-skeleton">
                                                    <span className="shimmer md-service-media" />
                                                    <span className="shimmer md-sk-line is-short" />
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <ul className="md-services">
                                            {services.map(s => {
                                                const fallback = servicesData.find(x => x.id === s.id)?.image || '';
                                                const reach = s.metalWide || s.count >= thicknesses.length
                                                    ? 'All thicknesses'
                                                    : `${s.count} of ${thicknesses.length} thicknesses`;
                                                return (
                                                    <li key={s.id}>
                                                        <Link to={`/service/${s.slug || s.id}`} className="md-service">
                                                            <ThumbImage key={s.image_path || s.image} className="md-service-media" src={s.image_path || s.image} fallback={fallback} />
                                                            <span className="md-service-name">{s.title}</span>
                                                            {thicknesses.length > 0 && <span className="md-service-reach">{reach}</span>}
                                                        </Link>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                    <CustomFields fields={customByTab.services || []} />
                                </section>
                            )}

                            {/* About */}
                            {sections.some(s => s.id === 'about') && (
                                <section id="md-about" className="md-section" aria-labelledby="md-about-title">
                                    <h2 id="md-about-title" className="md-h2">About {displayMetalName(metal.name)}</h2>
                                    {about && (
                                        <>
                                            {(about.title || about.text) && !about.comparisonTable && (
                                                <div className="md-panel md-about">
                                                    {about.image && (
                                                        <ThumbImage key={about.image} className="md-about-img" src={about.image} />
                                                    )}
                                                    <div className="md-about-text">
                                                        {about.title && <h3 className="md-h3">{clean(about.title)}</h3>}
                                                        {about.text && <p>{clean(about.text)}</p>}
                                                    </div>
                                                </div>
                                            )}

                                            {about.comparisonTable && (
                                                <div className="md-panel">
                                                    {about.title && <h3 className="md-h3">{clean(about.title)}</h3>}
                                                    {about.text && <p className="md-muted">{clean(about.text)}</p>}
                                                    <div className="md-table-wrap" tabIndex={0}>
                                                        <table className="md-table">
                                                            <thead>
                                                                <tr>
                                                                    <th scope="col"><span className="md-sr">Property</span></th>
                                                                    {(about.comparisonTable.headers || []).map((h, i) => {
                                                                        const target = about.comparisonTable.mappedIds?.[i];
                                                                        return (
                                                                            <th key={i} scope="col">
                                                                                {target ? <Link to={`/metal/${target}`}>{clean(h)}</Link> : clean(h)}
                                                                            </th>
                                                                        );
                                                                    })}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {(about.comparisonTable.rows || []).map((row, i) => (
                                                                    <tr key={i}>
                                                                        <th scope="row">{clean(row.label)}</th>
                                                                        {(row.ratings || row.values || []).map((v, j) => (
                                                                            <td key={j}>{row.ratings ? <span className="md-rating" aria-label={`${v} of 5`}>{[0, 1, 2, 3, 4].map(k => <span key={k} className={k < Number(v) ? 'is-on' : ''} />)}</span> : clean(v)}</td>
                                                                        ))}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            {features.length > 0 && (
                                                <div className="md-panel">
                                                    <h3 className="md-h3">How it rates</h3>
                                                    <ul className="md-features">
                                                        {features.map((f, i) => {
                                                            const r = Math.min(5, Math.max(0, Number(f.rating) || 0));
                                                            return (
                                                                <li key={i} className="md-feature">
                                                                    <span className="md-feature-label">{clean(f.label)}</span>
                                                                    <span className="md-rating" aria-label={`${r} of 5`}>
                                                                        {[0, 1, 2, 3, 4].map(k => <span key={k} className={k < r ? 'is-on' : ''} />)}
                                                                    </span>
                                                                    <span className="md-feature-score">{r}/5</span>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </div>
                                            )}

                                            {about.capabilities && (about.capabilities.title || about.capabilities.items?.length) && (
                                                <div className="md-panel">
                                                    {about.capabilities.title && <h3 className="md-h3">{clean(about.capabilities.title)}</h3>}
                                                    {about.capabilities.text && <p className="md-muted">{clean(about.capabilities.text)}</p>}
                                                    {Array.isArray(about.capabilities.items) && about.capabilities.items.length > 0 && (
                                                        <ul className="md-uses">
                                                            {about.capabilities.items.map((item, i) => (
                                                                <li key={i}><Check size={14} aria-hidden="true" />{clean(item)}</li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                    <CustomFields fields={customByTab.about || []} />
                                </section>
                            )}

                            {/* FAQs */}
                            {sections.some(s => s.id === 'faqs') && (
                                <section id="md-faqs" className="md-section" aria-labelledby="md-faqs-title">
                                    <h2 id="md-faqs-title" className="md-h2">Questions about {displayMetalName(metal.name)}</h2>
                                    {faqs.length > 0 && (
                                        <div className="md-panel md-faq-panel">
                                            <FaqList items={faqs} />
                                        </div>
                                    )}
                                    <CustomFields fields={customByTab.faqs || []} />
                                </section>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MetalDetail;
