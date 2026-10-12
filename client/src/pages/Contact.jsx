import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { ArrowRight, CheckCircle2, Linkedin, Facebook, Instagram, Loader2, Mail, MapPin, Phone } from 'lucide-react';
import { fetchSettings, sendContactMessage } from '../utils/api';
import Dropdown from '../components/Dropdown';
import contactHeroImg from '../assets/contact-hero.jpg';
import '../styles/Shimmer.css';
import '../styles/ContactPage.css';

/**
 * Contact (/contact): a heading band over the parts photo, then the ways
 * to reach the shop on the left — email, phone and address from Admin >
 * Contact, social links, and shortcuts to pricing, the FAQ and the
 * guidelines — and the message form on the right. The form sends through
 * /api/contact, which emails the contact address set in admin.
 */

const TOPICS = ['Quote question', 'Order help', 'Material or service question', 'File or design help', 'Something else'];

const SOCIAL_ICONS = {
    linkedin: { Icon: Linkedin, label: 'LinkedIn' },
    facebook: { Icon: Facebook, label: 'Facebook' },
    instagram: { Icon: Instagram, label: 'Instagram' },
};

const SHORTCUTS = [
    { to: '/get-instant-pricing', title: 'Get a price now', text: 'Upload a STEP or DXF file and see the price straight away.' },
    { to: '/faq', title: 'Search the FAQ', text: 'Answers about orders, files, materials and shipping.' },
    { to: '/guidelines', title: 'Check design guidelines', text: 'Size limits for every service, by material and thickness.' },
];

const EMPTY_FORM = { name: '', email: '', company: '', subject: TOPICS[0], message: '', website: '' };

