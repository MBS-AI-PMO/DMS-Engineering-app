/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    ChevronRight, FileText
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Skeleton from '../components/Skeleton';
import LegalIcon from '../components/LegalIcon';

const DynamicIcon = ({ name, size = 22 }) => {
    return <LegalIcon name={name} size={size} />;
};

const TermsOfService = () => {
    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTerms = async () => {
            try {
                const res = await fetch('/api/legal/terms');
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
                console.error('Failed to load terms');
            } finally {
                setLoading(false);
            }
        };
        fetchTerms();
    }, []);

    const SkeletonBlock = () => (
        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', paddingBottom: 48 }}>
            <div style={{ flexShrink: 0 }}>
                <Skeleton variant="rectangle" style={{ width: 52, height: 52, borderRadius: 16 }} />
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <Skeleton variant="text" style={{ width: 30, height: 12 }} />
                    <Skeleton variant="text" style={{ width: 220, height: 20 }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} style={{ display: 'flex', gap: 12 }}>
                            <Skeleton variant="circle" style={{ width: 6, height: 6, flexShrink: 0, marginTop: 9 }} />
                            <Skeleton variant="text" style={{ width: i === 3 ? '60%' : '95%' }} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ background: '#fff', minHeight: '100vh' }}>
            {/* Hero */}
            <section style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1a0a0a 60%, #0f172a 100%)', padding: '100px 24px 80px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(227,27,35,0.08) 0%, transparent 60%), radial-gradient(circle at 20% 20%, rgba(99,102,241,0.06) 0%, transparent 50%)', pointerEvents: 'none' }} />
                <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative', zIndex: 1 }}>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <nav style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginBottom: 32, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>Home</Link>
                            <ChevronRight size={12} />
                            <span style={{ color: '#fff' }}>Terms of Service</span>
                        </nav>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(227,27,35,0.12)', border: '1px solid rgba(227,27,35,0.3)', borderRadius: 50, padding: '6px 16px', marginBottom: 20 }}>
                            <FileText size={13} style={{ color: '#f87171' }} />
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f87171', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Legal Document</span>
                        </div>
                        <h1 style={{ fontSize: 'clamp(2.4rem, 5vw, 3.5rem)', fontWeight: 900, color: '#fff', margin: '0 0 20px', lineHeight: 1.1, letterSpacing: '-0.02em' }}>Terms of Service</h1>
                        <p style={{ fontSize: '1.15rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, maxWidth: 580, margin: 0 }}>
                            Last updated April 1, 2026. Please read these terms carefully before starting your manufacturing project.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Table of Contents */}
            <div style={{ borderBottom: '1px solid #f1f5f9', padding: '0 24px' }}>
                <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '0', overflow: 'hidden' }}>
                    {loading ? (
                        [1, 2, 3, 4].map(i => (
                            <div key={i} style={{ padding: '16px 20px' }}>
                                <Skeleton variant="text" style={{ width: 80 }} />
                            </div>
                        ))
                    ) : (
                        sections.map((s) => (
                            <a key={s.id} href={`#section-${s.id}`} style={{ padding: '16px 20px', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textDecoration: 'none', borderBottom: '2px solid transparent', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                                onMouseEnter={e => { e.target.style.color = '#0f172a'; e.target.style.borderBottomColor = '#e31b23'; }}
                                onMouseLeave={e => { e.target.style.color = '#64748b'; e.target.style.borderBottomColor = 'transparent'; }}>
                                {s.serial_number}. {s.heading}
                            </a>
                        ))
                    )}
                </div>
            </div>

            {/* Content */}
            <main style={{ maxWidth: 800, margin: '0 auto', padding: '72px 24px 96px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
                    {loading ? (
                        <>
                            <SkeletonBlock />
                            <SkeletonBlock />
                            <SkeletonBlock />
                        </>
                    ) : (
                        sections.map((section, idx) => (
                            <motion.div
                                key={section.id}
                                id={`section-${section.id}`}
                                initial={{ opacity: 0, y: 24 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: idx * 0.06 }}
                                style={{ display: 'flex', gap: 28, alignItems: 'flex-start', paddingBottom: 48, borderBottom: idx < sections.length - 1 ? '1px solid #f1f5f9' : 'none' }}
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
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        {(section.content || []).map((para, i) => (
                                            <div key={i} style={{ display: 'flex', gap: 12 }}>
                                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: section.color, flexShrink: 0, marginTop: 9 }} />
                                                <p style={{ fontSize: '1rem', color: '#475569', lineHeight: 1.75, margin: 0 }}>{para}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>

                {/* Agreement Box */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{ marginTop: 56, padding: '36px 40px', borderRadius: 20, background: '#fafafa', border: '1.5px solid #e2e8f0' }}
                >
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 12px' }}>By Using This Platform, You Agree</h3>
                    <p style={{ fontSize: '0.95rem', color: '#64748b', lineHeight: 1.7, margin: '0 0 20px' }}>
                        Clicking <strong style={{ color: '#0f172a' }}>"Proceed to Checkout"</strong> on our pricing tools constitutes your electronic signature and full acceptance of these manufacturing terms.
                    </p>
                    <Link to="/privacy-policy" style={{ fontSize: '0.85rem', color: '#6366f1', fontWeight: 700, textDecoration: 'none' }}>
                        ← Read our Privacy Policy
                    </Link>
                </motion.div>
            </main>
        </div>
    );
};

export default TermsOfService;
