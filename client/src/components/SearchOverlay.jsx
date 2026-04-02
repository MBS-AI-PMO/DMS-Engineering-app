/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import OptimizedImage from './OptimizedImage';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Box, Settings, ArrowRight, Command } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchMetals, fetchServices } from '../utils/api';

const SearchOverlay = ({ isOpen, onClose }) => {
    const [query, setQuery] = useState('');
    const [metals, setMetals] = useState([]);
    const [services, setServices] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (!isOpen) {
            setIsLoading(false);
            return;
        }

        let ignore = false;
        setIsLoading(true);

        const loadData = async () => {
            try {
                const [metalsData, servicesData] = await Promise.all([
                    fetchMetals(),
                    fetchServices()
                ]);
                if (!ignore) {
                    setMetals(metalsData || []);
                    setServices(servicesData || []);
                }
            } finally {
                if (!ignore) setIsLoading(false);
            }
        };

        loadData();

        // Auto-focus input
        const focusTimeout = setTimeout(() => inputRef.current?.focus(), 100);
        setQuery('');
        setSelectedIndex(0);

        return () => {
            ignore = true;
            clearTimeout(focusTimeout);
        };
    }, [isOpen]);

    const filteredResults = useMemo(() => {
        if (!query.trim()) return { metals: [], services: [] };

        const q = query.toLowerCase();
        const fMetals = metals.filter(m =>
            m.name.toLowerCase().includes(q) ||
            m.category_name?.toLowerCase().includes(q)
        ).slice(0, 5);

        const fServices = services.filter(s =>
            s.title.toLowerCase().includes(q) ||
            s.description?.toLowerCase().includes(q)
        ).slice(0, 5);

        return { metals: fMetals, services: fServices };
    }, [query, metals, services]);

    const allResults = useMemo(() => [
        ...filteredResults.metals.map(m => ({ ...m, type: 'metal' })),
        ...filteredResults.services.map(s => ({ ...s, type: 'service' }))
    ], [filteredResults.metals, filteredResults.services]);

    const handleNavigate = useCallback((item) => {
        onClose();
        if (item.type === 'metal') {
            navigate(`/metal/${item.slug}`);
        } else {
            navigate('/get-instant-pricing');
        }
    }, [navigate, onClose]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;

            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % Math.max(1, allResults.length));
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + allResults.length) % Math.max(1, allResults.length));
            }
            if (e.key === 'Enter') {
                const selected = allResults[selectedIndex];
                if (selected) {
                    handleNavigate(selected);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, allResults, selectedIndex, onClose, handleNavigate]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="search-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="search-modal-container"
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="search-input-wrapper">
                            <Search size={20} className="text-muted" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Search metals, services, and more..."
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                    setSelectedIndex(0);
                                }}
                            />
                            <div className="search-shortcut-hint">ESC</div>
                        </div>

                        <div className="search-results-area">
                            {!query && (
                                <div className="search-empty">
                                    <p>Start typing to search our premium metal inventory and services...</p>
                                </div>
                            )}

                            {query && allResults.length === 0 && !isLoading && (
                                <div className="search-empty">
                                    <p>No results found for "{query}"</p>
                                </div>
                            )}

                            {filteredResults.metals.length > 0 && (
                                <div className="search-result-group">
                                    <h4 className="search-group-title">Metals & Materials</h4>
                                    {filteredResults.metals.map((metal, idx) => {
                                        const globalIdx = idx;
                                        return (
                                            <div
                                                key={metal.id}
                                                className={`search-item ${selectedIndex === globalIdx ? 'selected' : ''}`}
                                                onClick={() => handleNavigate({ ...metal, type: 'metal' })}
                                                onMouseEnter={() => setSelectedIndex(globalIdx)}
                                            >
                                                <div className="search-item-thumb">
                                                    <OptimizedImage src={metal.image_path} alt={metal.name} />
                                                </div>
                                                <div className="search-item-info">
                                                    <div className="search-item-title">{metal.name}</div>
                                                    <div className="search-item-desc">{metal.category_name} • {metal.thickness || 'Custom'}</div>
                                                </div>
                                                <ArrowRight size={16} className="search-arrow" />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {filteredResults.services.length > 0 && (
                                <div className="search-result-group">
                                    <h4 className="search-group-title">Manufacturing Services</h4>
                                    {filteredResults.services.map((svc, idx) => {
                                        const globalIdx = filteredResults.metals.length + idx;
                                        return (
                                            <div
                                                key={svc.id}
                                                className={`search-item ${selectedIndex === globalIdx ? 'selected' : ''}`}
                                                onClick={() => handleNavigate({ ...svc, type: 'service' })}
                                                onMouseEnter={() => setSelectedIndex(globalIdx)}
                                            >
                                                <div className="search-item-thumb">
                                                    <OptimizedImage src={svc.image_path} alt={svc.title} />
                                                </div>
                                                <div className="search-item-info">
                                                    <div className="search-item-title">{svc.title}</div>
                                                    <div className="search-item-desc">{svc.description}</div>
                                                </div>
                                                <ArrowRight size={16} className="search-arrow" />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="search-footer">
                            <div className="search-keyboard-hint">
                                <span className="search-keyboard-key"><Command size={10} /></span>
                                <span className="search-keyboard-key">K</span>
                                <span>to focus</span>
                            </div>
                            <div className="search-keyboard-hint">
                                <span className="search-keyboard-key">↑↓</span>
                                <span>to navigate</span>
                            </div>
                            <div className="search-keyboard-hint">
                                <span className="search-keyboard-key">ENTER</span>
                                <span>to select</span>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SearchOverlay;
