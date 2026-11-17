import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { ArrowRight, RotateCw } from 'lucide-react';
import LegalIcon from './LegalIcon';
import '../styles/Shimmer.css';
import '../styles/LegalPage.css';

/**
 * One legal document page (/privacy-policy, /terms-of-service): a flat dark
 * heading band (red rule from the left edge, the title as a bold white word
 * over a light red one, a red line icon with a faint oversized outline of it
 * behind), then the sections from Admin > Terms & Policy in a white panel
 * with an "On this page" list beside it that stays in view and marks the
 * section being read.
 *
 * Sections come from /api/legal/:type exactly as before (same request, same
 * serial-number sort). Each section's content is a list of plain-text
 * paragraphs typed in admin; they are rendered as React text, never as HTML.
 * Lines starting with "-", "*" or "•" become a bulleted list and lines
 * starting with "1." or "1)" a numbered one, so admins can write lists.
 */

// Natural order by serial number ("2" before "10"), then display order.
const sortSections = (rows) => [...rows].sort((a, b) => {
    const snA = a.serial_number || '';
    const snB = b.serial_number || '';
    const snResult = snA.localeCompare(snB, undefined, { numeric: true });
    if (snResult !== 0) return snResult;
    return (a.display_order || 0) - (b.display_order || 0);
});

const slugify = (text) => String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

// One admin paragraph -> paragraph and list blocks (text only).
const toBlocks = (text) => {
    const blocks = [];
    String(text ?? '').split(/\n\s*\n/).forEach((chunk) => {
        let para = [];
        let list = null;
        const flushPara = () => {
            if (para.length) blocks.push({ type: 'p', text: para.join('\n') });
            para = [];
        };
        const flushList = () => {
            if (list) blocks.push(list);
            list = null;
        };
        chunk.split('\n').map(line => line.trim()).filter(Boolean).forEach((line) => {
            const bullet = line.match(/^[-*•]\s+(.+)$/);
            const number = line.match(/^(\d+)[.)]\s+(.+)$/);
            if (bullet || number) {
                const type = bullet ? 'ul' : 'ol';
                flushPara();
                if (!list || list.type !== type) {
                    flushList();
                    list = { type, start: number ? Number(number[1]) : 1, items: [] };
                }
                list.items.push(bullet ? bullet[1] : number[2]);
            } else {
                flushList();
                para.push(line);
            }
        });
        flushPara();
        flushList();
    });
    return blocks;
};

// Lists typed one item per admin row read as one list.
const mergeLists = (blocks) => blocks.reduce((out, block) => {
    const prev = out[out.length - 1];
    if (prev && block.type !== 'p' && prev.type === block.type) {
        out[out.length - 1] = { ...prev, items: [...prev.items, ...block.items] };
    } else {
        out.push(block);
    }
    return out;
}, []);

const formatDate = (date) => date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

// Hero art, drawn in line: the red icon and the faint outline behind it.
const ART = {
    lock: {
        icon: (
            <>
                <rect x="14" y="62" width="92" height="70" rx="14" />
                <path d="M34 62V38a26 26 0 0 1 50.4-9" />
                <circle cx="60" cy="92" r="7" />
                <path d="M60 99v12" />
            </>
        ),
        mark: (
            <>
                <rect x="10" y="60" width="100" height="76" rx="16" />
                <path d="M30 60V42a30 30 0 0 1 60 0v18" />
            </>
        ),
    },
    document: {
        icon: (
            <>
                <path d="M74 10H30a10 10 0 0 0-10 10v100a10 10 0 0 0 10 10h60a10 10 0 0 0 10-10V36z" />
                <path d="M74 10v26h26" />
                <path d="M40 58h40M40 76h40" />
                <path d="M42 102l11 11 24-24" />
            </>
        ),
        mark: (
            <>
                <path d="M76 6H24a12 12 0 0 0-12 12v104a12 12 0 0 0 12 12h72a12 12 0 0 0 12-12V38z" />
                <path d="M76 6v32h32" />
            </>
        ),
    },
};

const HeroArt = ({ kind }) => {
    const art = ART[kind] || ART.document;
    return (
        <>
            <svg className="lg-hero-mark" viewBox="0 0 120 140" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                {art.mark}
            </svg>
            <svg className="lg-hero-icon" viewBox="0 0 120 140" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                {art.icon}
            </svg>
        </>
    );
};

