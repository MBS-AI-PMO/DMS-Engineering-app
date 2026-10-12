import React, { useState, useMemo, useEffect, useId } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { ArrowRight, Plus, Search, X } from 'lucide-react';
import { faqData as staticFaqData, faqCategories as staticFaqCategories } from '../data/faqData';
import { fetchFaqs, fetchFaqCategories } from '../utils/api';
import faqHeroImg from '../assets/faq-hero.jpg';
import '../styles/Shimmer.css';
import '../styles/FaqPage.css';

/**
 * The FAQ page: a heading band over the parts photo with a search box,
 * then the topics down the left (they stay in view) and the questions of
 * the one picked on the right, opened one at a time. Searching looks
 * through every topic. The picked topic is kept in the address
 * (?topic=bending) so a link can open it. Topics, counts and questions
 * shimmer until they have loaded.
 */

// Topic names are typed in capitals ("MOST ASKED QUESTIONS"); show them in
// normal case. Names typed any other way are left alone.
const topicName = (name = '') => {
    if (!/[A-Z]/.test(name) || name !== name.toUpperCase()) return name;
    const lower = name.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
};

// The question with the searched words marked.
const Highlight = ({ text, query }) => {
    const q = query.trim();
    if (!q) return text;
    const parts = String(text).split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
    return parts.map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part));
};

