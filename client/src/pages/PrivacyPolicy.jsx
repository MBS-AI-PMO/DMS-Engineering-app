import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Eye, CheckCircle, FileText, ChevronRight, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

const sections = [
    {
        id: '01',
        title: 'Information We Collect',
        icon: <Eye size={22} />,
        color: '#6366f1',
        content: [
            'We collect information you provide directly when you create an account, upload a CAD model, or request a quote. This includes your name, email address, company name, and billing information.',
            'Technical data such as CAD file metadata, part dimensions, and material specifications are collected to generate instant pricing and production estimates.',
            'Usage data including IP address, browser type, and interaction patterns are collected to improve our platform performance and user experience.'
        ]
    },
    {
        id: '02',
        title: 'How We Use Your Data',
        icon: <Lock size={22} />,
        color: '#e31b23',
        content: [
            'Your data powers our instant pricing engine — we analyze uploaded STEP files to compute accurate material, cutting, bending, and finishing costs in real time.',
            'Order and account data is used to fulfill manufacturing orders, send production updates, and maintain your order history.',
            'We do not sell, rent, or trade your personal information or intellectual property to any third party under any circumstances.'
        ]
    },
    {
        id: '03',
        title: 'IP & Design Protection',
        icon: <Shield size={22} />,
        color: '#10b981',
        content: [
            'All uploaded CAD files (STEP, DXF, etc.) are stored on AES-256 encrypted servers. Access is strictly limited to automated analysis systems and authorized production personnel directly involved in your order.',
            'You retain 100% ownership of your designs at all times. DMS Metals claims no intellectual property rights over any customer-uploaded files.',
            'Files associated with cancelled or expired quotes are permanently deleted from our servers within 90 days.'
        ]
    },
    {
        id: '04',
        title: 'Cookies & Tracking',
        icon: <CheckCircle size={22} />,
        color: '#f59e0b',
        content: [
            'Essential cookies maintain your session state, shopping cart contents, and authentication tokens. These cannot be disabled as they are required for the platform to function.',
            'Analytical cookies (opt-in) help us understand which features are most used, allowing our engineering team to prioritize improvements to the pricing and 3D viewer tools.',
            'You can manage cookie preferences at any time through your account settings or browser controls.'
        ]
    }
];

const PrivacyPolicy = () => {
    return (
        <div style={{ background: '#fff', minHeight: '100vh' }}>
            {/* Hero */}
            <section style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)', padding: '100px 24px 80px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(227,27,35,0.06) 0%, transparent 50%)', pointerEvents: 'none' }} />
                <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative', zIndex: 1 }}>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <nav style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginBottom: 32, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>Home</Link>
                            <ChevronRight size={12} />
                            <span style={{ color: '#fff' }}>Privacy Policy</span>
                        </nav>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 50, padding: '6px 16px', marginBottom: 20 }}>
                            <FileText size={13} style={{ color: '#818cf8' }} />
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#818cf8', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Legal Document</span>
                        </div>
                        <h1 style={{ fontSize: 'clamp(2.4rem, 5vw, 3.5rem)', fontWeight: 900, color: '#fff', margin: '0 0 20px', lineHeight: 1.1, letterSpacing: '-0.02em' }}>Privacy Policy</h1>
                        <p style={{ fontSize: '1.15rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, maxWidth: 580, margin: 0 }}>
                            Last updated April 1, 2026. Your privacy and the security of your intellectual property are our top priorities.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Content */}
            <main style={{ maxWidth: 800, margin: '0 auto', padding: '72px 24px 96px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                    {sections.map((section, idx) => (
                        <motion.div
                            key={section.id}
                            initial={{ opacity: 0, y: 24 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: idx * 0.08 }}
                            style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}
                        >
                            <div style={{ flexShrink: 0 }}>
                                <div style={{ width: 52, height: 52, borderRadius: 16, background: `${section.color}14`, border: `1.5px solid ${section.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: section.color }}>
                                    {section.icon}
                                </div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 900, color: section.color, letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'monospace' }}>{section.id}</span>
                                    <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>{section.title}</h2>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {section.content.map((para, i) => (
                                        <p key={i} style={{ fontSize: '1rem', color: '#475569', lineHeight: 1.75, margin: 0 }}>{para}</p>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Contact CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{ marginTop: 64, padding: '40px 48px', borderRadius: 24, background: 'linear-gradient(135deg, #0f172a, #1e293b)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}
                >
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>Privacy Questions?</h3>
                        <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>Contact our security team if you have concerns about your data.</p>
                    </div>
                    <Link to="/contact" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#e31b23', color: '#fff', padding: '13px 28px', borderRadius: 50, fontWeight: 800, fontSize: '0.85rem', textDecoration: 'none', letterSpacing: '0.5px', textTransform: 'uppercase', boxShadow: '0 8px 24px rgba(227,27,35,0.3)', whiteSpace: 'nowrap' }}>
                        <Mail size={15} /> Contact Us
                    </Link>
                </motion.div>

                <div style={{ marginTop: 40, textAlign: 'center' }}>
                    <Link to="/terms-of-service" style={{ fontSize: '0.85rem', color: '#6366f1', fontWeight: 700, textDecoration: 'none' }}>Read our Terms of Service →</Link>
                </div>
            </main>
        </div>
    );
};

export default PrivacyPolicy;
