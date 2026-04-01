import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Linkedin, Facebook, Instagram, Mail, Phone, MapPin, Send, ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { subscribeNewsletter, fetchSettings } from '../utils/api';

const Footer = () => {
    const [settings, setSettings] = useState({
        footer_contact: {
            address: '1234 Metal St, Precision City',
            email: 'info@dms-metals.com',
            phone: '+1 (555) 000-0000'
        },
        social_links: [
            { platform: 'linkedin', url: '#', enabled: true },
            { platform: 'facebook', url: '#', enabled: true },
            { platform: 'instagram', url: '#', enabled: true }
        ]
    });
    const [nlEmail, setNlEmail] = useState('');
    const [nlLoading, setNlLoading] = useState(false);
    const [nlStatus, setNlStatus] = useState(null); // { type: 'success'|'error', msg }

    useEffect(() => {
        fetchSettings()
            .then(data => {
                if (data.footer_contact || data.social_links) {
                    setSettings(prev => ({
                        ...prev,
                        footer_contact: data.footer_contact || prev.footer_contact,
                        social_links: data.social_links || prev.social_links
                    }));
                }
            })
            .catch(err => console.error('Failed to load footer settings:', err));
    }, []);

    const handleSubscribe = async () => {
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

    const getSocialIcon = (platform) => {
        switch (platform) {
            case 'linkedin': return <Linkedin size={20} />;
            case 'facebook': return <Facebook size={20} />;
            case 'instagram': return <Instagram size={20} />;
            default: return null;
        }
    };

    return (
        <footer className="main-footer">
            <div className="footer-glow"></div>
            <div className="container">
                <div className="footer-grid">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="footer-brand"
                    >
                        <Link to="/" className="footer-logo">
                            <img src="/logo.png" alt="DMS Logo" className="footer-logo-img" />
                            <span className="footer-tagline">Precision. Quality. DMS.</span>
                        </Link>
                        <p className="footer-desc">
                            Premium metal processing and laser cutting services.
                            Delivering precision and quality for your most demanding projects.
                        </p>
                        <div className="social-links">
                            {settings.social_links.filter(s => s.enabled).map(social => (
                                <a
                                    key={social.platform}
                                    href={social.url}
                                    className="social-link"
                                    aria-label={social.platform}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {getSocialIcon(social.platform)}
                                </a>
                            ))}
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="footer-links"
                    >
                        <h4 className="footer-title">Quick Links</h4>
                        <ul>
                            <li><Link to="/">Home</Link></li>
                            <li><Link to="/metals">Metals</Link></li>
                            <li><Link to="/contact">Contact</Link></li>
                        </ul>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="footer-links"
                    >
                        <h4 className="footer-title">Top Metals</h4>
                        <ul>
                            <li><Link to="/metal/2024-t3-aluminum">2024 T3 Aluminum</Link></li>
                            <li><Link to="/metal/5052-h32-aluminum">5052 H32 Aluminum</Link></li>
                            <li><Link to="/metal/brass">Brass</Link></li>
                            <li><Link to="/metal/copper">Copper</Link></li>
                        </ul>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="footer-contact"
                    >
                        <h4 className="footer-title">Newsletter</h4>
                        <p className="footer-desc">Subscribe for latest updates & metal trends.</p>
                        <div className="newsletter-form">
                            <input
                                type="email"
                                placeholder="Your Email Address"
                                className="newsletter-input"
                                value={nlEmail}
                                onChange={e => setNlEmail(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSubscribe()}
                                disabled={nlLoading}
                            />
                            <button className="newsletter-btn" aria-label="Subscribe" onClick={handleSubscribe} disabled={nlLoading}>
                                {nlLoading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                            </button>
                        </div>
                        {nlStatus && (
                            <p className={`newsletter-status ${nlStatus.type}`}>
                                {nlStatus.type === 'success' && <CheckCircle size={14} />}
                                {nlStatus.msg}
                            </p>
                        )}
                        <div className="contact-info-list">
                            <div className="contact-item">
                                <MapPin size={18} className="contact-icon" />
                                <span>{settings.footer_contact.address}</span>
                            </div>
                            <div className="contact-item">
                                <Mail size={18} className="contact-icon" />
                                <span>{settings.footer_contact.email}</span>
                            </div>
                            <div className="contact-item">
                                <Phone size={18} className="contact-icon" />
                                <span>{settings.footer_contact.phone}</span>
                            </div>
                        </div>
                        <Link to="/quote" className="btn-lavish-quote" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            GET A QUOTE <ArrowRight size={18} />
                        </Link>
                    </motion.div>
                </div>

                <div className="footer-bottom">
                    <div className="footer-bottom-flex">
                        <p>&copy; {new Date().getFullYear()} DMS Metals. All Rights Reserved.</p>
                        <div className="footer-bottom-links">
                            <Link to="/privacy-policy">Privacy Policy</Link>
                            <Link to="/terms-of-service">Terms of Service</Link>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
