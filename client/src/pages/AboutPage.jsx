import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Mail, MapPin, Phone } from 'lucide-react';
import { fetchCategories, fetchMetals, fetchServices, fetchSettings } from '../utils/api';
import { displayMetalName, thicknessBounds } from '../utils/metalDisplay';
import { servicesData as staticServicesData } from '../data/servicesData';
import { metalsData as staticMetalsData } from '../data/metalsData';
import ThumbImage from '../components/ThumbImage';
import usePageHero from '../hooks/usePageHero';
import '../styles/Shimmer.css';
import '../styles/AboutPage.css';

/**
 * About (/about): a heading band over the laser-cut parts photo with live
 * counts, then who the shop is, how an order goes from file to finished
 * part, the services and the metals (both live from admin, with the
 * built-in lists as a fallback), and the ways to reach the shop from
 * Admin > Contact. Live parts shimmer until they have loaded.
 *
 * Everything said here is already said elsewhere on the site (index.html
 * description, home page, footer, pricing page); keep it that way rather
 * than adding claims (years, team size, certifications, lead times).
 */

const STEPS = [
    {
        title: 'Upload your file',
        text: 'Drop a STEP or DXF file of your part on the pricing page. The design guidelines list the size limits for every service, by material and thickness.',
        link: { to: '/guidelines', label: 'Design guidelines' },
    },
    {
        title: 'Get an instant price',
        text: 'Pick a metal, a thickness and the services you need. The price follows every choice, so you see the cost before you order.',
        link: { to: '/get-instant-pricing', label: 'Try it now' },
    },
    {
        title: 'We make your parts',
        text: 'Your order comes to our shop in Dallas, where the parts are cut, formed, machined and finished to your file.',
    },
    {
        title: 'We ship them to you',
        text: 'Finished parts ship to the address you give at checkout. Each order’s status, from in production to shipped, is under My orders in your account.',
    },
];

const FACTS = [
    { label: 'Based in', value: 'Dallas, Texas' },
    { label: 'We make', value: 'Laser-cut, bent and CNC-machined metal parts' },
    { label: 'Files', value: 'STEP or DXF' },
    { label: 'Pricing', value: 'Instant and online, with every service you pick' },
    { label: 'Ordering', value: 'Online, followed from My orders in your account' },
];

const toService = (svc) => {
    const staticMatch = staticServicesData.find(s => s.id === svc.id);
    return {
        id: svc.id,
        slug: svc.slug,
        title: svc.title,
        description: svc.description,
        isProduction: Boolean(svc.is_production),
        image: svc.image_path || staticMatch?.image || '',
        fallbackImage: staticMatch?.image || '',
    };
};

