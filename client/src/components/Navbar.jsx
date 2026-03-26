import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { Menu, X, Search, User, ChevronDown } from 'lucide-react';

const Navbar = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

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
                        <button className="btn-login-nav">
                            <User size={18} />
                            <span>Login</span>
                        </button>
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
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="mobile-menu"
                    >
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
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
};

export default Navbar;