const Contact = () => {
    const [form, setForm] = useState(EMPTY_FORM);
    const [status, setStatus] = useState('idle'); // idle | sending | sent
    const [error, setError] = useState('');
    const [contact, setContact] = useState(null);
    const [socials, setSocials] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        let cancelled = false;
        fetchSettings()
            .then((data) => {
                if (cancelled) return;
                setContact(data?.footer_contact || null);
                setSocials((data?.social_links || []).filter(
                    s => s.enabled && SOCIAL_ICONS[s.platform] && /^https?:\/\//i.test(String(s.url || '').trim())
                ));
            })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoaded(true); });
        return () => { cancelled = true; };
    }, []);

    const update = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (status === 'sending') return;
        setError('');
        if (!form.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim()) || form.message.trim().length < 10) {
            setError('Please add your name, a valid email and a message of at least 10 characters.');
            return;
        }
        setStatus('sending');
        try {
            await sendContactMessage(form);
            setStatus('sent');
            setForm(EMPTY_FORM);
        } catch (err) {
            setStatus('idle');
            setError(err.message || 'Your message could not be sent. Please email or call us instead.');
        }
    };

    const phoneHref = contact?.phone ? `tel:${String(contact.phone).replace(/[^\d+]/g, '')}` : '';
    const mapHref = contact?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}` : '';
    const hasContact = Boolean(contact?.email || contact?.phone || contact?.address);

    const fade = reduceMotion
        ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
        : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 }, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } };

    return (
        <div className="ct">
            {/* ── Heading band ── */}
            <section className="ct-hero" aria-labelledby="ct-title">
                <img className="ct-hero-img" src={contactHeroImg} alt="" aria-hidden="true" loading="eager" fetchPriority="high" decoding="async" />
                <div className="ct-hero-shade" aria-hidden="true" />
                <div className="ct-inner ct-hero-content">
                    <nav className="ct-crumbs" aria-label="Breadcrumb">
                        <Link to="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">Contact</span>
                    </nav>
                    <h1 id="ct-title" className="ct-title">Talk to us</h1>
                    <p className="ct-lede">
                        Questions about a quote, an order or a part? Send a message, or call or email us directly.
                    </p>
                </div>
            </section>

            {/* ── Body ── */}
            <section className="ct-body" aria-label="Contact">
                <div className="ct-inner ct-layout">
                    {/* Ways to reach us */}
                    <div className="ct-side">
                        <div className="ct-panel">
                            <h2 className="ct-h2">Reach us directly</h2>
                            {!loaded ? (
                                <ul className="ct-ways" aria-hidden="true">
                                    {[0, 1, 2].map(i => (
                                        <li key={i} className="ct-way is-skeleton">
                                            <span className="shimmer ct-way-icon" />
                                            <span className="ct-way-text">
                                                <span className="shimmer ct-sk-line is-label" />
                                                <span className="shimmer ct-sk-line" />
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : hasContact ? (
                                <ul className="ct-ways">
                                    {contact.email && (
                                        <li>
                                            <a href={`mailto:${contact.email}`} className="ct-way">
                                                <span className="ct-way-icon"><Mail size={18} aria-hidden="true" /></span>
                                                <span className="ct-way-text">
                                                    <span className="ct-way-label">Email</span>
                                                    <span className="ct-way-value">{contact.email}</span>
                                                </span>
                                            </a>
                                        </li>
                                    )}
                                    {contact.phone && (
                                        <li>
                                            <a href={phoneHref} className="ct-way">
                                                <span className="ct-way-icon"><Phone size={18} aria-hidden="true" /></span>
                                                <span className="ct-way-text">
                                                    <span className="ct-way-label">Phone</span>
                                                    <span className="ct-way-value">{contact.phone}</span>
                                                </span>
                                            </a>
                                        </li>
                                    )}
                                    {contact.address && (
                                        <li>
                                            <a href={mapHref} className="ct-way" target="_blank" rel="noopener noreferrer">
                                                <span className="ct-way-icon"><MapPin size={18} aria-hidden="true" /></span>
                                                <span className="ct-way-text">
                                                    <span className="ct-way-label">Address</span>
                                                    <span className="ct-way-value">{contact.address}</span>
                                                </span>
                                            </a>
                                        </li>
                                    )}
                                </ul>
                            ) : (
                                <p className="ct-muted">Use the form and we will get back to you.</p>
                            )}

                            {loaded && socials.length > 0 && (
                                <div className="ct-social">
                                    {socials.map(s => {
                                        const { Icon, label } = SOCIAL_ICONS[s.platform];
                                        return (
                                            <a key={s.platform} href={s.url} className="ct-social-link" aria-label={label} target="_blank" rel="noopener noreferrer">
                                                <Icon size={17} aria-hidden="true" />
                                            </a>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="ct-panel">
                            <h2 className="ct-h2">Maybe faster</h2>
                            <ul className="ct-shortcuts">
                                {SHORTCUTS.map(s => (
                                    <li key={s.to}>
                                        <Link to={s.to} className="ct-shortcut">
                                            <span className="ct-shortcut-text">
                                                <span className="ct-shortcut-title">{s.title}</span>
                                                <span className="ct-shortcut-sub">{s.text}</span>
                                            </span>
                                            <ArrowRight size={16} aria-hidden="true" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Message form */}
                    <div className="ct-panel ct-form-panel">
                        <AnimatePresence mode="wait" initial={false}>
                            {status === 'sent' ? (
                                <motion.div key="sent" className="ct-sent" role="status" {...fade}>
                                    <span className="ct-sent-icon"><CheckCircle2 size={28} aria-hidden="true" /></span>
                                    <h2 className="ct-h2">Message sent</h2>
                                    <p className="ct-muted">Thanks for writing. We will reply to the email you gave us.</p>
                                    <button type="button" className="ct-btn is-quiet" onClick={() => setStatus('idle')}>Send another message</button>
                                </motion.div>
                            ) : (
                                <motion.form key="form" className="ct-form" onSubmit={handleSubmit} noValidate {...fade}>
                                    <div className="ct-form-head">
                                        <h2 className="ct-h2">Send a message</h2>
                                        <p className="ct-muted">It goes straight to our team, and we reply to the email you give.</p>
                                    </div>

                                    <div className="ct-row">
                                        <label className="ct-field">
                                            <span className="ct-label">Name</span>
                                            <input type="text" name="name" autoComplete="name" required maxLength={120} value={form.name} onChange={update('name')} />
                                        </label>
                                        <label className="ct-field">
                                            <span className="ct-label">Email</span>
                                            <input type="email" name="email" autoComplete="email" required maxLength={200} value={form.email} onChange={update('email')} />
                                        </label>
                                    </div>
                                    <div className="ct-row">
                                        <label className="ct-field">
                                            <span className="ct-label">Company <span className="ct-optional">optional</span></span>
                                            <input type="text" name="company" autoComplete="organization" maxLength={160} value={form.company} onChange={update('company')} />
                                        </label>
                                        <div className="ct-field">
                                            <Dropdown
                                                className="ct-topic"
                                                label="Topic"
                                                value={form.subject}
                                                onChange={(value) => setForm(prev => ({ ...prev, subject: value }))}
                                                options={TOPICS.map(t => ({ value: t, label: t }))}
                                            />
                                        </div>
                                    </div>
                                    <label className="ct-field">
                                        <span className="ct-label">Message</span>
                                        <textarea name="message" rows={6} required maxLength={5000} value={form.message} onChange={update('message')} placeholder="Part numbers, quantities, materials, deadlines: anything that helps." />
                                    </label>

                                    {/* People never see or fill this; bots tend to. */}
                                    <label className="ct-trap" aria-hidden="true">
                                        Website
                                        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={update('website')} />
                                    </label>

                                    {error && <p className="ct-error" role="alert">{error}</p>}

                                    <div className="ct-form-foot">
                                        <button type="submit" className="ct-btn is-primary" disabled={status === 'sending'}>
                                            {status === 'sending' ? <Loader2 size={16} className="ct-spin" aria-hidden="true" /> : null}
                                            {status === 'sending' ? 'Sending' : 'Send message'}
                                            {status !== 'sending' && <ArrowRight size={16} aria-hidden="true" />}
                                        </button>
                                    </div>
                                </motion.form>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Contact;
