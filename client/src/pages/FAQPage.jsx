import React, { useState, useMemo, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Info, Clock, FileCode, Truck, HelpCircle, ChevronDown, Filter } from 'lucide-react';
import { faqData as staticFaqData, faqCategories as staticFaqCategories } from '../data/faqData';
import { fetchFaqs, fetchFaqCategories } from '../utils/api';
import faqHeroImg from '../assets/faq-hero.jpg';

const CategoryIcon = ({ icon, size = 24 }) => {
    switch (icon) {
        case 'Info': return <Info size={size} />;
        case 'Clock': return <Clock size={size} />;
        case 'FileCode': return <FileCode size={size} />;
        case 'Truck': return <Truck size={size} />;
        default: return <HelpCircle size={size} />;
    }
};

const FAQPageItem = ({ item }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className={`faq-item-custom ${isOpen ? 'active' : ''}`}>
            <button className="faq-question-row" onClick={() => setIsOpen(!isOpen)}>
                <div className="faq-icon-circle">
                    {isOpen ? '−' : '+'}
                </div>
                <h3 className="faq-question-text">{item.question}</h3>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="faq-answer-row"
                    >
                        <p className="faq-answer-text">{item.answer}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const FAQPage = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('recent');
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const categoryDropdownRef = React.useRef(null);
    const [faqData, setFaqData] = useState(staticFaqData);
    const [faqCategories, setFaqCategories] = useState(staticFaqCategories);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadFaqs() {
            try {
                const [faqs, cats] = await Promise.all([fetchFaqs(), fetchFaqCategories()]);
                // Transform DB format to match static format
                setFaqData(faqs.map(f => ({
                    id: f.id,
                    question: f.question,
                    answer: f.answer,
                    category: f.category_slug || f.category_id,
                })));
                setFaqCategories(cats.map(c => ({
                    id: c.slug || c.id,
                    title: c.name,
                    icon: c.icon || 'HelpCircle',
                })));
                if (cats.length > 0) setActiveCategory(cats[0].slug || String(cats[0].id));
            } catch (err) {
                console.warn('API unavailable, using static FAQ data:', err.message);
            } finally {
                setLoading(false);
            }
        }
        loadFaqs();
    }, []);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
                setIsCategoryDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredFaqs = useMemo(() => {
        const query = searchQuery.toLowerCase();
        if (!query) {
            return faqData.filter(item => item.category === activeCategory);
        }
        // Global search when query is present
        return faqData.filter(item =>
            item.question.toLowerCase().includes(query) ||
            item.answer.toLowerCase().includes(query)
        );
    }, [searchQuery, activeCategory, faqData]);

    return (
        <div className="faq-page">
            {/* Header Section */}
            <section className="faq-page-header" style={{ backgroundImage: `url(${faqHeroImg})` }}>
                <div className="faq-hero-overlay"></div>
                <div className="container faq-hero-container">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="faq-hero-content"
                    >
                        <h1 className="faq-page-title">
                            How can we <span className="highlight">help?</span>
                        </h1>
                        <p className="faq-page-subtitle">Search our knowledge base or browse by category below.</p>

                        <div className="faq-search-wrapper">
                            <Search className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search for questions (e.g., lead times, file formats...)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Categories & Questions Section */}
            <section className="faq-page-content">
                <div className="container">
                    {/* Mobile Category Dropdown */}
                    <div className="category-mobile-select-wrapper" ref={categoryDropdownRef}>
                        <div className="category-mobile-header">
                            <span>Categories</span>
                        </div>
                        <div
                            className="category-mobile-select"
                            onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                        >
                            <div className="selected-category-info">
                                <Filter size={18} className="filter-icon" />
                                <span className="selected-category-text">
                                    {faqCategories.find(c => c.id === activeCategory)?.title || 'SELECT CATEGORY'}
                                </span>
                            </div>
                            <ChevronDown
                                size={20}
                                className={`dropdown-arrow ${isCategoryDropdownOpen ? 'open' : ''}`}
                            />

                            <AnimatePresence>
                                {isCategoryDropdownOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="category-dropdown-menu"
                                    >
                                        {faqCategories.map(cat => (
                                            <div
                                                key={cat.id}
                                                className={`dropdown-item ${activeCategory === cat.id ? 'active' : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveCategory(cat.id);
                                                    setIsCategoryDropdownOpen(false);
                                                }}
                                            >
                                                {cat.title}
                                            </div>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    <div className="faq-layout">
                        {/* Sidebar: Categories (Desktop Only) */}
                        <aside className="faq-sidebar">
                            <h3 className="sidebar-title">Categories</h3>
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <div key={i} className="skeleton skeleton-category-btn"></div>
                                ))
                            ) : faqCategories.map(cat => (
                                <button
                                    key={cat.id}
                                    className={`category-btn ${activeCategory === cat.id ? 'active' : ''}`}
                                    onClick={() => setActiveCategory(cat.id)}
                                >
                                    <span>{cat.title.toUpperCase()}</span>
                                </button>
                            ))}
                        </aside>

                        {/* Main: Questions */}
                        <main className="faq-main-content">
                            {filteredFaqs.length > 0 ? (
                                <div className="faq-results">
                                    <h2 className="category-results-title">
                                        {searchQuery ? `Search Results for "${searchQuery}"` : faqCategories.find(c => c.id === activeCategory)?.title}
                                    </h2>
                                    <div className="faq-grid">
                                        {filteredFaqs.map(item => (
                                            <FAQPageItem key={item.id} item={item} />
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="no-results">
                                    <Search size={48} />
                                    <p>We couldn't find any questions matching "{searchQuery}"</p>
                                    <button className="clear-btn" onClick={() => setSearchQuery('')}>Clear Search</button>
                                </div>
                            )}
                        </main>
                    </div>
                </div>
            </section>

            {/* Support CTA */}
            <section className="faq-cta">
                <div className="container">
                    <div className="cta-box">
                        <h2>Still have questions?</h2>
                        <p>Our expert support team is here to help you via email or phone.</p>
                        <div className="cta-actions">
                            <button className="btn-contact-support">CONTACT SUPPORT</button>
                            <button className="btn-call-us">TALK TO AN ENGINEER</button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default FAQPage;