const Block = ({ block }) => {
    if (block.type === 'ul') {
        return <ul>{block.items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
    }
    if (block.type === 'ol') {
        return <ol start={block.start !== 1 ? block.start : undefined}>{block.items.map((item, i) => <li key={i}>{item}</li>)}</ol>;
    }
    return <p>{block.text}</p>;
};

const LegalDocument = ({
    type,
    art,
    titleStrong,
    titleLight,
    crumb,
    lede,
    docName,
    questions,
    related,
    closing,
}) => {
    const [state, setState] = useState({ status: 'loading', sections: [] });
    const [attempt, setAttempt] = useState(0);
    const [activeId, setActiveId] = useState('');
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const res = await fetch(`/api/legal/${type}`);
                const data = await res.json();
                if (cancelled) return;
                if (data.success) {
                    setState({ status: 'ready', sections: sortSections(Array.isArray(data.data) ? data.data : []) });
                } else {
                    setState({ status: 'error', sections: [] });
                }
            } catch (err) {
                if (cancelled) return;
                console.warn(`Failed to load the ${docName}:`, err.message);
                setState({ status: 'error', sections: [] });
            }
        };
        load();
        return () => { cancelled = true; };
    }, [type, docName, attempt]);

    const retry = () => {
        setState({ status: 'loading', sections: [] });
        setAttempt(n => n + 1);
    };

    const { status, sections } = state;

    const items = useMemo(() => {
        const used = new Set();
        return sections.map((section, i) => {
            let anchor = slugify(section.heading) || `section-${section.id ?? i + 1}`;
            if (used.has(anchor)) anchor = `${anchor}-${i + 1}`;
            used.add(anchor);
            const content = Array.isArray(section.content) ? section.content : [];
            return { ...section, anchor, blocks: mergeLists(content.flatMap(toBlocks)) };
        });
    }, [sections]);

    // The newest edit of any section.
    const updated = useMemo(() => {
        const times = sections.map(s => Date.parse(s.updated_at || s.created_at)).filter(Number.isFinite);
        return times.length ? new Date(Math.max(...times)) : null;
    }, [sections]);

    // Mark the section being read: the last one whose top has passed
    // just under the site bar.
    useEffect(() => {
        if (!items.length) return undefined;
        let frame = 0;
        const update = () => {
            frame = 0;
            let current = items[0].anchor;
            for (const item of items) {
                const el = document.getElementById(item.anchor);
                if (el && el.getBoundingClientRect().top <= 140) current = item.anchor;
            }
            setActiveId(current);
        };
        const onScroll = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            if (frame) cancelAnimationFrame(frame);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
        };
    }, [items]);

    // A link straight to a section (#payment-billing, or the old
    // #section-<id>) opens there once the sections have loaded.
    useEffect(() => {
        if (status !== 'ready' || !items.length) return;
        const hash = decodeURIComponent(window.location.hash.slice(1));
        if (!hash) return;
        const item = items.find(it => it.anchor === hash || `section-${it.id}` === hash);
        const el = item && document.getElementById(item.anchor);
        if (el) el.scrollIntoView({ block: 'start' });
    }, [status, items]);

    const goTo = (event, anchor) => {
        const target = document.getElementById(anchor);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        target.querySelector('h2')?.focus({ preventScroll: true });
        // Keep the router's history entry; only the hash changes.
        window.history.replaceState(window.history.state, '', `#${anchor}`);
        setActiveId(anchor);
    };

    const loading = status === 'loading';
    const showToc = loading || (status === 'ready' && items.length > 0);
    const currentId = activeId || items[0]?.anchor;

    return (
        <div className="lg">
            {/* ── Heading band ── */}
            <section className={`lg-hero is-${art}`} aria-labelledby="lg-title">
                <HeroArt kind={art} />
                <div className="lg-inner lg-hero-content">
                    <div className="lg-hero-text">
                        <nav className="lg-crumbs" aria-label="Breadcrumb">
                            <Link to="/">Home</Link>
                            <span aria-hidden="true">/</span>
                            <span aria-current="page">{crumb}</span>
                        </nav>
                        <span className="lg-rule" aria-hidden="true" />
                        <h1 id="lg-title" className="lg-title">
                            <span className="lg-title-strong">{titleStrong}</span>{' '}
                            <span className="lg-title-light">{titleLight}</span>
                        </h1>
                        {lede && <p className="lg-lede">{lede}</p>}
                        <p className="lg-meta">
                            {loading ? (
                                <span className="shimmer lg-sk-meta" aria-hidden="true" />
                            ) : updated ? (
                                <>Last updated <time dateTime={updated.toISOString()}>{formatDate(updated)}</time></>
                            ) : null}
                        </p>
                    </div>
                </div>
            </section>

            {/* ── Document ── */}
            <div className="lg-body">
                <div className={`lg-inner lg-layout${showToc ? '' : ' is-single'}`}>
                    {showToc && (
                        <nav className="lg-toc" aria-label="On this page">
                            <span className="lg-toc-label" aria-hidden="true">On this page</span>
                            {loading ? (
                                <ul className="lg-toc-list" aria-hidden="true">
                                    {[0, 1, 2, 3, 4].map(i => (
                                        <li key={i} className="lg-toc-sk"><span className="shimmer lg-sk-line" /></li>
                                    ))}
                                </ul>
                            ) : (
                                <ol className="lg-toc-list">
                                    {items.map(item => {
                                        const active = currentId === item.anchor;
                                        return (
                                            <li key={item.anchor}>
                                                <a
                                                    href={`#${item.anchor}`}
                                                    className={`lg-toc-link${active ? ' is-active' : ''}`}
                                                    aria-current={active ? 'location' : undefined}
                                                    onClick={(e) => goTo(e, item.anchor)}
                                                >
                                                    {item.serial_number && <span className="lg-toc-num">{item.serial_number}</span>}
                                                    <span>{item.heading}</span>
                                                </a>
                                            </li>
                                        );
                                    })}
                                </ol>
                            )}
                            <Link to={related.to} className="lg-toc-related">
                                {related.label}
                                <ArrowRight size={14} aria-hidden="true" />
                            </Link>
                        </nav>
                    )}

                    <article className="lg-doc" aria-labelledby="lg-title" aria-busy={loading}>
                        {loading ? (
                            <div aria-hidden="true">
                                {[0, 1, 2].map(i => (
                                    <div key={i} className="lg-section is-skeleton">
                                        <div className="lg-section-head">
                                            <span className="shimmer lg-section-icon" />
                                            <span className="shimmer lg-sk-line is-heading" />
                                        </div>
                                        <div className="lg-sk-prose">
                                            {[0, 1, 2, 3].map(j => <span key={j} className="shimmer lg-sk-line" />)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : status === 'error' ? (
                            <div className="lg-state" role="alert">
                                <h2 className="lg-state-title">The {docName} did not load</h2>
                                <p>Check your connection and try again. If it keeps happening, send us a message.</p>
                                <div className="lg-state-actions">
                                    <button type="button" className="lg-btn is-primary" onClick={retry}>
                                        <RotateCw size={16} aria-hidden="true" />
                                        Try again
                                    </button>
                                    <Link to="/contact" className="lg-btn">Contact us</Link>
                                </div>
                            </div>
                        ) : items.length === 0 ? (
                            <div className="lg-state">
                                <h2 className="lg-state-title">The {docName} is being written</h2>
                                <p>It has not been published yet. If you have a question in the meantime, send us a message.</p>
                                <div className="lg-state-actions">
                                    <Link to="/contact" className="lg-btn is-primary">
                                        Contact us
                                        <ArrowRight size={16} aria-hidden="true" />
                                    </Link>
                                    <Link to={related.to} className="lg-btn">{related.label}</Link>
                                </div>
                            </div>
                        ) : (
                            <>
                                {items.map(item => (
                                    <section key={item.anchor} id={item.anchor} className="lg-section" aria-labelledby={`${item.anchor}-title`}>
                                        <div className="lg-section-head">
                                            <span className="lg-section-icon" aria-hidden="true">
                                                <LegalIcon name={item.icon} size={19} />
                                            </span>
                                            <h2 id={`${item.anchor}-title`} className="lg-h2" tabIndex={-1}>
                                                {item.serial_number && <span className="lg-h2-num">{item.serial_number}</span>}
                                                <span>{item.heading}</span>
                                            </h2>
                                        </div>
                                        <div className="lg-prose">
                                            {item.blocks.map((block, i) => <Block key={i} block={block} />)}
                                        </div>
                                    </section>
                                ))}

                                {closing && (
                                    <div className="lg-note">
                                        <h2 className="lg-note-title">{closing.title}</h2>
                                        <p>{closing.text}</p>
                                    </div>
                                )}

                                <div className="lg-foot">
                                    <div className="lg-foot-copy">
                                        <h2 className="lg-foot-title">{questions.title}</h2>
                                        <p>{questions.text}</p>
                                    </div>
                                    <div className="lg-foot-actions">
                                        <Link to="/contact" className="lg-btn is-primary">
                                            Contact us
                                            <ArrowRight size={16} aria-hidden="true" />
                                        </Link>
                                        <Link to={related.to} className="lg-btn">Read the {related.label.toLowerCase()}</Link>
                                    </div>
                                </div>
                            </>
                        )}
                    </article>
                </div>
            </div>
        </div>
    );
};

export default LegalDocument;
