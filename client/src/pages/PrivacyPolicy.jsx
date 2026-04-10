/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    ChevronRight, FileText, Mail
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Skeleton from '../components/Skeleton';
import LegalIcon from '../components/LegalIcon';

const DynamicIcon = ({ name, size = 22 }) => {
    return <LegalIcon name={name} size={size} />;
};

const PrivacyPolicy = () => {
    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPrivacy = async () => {
            try {
                const res = await fetch('/api/legal/privacy');
                const data = await res.json();
                if (data.success) {
                    // Force natural numeric sorting on client-side
                    const sortedData = [...data.data].sort((a, b) => {
                        const snA = a.serial_number || '';
                        const snB = b.serial_number || '';
                        const snResult = snA.localeCompare(snB, undefined, { numeric: true });
                        if (snResult !== 0) return snResult;
                        return (a.display_order || 0) - (b.display_order || 0);
                    });
                    setSections(sortedData);
                }
            } catch (err) {
                console.error('Failed to load privacy policy');
            } finally {
                setLoading(false);
            }
        };
        fetchPrivacy();
    }, []);

    const SkeletonBlock = () => (
        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0 }}>
                <Skeleton variant="rectangle" style={{ width: 52, height: 52, borderRadius: 16 }} />
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <Skeleton variant="text" style={{ width: 30, height: 12 }} />
                    <Skeleton variant="text" style={{ width: 200, height: 20 }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Skeleton variant="text" style={{ width: '90%' }} />
                    <Skeleton variant="text" style={{ width: '85%' }} />
                    <Skeleton variant="text" style={{ width: '40%' }} />
                </div>
            </div>
        </div>
    );

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
                    {loading ? (
                        <>
                            <SkeletonBlock />
                            <SkeletonBlock />
                            <SkeletonBlock />
                            <SkeletonBlock />
                        </>
                    ) : (
                        sections.map((section, idx) => (
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
                                        <DynamicIcon name={section.icon} />
                                    </div>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 900, color: section.color, letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'monospace' }}>{section.serial_number}</span>
                                        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>{section.heading}</h2>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {(section.content || []).map((para, i) => (
                                            <p key={i} style={{ fontSize: '1rem', color: '#475569', lineHeight: 1.75, margin: 0 }}>{para}</p>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
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
