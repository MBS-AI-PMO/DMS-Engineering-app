import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { Menu, X, Search, User, ChevronDown, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Close dropdown on route change
    useEffect(() => {
        setDropdownOpen(false);
        setMobileMenuOpen(false);
    }, [location.pathname]);

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'Account';

    const navLinks = [
        { name: 'Metals', path: '/metals' },
        { name: 'Services', path: '/#services' },
        { name: 'Guidelines', path: '/guidelines' },
        { name: 'Contact', path: '/contact' },
    ];

    return (
        <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
            <div className="container navbar-container">
                <div className="navbar-left">
                    <Link to="/" className="logo">
                        <div className="logo-icon">D</div>
                        <span>DMS <span className="logo-sep">|</span> <span className="logo-tag">Engineering</span></span>
                    </Link>
                </div>

                <div className="navbar-center">
                    <ul className="nav-links">
                        {navLinks.map((link) => (
                            <li key={link.name}>
                                <Link
                                    to={link.path}
                                    className={location.pathname === link.path ? 'active' : ''}
                                >
                                    {link.name}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="navbar-right">
                    <div className="navbar-actions">
                        <button className="icon-btn search-trigger">
                            <Search size={20} />
                        </button>
                        <Link to="/get-instant-pricing" className="btn-pricing-nav">
                            Instant Pricing
                        </Link>

                        {user ? (
                            <div className="user-menu" ref={dropdownRef}>
                                <button
                                    className="user-menu-trigger"
                                    onClick={() => setDropdownOpen(o => !o)}
                                >
                                    <div className="user-menu-avatar">
                                        {firstName[0].toUpperCase()}
                                    </div>
                                    <span className="user-menu-name">{firstName}</span>
                                    <ChevronDown
                                        size={14}
                                        className={`user-menu-chevron${dropdownOpen ? ' open' : ''}`}
                                    />
                                </button>

                                <AnimatePresence>
                                    {dropdownOpen && (
                                        <motion.div
                                            className="user-dropdown"
                                            initial={{ opacity: 0, y: -8, scale: 0.97 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -8, scale: 0.97 }}
                                            transition={{ duration: 0.15, ease: 'easeOut' }}
                                        >
                                            <div className="user-dropdown-header">
                                                <span className="user-dropdown-name">{user.name || user.email}</span>
                                                <span className="user-dropdown-email">{user.email}</span>
                                            </div>
                                            <div className="user-dropdown-divider" />
                                            <Link to="/settings" className="user-dropdown-item">
                                                <Settings size={16} />
                                                Settings
                                            </Link>
                                            <button className="user-dropdown-item user-dropdown-logout" onClick={handleLogout}>
                                                <LogOut size={16} />
                                                Logout
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <Link to="/login" className="btn-login-nav">
                                <User size={18} />
                                <span>Login</span>
                            </Link>
                        )}
                    </div>

                    <button
                        className="mobile-toggle"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="mobile-menu"
                    >
                        <div className="mobile-menu-header">
                            <Link to="/" className="logo" onClick={() => setMobileMenuOpen(false)}>
                                <div className="logo-icon">D</div>
                                <span>DMS</span>
                            </Link>
                            <button className="mobile-close" onClick={() => setMobileMenuOpen(false)}>
                                <X size={24} />
                            </button>
                        </div>

                        <div className="mobile-menu-links">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    to={link.path}
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    {link.name}
                                </Link>
                            ))}
                            <Link to="/get-instant-pricing" className="mobile-cta" onClick={() => setMobileMenuOpen(false)}>
                                Instant Pricing
                            </Link>

                            <div className="mobile-menu-divider" />

                            {user ? (
                                <div className="mobile-user-section">
                                    <Link to="/settings" className="mobile-user-link" onClick={() => setMobileMenuOpen(false)}>
                                        <Settings size={20} /> Settings
                                    </Link>
                                    <button className="mobile-user-link mobile-logout" onClick={() => { setMobileMenuOpen(false); handleLogout(); }}>
                                        <LogOut size={20} /> Logout
                                    </button>
                                </div>
                            ) : (
                                <Link to="/login" className="mobile-user-link" onClick={() => setMobileMenuOpen(false)}>
                                    <User size={20} /> Login
                                </Link>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
};

export default Navbar;