const QuestionList = ({ items, query, topicOf }) => {
    const [openId, setOpenId] = useState(null);
    const baseId = useId();

    return (
        <ul className="fp-list">
            {items.map((item, index) => {
                const isOpen = openId === item.id;
                const buttonId = `${baseId}-q${index}`;
                const panelId = `${baseId}-a${index}`;
                return (
                    <li key={item.id} className={`fp-item${isOpen ? ' is-open' : ''}`}>
                        <h3 className="fp-q">
                            <button
                                type="button"
                                id={buttonId}
                                className="fp-q-btn"
                                aria-expanded={isOpen}
                                aria-controls={panelId}
                                onClick={() => setOpenId(isOpen ? null : item.id)}
                            >
                                <span className="fp-q-text">
                                    {topicOf && <span className="fp-q-topic">{topicOf(item)}</span>}
                                    <span className="fp-q-label"><Highlight text={item.question} query={query} /></span>
                                </span>
                                <span className="fp-q-icon" aria-hidden="true"><Plus size={16} /></span>
                            </button>
                        </h3>
                        {/* Closed answers stay in the page for the height animation;
                            inert keeps them out of Tab and screen readers. */}
                        <div id={panelId} className="fp-a" role="region" aria-labelledby={buttonId} inert={!isOpen}>
                            <div className="fp-a-inner">
                                <p className="fp-a-text">{item.answer}</p>
                            </div>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
};

const FAQPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState('');
    const [faqData, setFaqData] = useState([]);
    const [faqCategories, setFaqCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        let cancelled = false;
        async function loadFaqs() {
            try {
                const [faqs, cats] = await Promise.all([fetchFaqs(), fetchFaqCategories()]);
                if (cancelled) return;
                setFaqData(faqs.map(f => ({
                    id: f.id,
                    question: f.question,
                    answer: f.answer,
                    category: f.category_slug || String(f.category_id),
                })));
                setFaqCategories(cats.map(c => ({
                    id: c.slug || String(c.id),
                    title: c.name,
                })));
            } catch (err) {
                if (cancelled) return;
                console.warn('API unavailable, using static FAQ data:', err.message);
                setFaqData(staticFaqData.map((f, i) => ({ ...f, id: f.id ?? `static-${i}` })));
                setFaqCategories(staticFaqCategories);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        loadFaqs();
        return () => { cancelled = true; };
    }, []);

    // Topics with at least one question, with their counts.
    const topics = useMemo(() => {
        const counts = new Map();
        faqData.forEach(f => counts.set(f.category, (counts.get(f.category) || 0) + 1));
        return faqCategories
            .filter(c => counts.has(c.id))
            .map(c => ({ ...c, name: topicName(c.title), count: counts.get(c.id) }));
    }, [faqData, faqCategories]);

    const requested = searchParams.get('topic');
    const activeTopic = topics.find(t => t.id === requested) || topics[0];
    const topicById = useMemo(() => new Map(topics.map(t => [t.id, t.name])), [topics]);

    const pickTopic = (id) => {
        setSearchQuery('');
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('topic', id);
            return next;
        }, { replace: true });
    };

    const query = searchQuery.trim().toLowerCase();
    // Search results: one entry per question, even when admin filed the
    // same question under several topics; all its topics are listed.
    const results = useMemo(() => {
        if (!query) return [];
        const byText = new Map();
        faqData.forEach(item => {
            if (!item.question.toLowerCase().includes(query) && !item.answer.toLowerCase().includes(query)) return;
            const key = `${item.question.trim().toLowerCase()}||${item.answer.trim().toLowerCase()}`;
            const found = byText.get(key);
            if (found) {
                if (!found.categories.includes(item.category)) found.categories.push(item.category);
            } else {
                byText.set(key, { ...item, categories: [item.category] });
            }
        });
        return [...byText.values()];
    }, [faqData, query]);
    const topicQuestions = useMemo(
        () => (activeTopic ? faqData.filter(item => item.category === activeTopic.id) : []),
        [faqData, activeTopic]
    );

    const fade = reduceMotion
        ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
        : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 }, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } };

    return (
        <div className="fp">
            {/* ── Heading band ── */}
            <section className="fp-hero" aria-labelledby="fp-title">
                <img className="fp-hero-img" src={faqHeroImg} alt="" aria-hidden="true" loading="eager" fetchPriority="high" decoding="async" />
                <div className="fp-hero-shade" aria-hidden="true" />
                <div className="fp-inner fp-hero-content">
                    <nav className="fp-crumbs" aria-label="Breadcrumb">
                        <Link to="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">FAQ</span>
                    </nav>
                    <h1 id="fp-title" className="fp-title">How can we help?</h1>
                    <p className="fp-lede">Search every answer, or browse by topic below.</p>

                    <div className="fp-search" role="search">
                        <Search size={18} aria-hidden="true" />
                        <input
                            type="search"
                            aria-label="Search questions"
                            placeholder="Search for lead times, file formats, tolerances…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button type="button" className="fp-search-clear" aria-label="Clear search" onClick={() => setSearchQuery('')}>
                                <X size={16} aria-hidden="true" />
                            </button>
                        )}
                    </div>
                    <p className="fp-meta" aria-live="polite">
                        {loading
                            ? <span className="shimmer fp-sk-meta" aria-hidden="true" />
                            : `${faqData.length} answers across ${topics.length} topics`}
                    </p>
                </div>
            </section>

            {/* ── Questions ── */}
            <section className="fp-body" aria-label="Questions">
                <div className="fp-inner fp-layout">
                    <nav className="fp-nav" aria-label="Topics">
                        <span className="fp-nav-label">Topics</span>
                        {loading ? (
                            <ul className="fp-nav-list" aria-hidden="true">
                                {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                                    <li key={i} className="fp-nav-sk"><span className="shimmer fp-sk-line" style={{ width: `${48 + ((i * 19) % 40)}%` }} /></li>
                                ))}
                            </ul>
                        ) : (
                            <ul className="fp-nav-list">
                                {topics.map(topic => {
                                    const active = !query && activeTopic?.id === topic.id;
                                    return (
                                        <li key={topic.id}>
                                            <button
                                                type="button"
                                                className={`fp-nav-btn${active ? ' is-active' : ''}`}
                                                aria-current={active ? 'true' : undefined}
                                                onClick={() => pickTopic(topic.id)}
                                            >
                                                <span>{topic.name}</span>
                                                <span className="fp-nav-count">{topic.count}</span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </nav>

                    <div className="fp-main">
                        {loading ? (
                            <div className="fp-panel" aria-hidden="true">
                                <span className="shimmer fp-sk-line is-title" />
                                <span className="fp-sk-list">
                                    {[0, 1, 2, 3, 4, 5].map(i => (
                                        <span key={i} className="fp-sk-row">
                                            <span className="shimmer fp-sk-line" style={{ width: `${56 + ((i * 23) % 36)}%` }} />
                                            <span className="shimmer fp-sk-dot" />
                                        </span>
                                    ))}
                                </span>
                            </div>
                        ) : (
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.div key={query ? 'search' : `topic:${activeTopic?.id}`} className="fp-panel" {...fade}>
                                    {query ? (
                                        <>
                                            <div className="fp-panel-head">
                                                <h2 className="fp-panel-title">
                                                    {results.length} {results.length === 1 ? 'answer' : 'answers'} for “{searchQuery.trim()}”
                                                </h2>
                                                <button type="button" className="fp-clear" onClick={() => setSearchQuery('')}>Clear search</button>
                                            </div>
                                            {results.length > 0 ? (
                                                <QuestionList
                                                    items={results}
                                                    query={searchQuery}
                                                    topicOf={(item) => item.categories.map(c => topicById.get(c)).filter(Boolean).join(' · ')}
                                                />
                                            ) : (
                                                <div className="fp-empty">
                                                    <p>No questions match that. Try other words, or ask us directly.</p>
                                                    <Link to="/contact" className="fp-btn">Contact us</Link>
                                                </div>
                                            )}
                                        </>
                                    ) : activeTopic ? (
                                        <>
                                            <div className="fp-panel-head">
                                                <h2 className="fp-panel-title">{activeTopic.name}</h2>
                                                <span className="fp-panel-count">{activeTopic.count} {activeTopic.count === 1 ? 'question' : 'questions'}</span>
                                            </div>
                                            <QuestionList items={topicQuestions} query="" />
                                        </>
                                    ) : (
                                        <div className="fp-empty">
                                            <p>No questions yet.</p>
                                        </div>
                                    )}

                                    <div className="fp-foot">
                                        <span>Still stuck?</span>
                                        <Link to="/contact" className="fp-foot-link">
                                            Send us a message
                                            <ArrowRight size={15} aria-hidden="true" />
                                        </Link>
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default FAQPage;
