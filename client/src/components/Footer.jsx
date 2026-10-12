import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Linkedin, Facebook, Instagram, Mail, Phone, MapPin, ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import { subscribeNewsletter, fetchSettings } from '../utils/api';
import { displayMetalName } from '../utils/metalDisplay';
import '../styles/Shimmer.css';
import '../styles/SiteFooter.css';

/**
 * The site footer: a dark band like the site bar. On most pages it opens
 * with a "Have a part ready?" band leading to instant pricing; then brand
 * and newsletter on the left, pages, top metals and contact; copyright and
 * legal links along the bottom. Contact details, social links, top metals
 * and the logo come from admin settings; until they arrive they shimmer.
 */

// Pages where "Get instant pricing" is the page itself or the order flow.
const NO_CTA_PATHS = ['/get-instant-pricing', '/quote', '/cart', '/checkout', '/orders', '/settings'];

const PAGE_LINKS = [
    { name: 'Home', path: '/' },
    { name: 'Metals', path: '/metals' },
    { name: 'Services', path: '/#services' },
    { name: 'Instant pricing', path: '/get-instant-pricing' },
    { name: 'Guidelines', path: '/guidelines' },
    { name: 'FAQ', path: '/faq' },
    { name: 'Contact us', path: '/contact' },
];

// Shown only when admin has not picked any top metals.
const FALLBACK_TOP_METALS = [
    { name: '5052 H32 Aluminum', slug: '5052-h32-aluminum' },
    { name: 'Cold Rolled Steel', slug: 'cold-rolled-1008' },
    { name: 'Hot Rolled A36', slug: 'hot-rolled-a36' },
    { name: 'G90 Steel', slug: 'g90-steel' },
];

const SOCIAL_ICONS = {
    linkedin: { Icon: Linkedin, label: 'LinkedIn' },
    facebook: { Icon: Facebook, label: 'Facebook' },
    instagram: { Icon: Instagram, label: 'Instagram' },
};