const AboutPage = () => {
    const hero = usePageHero('about');
    const [services, setServices] = useState([]);
    const [metals, setMetals] = useState([]);
    const [familyOrder, setFamilyOrder] = useState([]);
    const [contact, setContact] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            const [servicesResult, metalsResult, categoriesResult, settingsResult] = await Promise.allSettled([
                fetchServices(), fetchMetals(), fetchCategories(), fetchSettings(),
            ]);
            if (cancelled) return;

            if (servicesResult.status === 'fulfilled' && Array.isArray(servicesResult.value) && servicesResult.value.length) {
                setServices(servicesResult.value.map(toService));
            } else {
                setServices(staticServicesData.map(s => ({ ...s, isProduction: false, fallbackImage: s.image })));
            }

            if (metalsResult.status === 'fulfilled' && Array.isArray(metalsResult.value)) {
                setMetals(metalsResult.value.map(m => ({
                    id: m.id,
                    slug: m.slug,
                    name: m.name,
                    thickness: m.thickness,
                    category: m.category_name || '',
                })));
            } else {
                setMetals(staticMetalsData.map(m => ({
                    id: m.id, slug: m.slug, name: m.name, thickness: m.thickness, category: m.category || '',
                })));
            }

            if (categoriesResult.status === 'fulfilled' && Array.isArray(categoriesResult.value)) {
                setFamilyOrder(categoriesResult.value.map(c => c.name).filter(Boolean));
            }
            if (settingsResult.status === 'fulfilled') {
                setContact(settingsResult.value?.footer_contact || null);
            }
            setLoading(false);
        }
        load();
        return () => { cancelled = true; };
    }, []);

    // Cutting and machining start a part; the rest are added to it. With
    // the built-in list (no such flag) everything shows as one group.
    const serviceGroups = useMemo(() => {
        const making = services.filter(s => s.isProduction);
        const adding = services.filter(s => !s.isProduction);
        if (!making.length || !adding.length) return [{ key: 'all', title: '', items: services }];
        return [
            { key: 'make', title: 'Cutting and machining', items: making },
            { key: 'add', title: 'Forming, hardware and finishing', items: adding },
        ];
    }, [services]);

    // Metal families in the admin's order, each with its metals and range.
    const families = useMemo(() => {
        const byName = new Map();
        metals.forEach(m => {
            const name = m.category || 'Other metals';
            if (!byName.has(name)) byName.set(name, []);
            byName.get(name).push(m);
        });
        const known = familyOrder.filter(name => byName.has(name));
        const rest = [...byName.keys()].filter(name => !familyOrder.includes(name));
        return [...known, ...rest].map(name => ({
            name,
            items: byName.get(name),
            bounds: thicknessBounds(byName.get(name).map(m => m.thickness)),
        }));
    }, [metals, familyOrder]);

    const bounds = useMemo(() => thicknessBounds(metals.map(m => m.thickness)), [metals]);

    const phoneHref = contact?.phone ? `tel:${String(contact.phone).replace(/[^\d+]/g, '')}` : '';
    const mapHref = contact?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}` : '';
    const hasContact = Boolean(contact?.email || contact?.phone || contact?.address);

    const stat = (value) => (loading ? <span className="shimmer ab-sk-stat" aria-hidden="true" /> : value);

    return (
        <div className="ab">
            {/* ── Heading band ── */}
            <section className="ab-hero" aria-labelledby="ab-title">
                {hero.src && <img className="ab-hero-img" src={hero.src} srcSet={hero.srcSet} sizes="100vw" alt="" aria-hidden="true" loading="eager" fetchPriority="high" decoding="async" />}
                <div className="ab-hero-shade" aria-hidden="true" />
                <div className="ab-inner ab-hero-content">
                    <nav className="ab-crumbs" aria-label="Breadcrumb">
                        <Link to="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">About</span>
                    </nav>
                    <h1 id="ab-title" className="ab-title">Custom metal parts, made in Dallas</h1>
                    <p className="ab-lede">
                        Dynamic Manufacturing Solutions is a sheet-metal job shop in Dallas, Texas. We laser cut,
                        bend and CNC machine parts to your design, and you can price them online the moment you
                        upload your file.
                    </p>

                    <dl className="ab-stats" aria-busy={loading}>
                        <div className="ab-stat">
                            <dt>Services</dt>
                            <dd>{stat(services.length || '—')}</dd>
                        </div>
                        <div className="ab-stat">
                            <dt>Metals in stock</dt>
                            <dd>{stat(metals.length || '—')}</dd>
                        </div>
                        <div className="ab-stat">
                            <dt>Thickness range</dt>
                            <dd>{stat(bounds ? `${bounds.min} – ${bounds.max}` : '—')}</dd>
                        </div>
                    </dl>

                    <div className="ab-hero-actions">
                        <Link to="/get-instant-pricing" className="ab-btn is-primary">
                            Get instant pricing
                            <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                        <Link to="/contact" className="ab-hero-link">Contact us</Link>
                    </div>
                </div>
            </section>

            {/* ── Who we are ── */}
            <section className="ab-section" aria-labelledby="ab-who">
                <div className="ab-inner ab-intro">
                    <div className="ab-intro-copy">
                        <h2 id="ab-who" className="ab-h2">Who we are</h2>
                        <p>
                            DMS makes custom metal parts from the files you send us: flat parts cut from sheet,
                            bent parts and CNC-machined parts, with hardware and finishing added when a part needs them.
                        </p>
                        <p>
                            You do not wait for a quote. Upload a part, choose the material, thickness and services,
                            and the price is there as you choose. Cutting, forming, hardware and finishing are all
                            priced together in one order.
                        </p>
                        <p>
                            Some parts cannot be priced automatically. For those, use Request a quote on the pricing
                            page and we reply to the email you give us.
                        </p>
                    </div>

                    <div className="ab-panel ab-facts">
                        <h3 className="ab-h3">At a glance</h3>
                        <dl className="ab-facts-list">
                            {FACTS.map(f => (
                                <div key={f.label} className="ab-fact">
                                    <dt>{f.label}</dt>
                                    <dd>{f.value}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </div>
            </section>

            {/* ── How ordering works ── */}
            <section className="ab-section" aria-labelledby="ab-how">
                <div className="ab-inner">
                    <div className="ab-head">
                        <div>
                            <h2 id="ab-how" className="ab-h2">How ordering works</h2>
                            <p className="ab-sub">Four steps from your file to finished parts at your door.</p>
                        </div>
                    </div>
                    <ol className="ab-steps">
                        {STEPS.map((step, i) => (
                            <li key={step.title} className="ab-step">
                                <span className="ab-step-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                                <h3 className="ab-h3">{step.title}</h3>
                                <p className="ab-step-text">{step.text}</p>
                                {step.link && (
                                    <Link to={step.link.to} className="ab-text-link">
                                        {step.link.label}
                                        <ArrowRight size={15} aria-hidden="true" />
                                    </Link>
                                )}
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* ── Services ── */}
            <section className="ab-section" aria-labelledby="ab-services">
                <div className="ab-inner">
                    <div className="ab-head">
                        <div>
                            <h2 id="ab-services" className="ab-h2">What we do</h2>
                            <p className="ab-sub">Cutting, forming, hardware and finishing, all priced together in one order.</p>
                        </div>
                        <Link to="/services" className="ab-text-link">
                            All services
                            <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                    </div>

                    {loading ? (
                        <ul className="ab-services" aria-hidden="true">
                            {[0, 1, 2, 3, 4, 5].map(i => (
                                <li key={i} className="ab-service is-skeleton">
                                    <span className="shimmer ab-service-img" />
                                    <span className="ab-service-text">
                                        <span className="shimmer ab-sk-line is-name" />
                                        <span className="shimmer ab-sk-line" />
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : serviceGroups.map(group => (
                        <div key={group.key} className="ab-group">
                            {group.title && <h3 className="ab-group-title">{group.title}</h3>}
                            <ul className="ab-services">
                                {group.items.map(service => (
                                    <li key={service.id}>
                                        <Link to={service.slug ? `/service/${service.slug}` : '/services'} className="ab-service">
                                            <ThumbImage
                                                key={service.image}
                                                className="ab-service-img"
                                                src={service.image}
                                                fallback={service.fallbackImage}
                                            />
                                            <span className="ab-service-text">
                                                <span className="ab-service-name">{service.title}</span>
                                                {service.description && <span className="ab-service-desc">{service.description}</span>}
                                            </span>
                                            <ArrowRight size={16} className="ab-arrow" aria-hidden="true" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Materials ── */}
            <section className="ab-section" aria-labelledby="ab-materials">
                <div className="ab-inner">
                    <div className="ab-head">
                        <div>
                            <h2 id="ab-materials" className="ab-h2">Materials</h2>
                            <p className="ab-sub">
                                {loading ? (
                                    <span className="shimmer ab-sk-line is-sub" aria-hidden="true" />
                                ) : (
                                    <>
                                        {metals.length} {metals.length === 1 ? 'metal' : 'metals'} in stock
                                        {families.length > 1 ? ` across ${families.length} families` : ''}
                                        {bounds ? `, from ${bounds.min} to ${bounds.max} thick.` : '.'}
                                    </>
                                )}
                            </p>
                        </div>
                        <Link to="/metals" className="ab-text-link">
                            Material catalog
                            <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                    </div>

                    {loading ? (
                        <ul className="ab-families" aria-hidden="true">
                            {[0, 1, 2].map(i => (
                                <li key={i} className="ab-family is-skeleton">
                                    <span className="shimmer ab-sk-line is-name" />
                                    {[0, 1, 2].map(j => <span key={j} className="shimmer ab-sk-line is-row" />)}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <ul className="ab-families">
                            {families.map(family => (
                                <li key={family.name} className="ab-family">
                                    <div className="ab-family-head">
                                        <h3 className="ab-h3">{family.name}</h3>
                                        <span className="ab-count">{family.items.length}</span>
                                    </div>
                                    <ul className="ab-metals">
                                        {family.items.map(metal => (
                                            <li key={metal.id}>
                                                <Link to={`/metal/${metal.slug || metal.id}`} className="ab-metal">
                                                    {displayMetalName(metal.name)}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                    {family.bounds && (
                                        <p className="ab-family-range">
                                            {family.bounds.min === family.bounds.max
                                                ? family.bounds.min
                                                : `${family.bounds.min} – ${family.bounds.max}`} thick
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="ab-note">More options coming soon, including plastics and composites.</p>
                </div>
            </section>

            {/* ── Contact ── */}
            <section className="ab-section is-last" aria-labelledby="ab-contact">
                <div className="ab-inner">
                    <div className="ab-panel ab-contact">
                        <div className="ab-contact-copy">
                            <h2 id="ab-contact" className="ab-h2">Questions before you order?</h2>
                            <p className="ab-sub">
                                Ask about a quote, an order, a material or your file. Send us a message, or call or
                                email us directly.
                            </p>
                            <div className="ab-contact-actions">
                                <Link to="/contact" className="ab-btn is-primary">
                                    Contact us
                                    <ArrowRight size={16} aria-hidden="true" />
                                </Link>
                                <Link to="/faq" className="ab-btn">Read the FAQ</Link>
                            </div>
                        </div>

                        {loading ? (
                            <ul className="ab-ways" aria-hidden="true">
                                {[0, 1, 2].map(i => (
                                    <li key={i} className="ab-way">
                                        <span className="shimmer ab-way-icon" />
                                        <span className="ab-way-text">
                                            <span className="shimmer ab-sk-line is-label" />
                                            <span className="shimmer ab-sk-line" />
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : hasContact && (
                            <ul className="ab-ways">
                                {contact.email && (
                                    <li>
                                        <a href={`mailto:${contact.email}`} className="ab-way">
                                            <span className="ab-way-icon"><Mail size={18} aria-hidden="true" /></span>
                                            <span className="ab-way-text">
                                                <span className="ab-way-label">Email</span>
                                                <span className="ab-way-value">{contact.email}</span>
                                            </span>
                                        </a>
                                    </li>
                                )}
                                {contact.phone && (
                                    <li>
                                        <a href={phoneHref} className="ab-way">
                                            <span className="ab-way-icon"><Phone size={18} aria-hidden="true" /></span>
                                            <span className="ab-way-text">
                                                <span className="ab-way-label">Phone</span>
                                                <span className="ab-way-value">{contact.phone}</span>
                                            </span>
                                        </a>
                                    </li>
                                )}
                                {contact.address && (
                                    <li>
                                        <a href={mapHref} className="ab-way" target="_blank" rel="noopener noreferrer">
                                            <span className="ab-way-icon"><MapPin size={18} aria-hidden="true" /></span>
                                            <span className="ab-way-text">
                                                <span className="ab-way-label">Address</span>
                                                <span className="ab-way-value">{contact.address}</span>
                                            </span>
                                        </a>
                                    </li>
                                )}
                            </ul>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default AboutPage;
