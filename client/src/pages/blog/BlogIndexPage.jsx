import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, RotateCw, Search, Tag, X } from 'lucide-react';
import { blogApi } from '../../services/blog';
import BlogCard from './BlogCard';
import BlogPager from './BlogPager';
import '../../styles/Shimmer.css';
import '../../styles/BlogPage.css';

/**
 * The blog (/blog): a dark heading band with a search box, the categories
 * as filter pills, the newest post as a large card, then the rest in a
 * grid with pages. Search, category, tag and page live in the URL
 * (?q=&category=&tag=&page=), so a filtered list can be shared and "back"
 * returns to it. Only live posts come from the server.
 */

const PER_PAGE = 9;

function SkeletonCards({ count = 6 }) {
    return (
        <ul className="bl-grid" aria-hidden="true">
            {Array.from({ length: count }, (_, i) => (
                <li key={i} className="bl-card is-skeleton">
                    <span className="shimmer bl-card-media" />
                    <span className="bl-card-body">
                        <span className="shimmer bl-sk-line is-short" />
                        <span className="shimmer bl-sk-line is-title" />
                        <span className="shimmer bl-sk-line" />
                        <span className="shimmer bl-sk-line is-mid" />
                    </span>
                </li>
            ))}
        </ul>
    );
}

export default function BlogIndexPage() {
    const [params, setParams] = useSearchParams();
    const q = (params.get('q') || '').trim();
    const category = params.get('category') || '';
    const tag = params.get('tag') || '';
    const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
    const filtered = Boolean(q || category || tag);

    const [search, setSearch] = useState(q);
    const [state, setState] = useState({ status: 'loading', data: null });
    const [attempt, setAttempt] = useState(0);
    const listTop = useRef(null);

    // The box follows the URL (back/forward, a tag link).
    const [seenQ, setSeenQ] = useState(q);
    if (seenQ !== q) { setSeenQ(q); setSearch(q); }

    const update = (changes) => setParams(prev => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([k, val]) => {
            if (val === '' || val === null || val === undefined || (k === 'page' && val === 1)) next.delete(k);
            else next.set(k, String(val));
        });
        return next;
    });

    // Typing searches after a short pause.
    useEffect(() => {
        const wanted = search.trim();
        if (wanted === q) return undefined;
        const t = setTimeout(() => update({ q: wanted, page: 1 }), 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    useEffect(() => {
        const controller = new AbortController();
        setState(prev => ({ status: prev.data ? 'refreshing' : 'loading', data: prev.data }));
        blogApi.list({ page, per_page: PER_PAGE, q, category, tag, featured: 1 }, { signal: controller.signal })
            .then(data => setState({ status: 'ready', data }))
            .catch(err => { if (err.name !== 'AbortError') setState({ status: 'error', data: null }); });
        return () => controller.abort();
    }, [page, q, category, tag, attempt]);

    const goToPage = (n) => {
        update({ page: n });
        listTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const { status, data } = state;
    const posts = data?.data || [];
    const featured = !filtered && page === 1 ? data?.featured : null;
    const categories = data?.categories || [];
    const nothingYet = status === 'ready' && !filtered && !data?.featured && posts.length === 0;

    return (
        <div className="bl">
            {/* ── Heading band ── */}
            <section className="bl-hero" aria-labelledby="bl-title">
                <div className="bl-inner bl-hero-content">
                    <nav className="bl-crumbs" aria-label="Breadcrumb">
                        <Link to="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">Blog</span>
                    </nav>
                    <span className="bl-rule" aria-hidden="true" />
                    <h1 id="bl-title" className="bl-title">Blog</h1>
                    <p className="bl-lede">
                        Guides and notes on laser cutting, bending, CNC machining and finishing, and on getting your
                        CAD files ready for an instant price.
                    </p>
                    <form className="bl-search" role="search" onSubmit={(e) => { e.preventDefault(); update({ q: search.trim(), page: 1 }); }}>
                        <Search size={18} aria-hidden="true" />
                        <input
                            type="search"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search the blog"
                            aria-label="Search the blog"
                            maxLength={100}
                        />
                        {search && (
                            <button type="button" className="bl-search-clear" onClick={() => { setSearch(''); update({ q: '', page: 1 }); }} aria-label="Clear search">
                                <X size={16} aria-hidden="true" />
                            </button>
                        )}
                    </form>
                </div>
            </section>

            <div className="bl-body" ref={listTop}>
                <div className="bl-inner">
                    {(categories.length > 0 || tag) && (
                        <div className="bl-filters">
                            {categories.length > 0 && (
                                <div className="bl-pills" role="group" aria-label="Filter by category">
                                    <button type="button" className={`bl-pill${!category ? ' is-active' : ''}`} aria-pressed={!category} onClick={() => update({ category: '', page: 1 })}>
                                        All posts
                                    </button>
                                    {categories.map(c => {
                                        const active = c.name.toLowerCase() === category.toLowerCase();
                                        return (
                                            <button key={c.name} type="button" className={`bl-pill${active ? ' is-active' : ''}`} aria-pressed={active} onClick={() => update({ category: active ? '' : c.name, page: 1 })}>
                                                {c.name}
                                                <span className="bl-pill-count">{c.count}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            {tag && (
                                <span className="bl-active-tag">
                                    <Tag size={14} aria-hidden="true" /> Tagged “{tag}”
                                    <button type="button" onClick={() => update({ tag: '', page: 1 })} aria-label={`Remove the tag filter ${tag}`}><X size={14} aria-hidden="true" /></button>
                                </span>
                            )}
                        </div>
                    )}

                    {filtered && status !== 'loading' && status !== 'error' && (
                        <p className="bl-result-note" role="status">
                            {data?.total === 1 ? '1 post' : `${data?.total ?? 0} posts`}
                            {q ? ` for “${q}”` : ''}
                            {category ? ` in ${category}` : ''}
                            {tag ? ` tagged “${tag}”` : ''}
                        </p>
                    )}

                    {status === 'loading' ? (
                        <>
                            {!filtered && page === 1 && <div className="shimmer bl-sk-featured" aria-hidden="true" />}
                            <SkeletonCards />
                        </>
                    ) : status === 'error' ? (
                        <div className="bl-state" role="alert">
                            <h2 className="bl-state-title">The blog did not load</h2>
                            <p>Check your connection and try again.</p>
                            <button type="button" className="bl-btn is-primary" onClick={() => setAttempt(n => n + 1)}>
                                <RotateCw size={16} aria-hidden="true" /> Try again
                            </button>
                        </div>
                    ) : nothingYet ? (
                        <div className="bl-state">
                            <h2 className="bl-state-title">No posts yet</h2>
                            <p>The first guides are on their way. In the meantime, you can price a part straight from its CAD file.</p>
                            <div className="bl-state-actions">
                                <Link to="/get-instant-pricing" className="bl-btn is-primary">Get instant pricing <ArrowRight size={16} aria-hidden="true" /></Link>
                                <Link to="/guidelines" className="bl-btn">Design guidelines</Link>
                            </div>
                        </div>
                    ) : posts.length === 0 && !featured ? (
                        <div className="bl-state">
                            <h2 className="bl-state-title">No posts match</h2>
                            <p>Try other words, or look through all the posts.</p>
                            <button type="button" className="bl-btn" onClick={() => { setSearch(''); update({ q: '', category: '', tag: '', page: 1 }); }}>Show all posts</button>
                        </div>
                    ) : (
                        <div className={status === 'refreshing' ? 'bl-results is-refreshing' : 'bl-results'} aria-busy={status === 'refreshing'}>
                            {featured && <BlogCard post={featured} featured />}
                            {posts.length > 0 && (
                                <ul className="bl-grid">
                                    {posts.map(post => <li key={post.slug}><BlogCard post={post} /></li>)}
                                </ul>
                            )}
                            <BlogPager page={Math.min(page, data?.pages || 1)} pages={data?.pages || 1} onChange={goToPage} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
