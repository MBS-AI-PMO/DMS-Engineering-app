/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, Box, Tag, HelpCircle, FolderOpen, Wrench, Shield, Mail, Users,
    LogOut, Menu, X, ChevronRight, FileText, UserCheck, DollarSign, ShoppingBag
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
    { to: '/admin/metals', label: 'Metals', icon: Box },
    { to: '/admin/categories', label: 'Categories', icon: Tag },
    { to: '/admin/faqs', label: 'FAQs', icon: HelpCircle },
    { to: '/admin/faq-categories', label: 'FAQ Categories', icon: FolderOpen },
    { to: '/admin/services', label: 'Services', icon: Wrench },
    { to: '/admin/pricing', label: 'Pricing Configuration', icon: DollarSign },
    { to: '/admin/guidelines', label: 'Guidelines', icon: FileText },

    { to: '/admin/customers', label: 'Customers', icon: UserCheck },
    { to: '/admin/admins', label: 'Admins', icon: Shield },
    { to: '/admin/email', label: 'Email Config', icon: Mail },
    { to: '/admin/subscribers', label: 'Subscribers', icon: Users },
    { to: '/admin/contact', label: 'Contact', icon: Mail },
];

export default function AdminLayout({ children }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);

    // Handle resize
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth <= 1024;
            setIsMobile(mobile);
            if (!mobile) setSidebarOpen(true);
            else setSidebarOpen(false);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleLogout = async () => {
        await logout();
        navigate('/admin/login');
    };

    return (
        <div className={`admin-shell ${isMobile ? 'is-mobile' : ''} ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            {/* Mobile Overlay */}
            <AnimatePresence>
                {isMobile && sidebarOpen && (
                    <motion.div
                        className="admin-sidebar-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSidebarOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <motion.aside
                className="admin-sidebar"
                initial={false}
                animate={{
                    width: isMobile ? 280 : (sidebarOpen ? 240 : 64),
                    x: isMobile && !sidebarOpen ? -280 : 0
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
                <div className="admin-sidebar-header">
                    <AnimatePresence>
                        {(sidebarOpen || isMobile) && (
                            <motion.span
                                className="admin-logo-text"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                DMS Admin
                            </motion.span>
                        )}
                    </AnimatePresence>
                    <button
                        className="admin-sidebar-toggle"
                        onClick={() => setSidebarOpen(o => !o)}
                    >
                        {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
                    </button>
                </div>
                <nav className="admin-nav" onClick={() => isMobile && setSidebarOpen(false)}>
                    {navItems.map(({ to, label, icon: IconComponent, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) =>
                                `admin-nav-item${isActive ? ' active' : ''}`
                            }
                        >
                            <IconComponent size={20} className="admin-nav-icon" />
                            <AnimatePresence>
                                {(sidebarOpen || isMobile) && (
                                    <motion.span
                                        className="admin-nav-label"
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -8 }}
                                        transition={{ duration: 0.15 }}
                                    >
                                        {label}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </NavLink>
                    ))}
                </nav>

                <div className="admin-sidebar-footer">
                    <button className="admin-nav-item logout-btn" onClick={handleLogout}>
                        <LogOut size={20} className="admin-nav-icon" />
                        <AnimatePresence>
                            {(sidebarOpen || isMobile) && (
                                <motion.span
                                    className="admin-nav-label"
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -8 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    Logout
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </button>
                </div>
            </motion.aside>

            {/* Main */}
            <div className="admin-main">
                <header className="admin-topbar">
                    <div className="admin-topbar-left">
                        {isMobile && (
                            <button className="admin-mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
                                <Menu size={20} />
                            </button>
                        )}
                        <div className="admin-topbar-breadcrumb">
                            <ChevronRight size={16} />
                        </div>
                    </div>
                    <div className="admin-topbar-user">
                        <div className="admin-user-avatar">
                            {user?.name?.[0]?.toUpperCase() || 'A'}
                        </div>
                        <span className="admin-user-name">{user?.name || user?.email}</span>
                    </div>
                </header>
                <main className="admin-content">
                    {children}
                </main>
            </div>
        </div>
    );
}
