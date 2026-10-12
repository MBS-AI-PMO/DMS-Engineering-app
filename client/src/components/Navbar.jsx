import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Menu, X, Search, ChevronDown, Settings, LogOut, ShoppingBag, Package, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext.js';
import { fetchSettings } from '../utils/api';
import SearchOverlay from './SearchOverlay';
import '../styles/SiteNav.css';

/**
 * The site's top bar: one slim dark bar pinned to the top of the window,
 * logo and plain-word links on the left, search, cart, account and the one
 * red action on the right. Below 900 px the links move into a full-height
 * sheet. A spacer of the bar's height keeps the page below it where it was.
 */

const NAV_LINKS = [
  { name: 'Metals', path: '/metals' },
  { name: 'Services', path: '/services' },
  { name: 'Guidelines', path: '/guidelines' },
  { name: 'FAQ', path: '/faq' },
  { name: 'Contact', path: '/contact' },
];

const MotionDiv = motion.div;

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [logo, setLogo] = useState(localStorage.getItem('navbar_logo') || '/logo.webp');
  const [seenPath, setSeenPath] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { cartItems } = useCart();
  const dropdownRef = useRef(null);
  const reduceMotion = useReducedMotion();

  // Menus close when the page changes (adjusted during render, as React
  // recommends for state that follows a value).
  if (seenPath !== location.pathname) {
    setSeenPath(location.pathname);
    setMobileMenuOpen(false);
    setDropdownOpen(false);
  }

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetchSettings()
      .then(data => {
        if (data.navbar_logo) {
          setLogo(data.navbar_logo);
          localStorage.setItem('navbar_logo', data.navbar_logo);
        }
      })
      .catch(err => console.error('Failed to load navbar logo:', err));
  }, []);

  // Close the account menu on a click outside it.
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search on Ctrl+K (Cmd+K) or "/"; Escape closes the open menu.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === '/') {
        const tag = document.activeElement?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !document.activeElement?.isContentEditable) {
          e.preventDefault();
          setIsSearchOpen(true);
        }
      }
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // The page behind the open phone menu does not scroll.
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    await logout();
    navigate('/');
  };

  const handleLogoError = () => {
    localStorage.removeItem('navbar_logo');
    setLogo('/logo.webp');
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'Account';
  const initial = (firstName?.[0] || 'U').toUpperCase();
  const cartCount = cartItems.length;
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
  const sheetMotion = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
    : {
      initial: { x: '100%' },
      animate: { x: 0 },
      exit: { x: '100%' },
      transition: { type: 'tween', duration: 0.32, ease: [0.22, 1, 0.36, 1] },
    };

  return (
    <>
      <header className={`sn${isScrolled ? ' is-scrolled' : ''}`}>
        <div className="sn-bar">
          <Link to="/" className="sn-logo" aria-label="Home">
            <img src={logo} alt="DMS" decoding="async" onError={handleLogoError} />
          </Link>

          <nav className="sn-links" aria-label="Main">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`sn-link${active ? ' is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          <div className="sn-actions">
            <button
              type="button"
              className="sn-search"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Search"
              title={`Search (${isMac ? '⌘' : 'Ctrl'} K)`}
            >
              <Search size={15} aria-hidden="true" />
              <span className="sn-search-text">Search</span>
              <kbd className="sn-kbd">{isMac ? '⌘' : 'Ctrl'} K</kbd>
            </button>

            <Link
              to="/cart"
              className={`sn-icon${isActive('/cart') ? ' is-active' : ''}`}
              aria-label={cartCount ? `Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Cart'}
            >
              <ShoppingBag size={18} aria-hidden="true" />
              {cartCount > 0 && <span className="sn-count" aria-hidden="true">{cartCount > 99 ? '99+' : cartCount}</span>}
            </Link>

            <span className="sn-divider" aria-hidden="true" />

            {!user && (
              <Link to="/login" className="sn-login">Log in</Link>
            )}

            <Link to="/get-instant-pricing" className="sn-cta">
              Instant pricing
            </Link>

            {user && (
              <div className="sn-user" ref={dropdownRef}>
                <button
                  type="button"
                  className="sn-user-trigger"
                  onClick={() => setDropdownOpen(open => !open)}
                  aria-haspopup="menu"
                  aria-expanded={dropdownOpen}
                  aria-label={`Account: ${firstName}`}
                >
                  <span className="sn-avatar" aria-hidden="true">{initial}</span>
                  <ChevronDown size={14} className={`sn-chevron${dropdownOpen ? ' is-open' : ''}`} aria-hidden="true" />
                </button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <MotionDiv
                      className="sn-menu"
                      role="menu"
                      initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                      transition={{ duration: reduceMotion ? 0 : 0.14, ease: 'easeOut' }}
                    >
                      <div className="sn-menu-head">
                        <span className="sn-menu-name">{user.name || firstName}</span>
                        {user.email && <span className="sn-menu-email">{user.email}</span>}
                      </div>
                      <Link to="/orders" className="sn-menu-item" role="menuitem">
                        <Package size={15} aria-hidden="true" />
                        My orders
                      </Link>
                      <Link to="/settings" className="sn-menu-item" role="menuitem">
                        <Settings size={15} aria-hidden="true" />
                        Settings
                      </Link>
                      <button type="button" className="sn-menu-item is-quiet" role="menuitem" onClick={handleLogout}>
                        <LogOut size={15} aria-hidden="true" />
                        Log out
                      </button>
                    </MotionDiv>
                  )}
                </AnimatePresence>
              </div>
            )}

            <button
              type="button"
              className="sn-menu-btn"
              onClick={() => setMobileMenuOpen(open => !open)}
              aria-expanded={mobileMenuOpen}
              aria-controls="sn-sheet"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <MotionDiv id="sn-sheet" className="sn-sheet" {...sheetMotion}>
              <nav className="sn-sheet-links" aria-label="Main">
                {NAV_LINKS.map((link) => {
                  const active = isActive(link.path);
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      className={`sn-sheet-link${active ? ' is-active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                    >
                      {link.name}
                    </Link>
                  );
                })}
              </nav>

              <div className="sn-sheet-foot">
                {user ? (
                  <div className="sn-sheet-account">
                    <span className="sn-sheet-who">
                      <span className="sn-avatar" aria-hidden="true">{initial}</span>
                      <span>{user.name || firstName}</span>
                    </span>
                    <Link to="/orders" className="sn-sheet-item"><Package size={17} aria-hidden="true" /> My orders</Link>
                    <Link to="/settings" className="sn-sheet-item"><Settings size={17} aria-hidden="true" /> Settings</Link>
                    <button type="button" className="sn-sheet-item" onClick={handleLogout}><LogOut size={17} aria-hidden="true" /> Log out</button>
                  </div>
                ) : (
                  <Link to="/login" className="sn-sheet-item">Log in</Link>
                )}
                <button type="button" className="sn-sheet-item" onClick={() => { setMobileMenuOpen(false); setIsSearchOpen(true); }}>
                  <Search size={17} aria-hidden="true" /> Search
                </button>
                <Link to="/get-instant-pricing" className="sn-sheet-cta">
                  Instant pricing
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>
      </header>
      <div className="sn-spacer" aria-hidden="true" />

      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
};

export default Navbar;
