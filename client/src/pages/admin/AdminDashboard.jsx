/* eslint-disable no-unused-vars */
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Box, Tag, HelpCircle, FolderOpen, Wrench, Shield, ArrowRight, Mail, Users, DollarSign } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { fetchMetals, fetchCategories, fetchFaqs, fetchFaqCategories, fetchServices, fetchAdminUsers, fetchServicesWithUsage, fetchPricingMetadata } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import Skeleton from '../../components/Skeleton';

const statCards = [
    { label: 'Metals', icon: Box, to: '/admin/metals', fetch: fetchMetals },
    { label: 'Categories', icon: Tag, to: '/admin/categories', fetch: fetchCategories },
    { label: 'FAQs', icon: HelpCircle, to: '/admin/faqs', fetch: fetchFaqs },
    { label: 'FAQ Categories', icon: FolderOpen, to: '/admin/faq-categories', fetch: fetchFaqCategories },
    { label: 'Services', icon: Wrench, to: '/admin/services', fetch: fetchServices },
    { label: 'Admins', icon: Shield, to: '/admin/admins', fetch: fetchAdminUsers },
];

export default function AdminDashboard() {
    const { admin } = useAdminAuth();
    const navigate = useNavigate();
    const [counts, setCounts] = useState({});
    const [countsLoading, setCountsLoading] = useState(true);
    const [servicesUsage, setServicesUsage] = useState([]);
    const [servicesLoading, setServicesLoading] = useState(true);
    const toast = useToast();

    useEffect(() => {
        let isMounted = true;

        const loadCounts = async () => {
            setCountsLoading(true);
            try {
                const pairs = await Promise.all(
                    statCards.map(async ({ label, fetch: fn }) => {
                        try {
                            const data = await fn();
                            return [label, Array.isArray(data) ? data.length : '—'];
                        } catch {
                            return [label, '—'];
                        }
                    })
                );
                if (!isMounted) return;
                setCounts(Object.fromEntries(pairs));
            } finally {
                if (isMounted) setCountsLoading(false);
            }
        };

        const loadServicesUsage = async () => {
            setServicesLoading(true);
            try {
                const data = await fetchServicesWithUsage();
                if (!isMounted) return;
                setServicesUsage(data || []);
            } catch (err) {
                if (isMounted) toast('Failed to load services usage: ' + err.message, 'error');
            } finally {
                if (isMounted) setServicesLoading(false);
            }
        };

        loadCounts();
        loadServicesUsage();

        return () => {
            isMounted = false;
        };
    }, [toast]);

    return (
        <div className="admin-dashboard">
            <header className="admin-page-header">
                <h1 className="admin-page-title">Analytics Overview</h1>
                <div className="admin-page-actions">
                    <span className="admin-date-pill">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
            </header>

            <motion.div
                className="admin-dashboard-hero"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
            >
                <div className="admin-hero-content">
                    <h2>Welcome back, {admin?.name?.split(' ')[0] || 'Admin'}!</h2>
                    <p>Here's what's happening with Direct Metal Service today.</p>
                </div>
            </motion.div>

            <div className="admin-stats-grid">
                {statCards.map(({ label, icon: IconComponent, to }, i) => (
                    <motion.div
                        key={label}
                        className="admin-stat-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.05 }}
                        onClick={() => navigate(to)}
                    >
                        <div className="stat-card-icon"><IconComponent size={24} /></div>
                        <div className="stat-card-body">
                            {countsLoading ? (
                                <Skeleton variant="text" style={{ width: '56px', height: '28px', marginBottom: '4px' }} />
                            ) : (
                                <span className="stat-count">{counts[label] ?? '—'}</span>
                            )}
                            <span className="stat-label">{label}</span>
                        </div>
                        <div className="stat-card-link">
                            <ArrowRight size={18} />
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="admin-dashboard-sections">
                <section className="admin-dashboard-section">
                    <h3 className="section-subtitle">Quick Actions</h3>
                    <div className="quick-actions-grid">
                        <Link to="/admin/metals/new" className="quick-action-card">
                            <Box size={20} />
                            <span>Add New Metal</span>
                        </Link>
                        <Link to="/admin/services" className="quick-action-card">
                            <Wrench size={20} />
                            <span>Manage Services</span>
                        </Link>
                        <Link to="/admin/subscribers" className="quick-action-card">
                            <Users size={20} />
                            <span>View Subscribers</span>
                        </Link>
                        <Link to="/admin/email" className="quick-action-card">
                            <Mail size={20} />
                            <span>Email Settings</span>
                        </Link>
                    </div>
                </section>

                {(servicesLoading || servicesUsage.length > 0) && (
                    <section className="admin-dashboard-section">
                        <h3 className="section-subtitle">Services Overview</h3>
                        <div className="services-usage-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                            gap: 12,
                        }}>
                            {servicesLoading
                                ? [...Array(6)].map((_, i) => (
                                    <div
                                        key={`svc-skel-${i}`}
                                        style={{
                                            background: '#fff',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: 10,
                                            padding: '14px 16px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <div style={{ flex: 1 }}>
                                            <Skeleton variant="text" style={{ width: i % 2 === 0 ? '58%' : '72%', height: '15px', marginBottom: '8px' }} />
                                            <Skeleton variant="text" style={{ width: i % 3 === 0 ? '82%' : '68%', height: '12px' }} />
                                        </div>
                                        <Skeleton variant="rectangle" style={{ width: '74px', height: '24px', borderRadius: 20, marginLeft: 12 }} />
                                    </div>
                                ))
                                : servicesUsage.map((svc, i) => (
                                    <motion.div
                                        key={svc.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 + i * 0.03 }}
                                        style={{
                                            background: '#fff',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: 10,
                                            padding: '14px 16px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                        }}
                                        onClick={() => navigate('/admin/services')}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1a1a2e' }}>
                                                {svc.title}
                                            </div>
                                            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 2 }}>
                                                {svc.description?.substring(0, 50)}{svc.description?.length > 50 ? '...' : ''}
                                            </div>
                                        </div>
                                        <div style={{
                                            background: parseInt(svc.metal_count) > 0 ? '#ecfdf5' : '#f3f4f6',
                                            color: parseInt(svc.metal_count) > 0 ? '#065f46' : '#6b7280',
                                            borderRadius: 20,
                                            padding: '4px 10px',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            whiteSpace: 'nowrap',
                                            marginLeft: 12,
                                        }}>
                                            {svc.metal_count} metal{parseInt(svc.metal_count) !== 1 ? 's' : ''}
                                        </div>
                                    </motion.div>
                                ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}