const Footer = () => {
    const { pathname } = useLocation();
    const showCta = !NO_CTA_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`));
    const onMetals = pathname === '/metals';
    const [settings, setSettings] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const [logo, setLogo] = useState(localStorage.getItem('footer_logo') || '/logo.webp');
    const [nlEmail, setNlEmail] = useState('');
    const [nlLoading, setNlLoading] = useState(false);
    const [nlStatus, setNlStatus] = useState(null); // { type: 'success'|'error', msg }

    useEffect(() => {
        fetchSettings()
            .then(data => {
                setSettings(data || {});
                if (data?.footer_logo) {
                    setLogo(data.footer_logo);
                    localStorage.setItem('footer_logo', data.footer_logo);
                }
            })
            .catch(err => {
                console.error('Failed to load footer settings:', err);
                setSettings({});
            })
            .finally(() => setLoaded(true));
    }, []);

    const handleLogoError = () => {
        localStorage.removeItem('footer_logo');
        setLogo('/logo.webp');
    };

    const handleSubscribe = async (e) => {
        e.preventDefault();
        if (!nlEmail || !nlEmail.includes('@')) {
            setNlStatus({ type: 'error', msg: 'Please enter a valid email' });
            return;
        }
        setNlLoading(true);
        setNlStatus(null);
        try {
            await subscribeNewsletter(nlEmail);
            setNlStatus({ type: 'success', msg: 'Subscribed successfully!' });
            setNlEmail('');
            setTimeout(() => setNlStatus(null), 5000);
        } catch (err) {
            setNlStatus({ type: 'error', msg: err.message || 'Failed to subscribe' });
        } finally {
            setNlLoading(false);
        }
    };

    const contact = settings?.footer_contact || {};
    const phoneHref = contact.phone ? `tel:${String(contact.phone).replace(/[^\d+]/g, '')}` : '';
    const hasContact = Boolean(contact.address || contact.email || contact.phone);
    // Only real web addresses become links (no "#", no javascript: urls).
    const socials = (settings?.social_links || []).filter(
        s => s.enabled && SOCIAL_ICONS[s.platform] && /^https?:\/\//i.test(String(s.url || '').trim())
    );
    const topMetals = settings?.top_metals?.length ? settings.top_metals : FALLBACK_TOP_METALS;

    const shimmerList = (widths) => (
        <ul className="sf-list" aria-hidden="true">
            {widths.map((w, i) => (
                <li key={i}><span className="shimmer sf-sk-line" style={{ width: w }} /></li>
            ))}
        </ul>
    );

    return (
        <footer className="sf">
            {showCta && (
                <section className="sf-cta" aria-labelledby="sf-cta-title">
                    <div className="sf-cta-inner">
                        <div>
                            <h2 id="sf-cta-title" className="sf-cta-title">Have a part ready?</h2>
                            <p className="sf-cta-text">Upload a STEP or DXF file and see the price with every service you pick.</p>
                        </div>
                        <div className="sf-cta-actions">
                            <Link to="/get-instant-pricing" className="sf-cta-btn is-primary">
                                Get instant pricing
                                <ArrowRight size={16} aria-hidden="true" />
                            </Link>
                            <Link to={onMetals ? '/services' : '/metals'} className="sf-cta-btn">
                                {onMetals ? 'Browse services' : 'Explore metals'}
                            </Link>
                        </div>
                    </div>
                </section>
            )}
            <div className="sf-inner">
                <div className="sf-top">
                    <div className="sf-brand">
                        <Link to="/" className="sf-logo" aria-label="DMS home">
                            <img src={logo} alt="DMS" decoding="async" loading="lazy" onError={handleLogoError} />
                        </Link>
                        <p className="sf-desc">
                            Premium metal processing and laser cutting services.
                            Delivering precision and quality for your most demanding projects.
                        </p>

                        <form className="sf-news" onSubmit={handleSubscribe} noValidate>
                            <label htmlFor="sf-news-email" className="sf-news-label">
                                Subscribe for the latest updates and metal trends.
                            </label>
                            <div className="sf-news-row">
                                <input
                                    id="sf-news-email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="you@company.com"
                                    className="sf-news-input"
                                    value={nlEmail}
                                    onChange={e => setNlEmail(e.target.value)}
                                    disabled={nlLoading}
                                />
                                <button type="submit" className="sf-news-btn" disabled={nlLoading}>
                                    {nlLoading ? <Loader2 size={16} className="sf-spin" aria-hidden="true" /> : null}
                                    {nlLoading ? 'Subscribing' : 'Subscribe'}
                                </button>
                            </div>
                            <p className={`sf-news-status${nlStatus ? ` is-${nlStatus.type}` : ''}`} role="status">
                                {nlStatus?.type === 'success' && <CheckCircle size={14} aria-hidden="true" />}
                                {nlStatus?.msg}
                            </p>
                        </form>
                    </div>

                    <nav className="sf-col" aria-labelledby="sf-pages">
                        <h2 id="sf-pages" className="sf-col-title">Pages</h2>
                        <ul className="sf-list">
                            {PAGE_LINKS.map(link => (
                                <li key={link.path}><Link to={link.path} className="sf-link">{link.name}</Link></li>
                            ))}
                        </ul>
                    </nav>

                    <nav className="sf-col" aria-labelledby="sf-metals">
                        <h2 id="sf-metals" className="sf-col-title">Top metals</h2>
                        {loaded ? (
                            <ul className="sf-list">
                                {topMetals.map(metal => (
                                    <li key={metal.slug || metal.name}>
                                        <Link to={`/metal/${metal.slug}`} className="sf-link">{displayMetalName(metal.name)}</Link>
                                    </li>
                                ))}
                            </ul>
                        ) : shimmerList(['78%', '56%', '70%', '64%', '82%'])}
                    </nav>

                    <div className="sf-col">
                        <h2 className="sf-col-title">Contact</h2>
                        {!loaded ? shimmerList(['90%', '72%', '58%']) : hasContact ? (
                            <ul className="sf-list sf-contact">
                                {contact.address && (
                                    <li className="sf-contact-item">
                                        <MapPin size={16} aria-hidden="true" />
                                        <span>{contact.address}</span>
                                    </li>
                                )}
                                {contact.email && (
                                    <li className="sf-contact-item">
                                        <Mail size={16} aria-hidden="true" />
                                        <a href={`mailto:${contact.email}`} className="sf-link">{contact.email}</a>
                                    </li>
                                )}
                                {contact.phone && (
                                    <li className="sf-contact-item">
                                        <Phone size={16} aria-hidden="true" />
                                        <a href={phoneHref} className="sf-link">{contact.phone}</a>
                                    </li>
                                )}
                            </ul>
                        ) : (
                            <ul className="sf-list">
                                <li><Link to="/contact" className="sf-link">Send us a message</Link></li>
                            </ul>
                        )}

                        {!loaded ? (
                            <div className="sf-social" aria-hidden="true">
                                {[0, 1, 2].map(i => <span key={i} className="shimmer sf-sk-social" />)}
                            </div>
                        ) : socials.length > 0 && (
                            <div className="sf-social">
                                {socials.map(social => {
                                    const { Icon, label } = SOCIAL_ICONS[social.platform];
                                    return (
                                        <a
                                            key={social.platform}
                                            href={social.url}
                                            className="sf-social-link"
                                            aria-label={label}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <Icon size={17} aria-hidden="true" />
                                        </a>
                                    );
                                })}
                            </div>
                        )}

                        <Link to="/quote" className="sf-quote">
                            Get a quote
                            <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                    </div>
                </div>

                <div className="sf-bottom">
                    <p className="sf-copy">&copy; {new Date().getFullYear()} DMS Metals. All rights reserved.</p>
                    <div className="sf-legal">
                        <Link to="/privacy-policy" className="sf-link">Privacy policy</Link>
                        <Link to="/terms-of-service" className="sf-link">Terms of service</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
