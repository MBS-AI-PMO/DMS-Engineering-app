import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Clock3, Link2, RotateCw, Tag } from 'lucide-react';
import { blogApi } from '../../services/blog';
import BlogContent from '../../components/blog/BlogContent';
import { collectHeadings, postDate, safeImageSrc } from '../../components/blog/blogDoc';
import { imageSrcSet, imageVariant } from '../../utils/imageUrl';
import { setJsonLd, setRouteSeo } from '../../utils/seo';
import BlogCard from './BlogCard';
import BlogToc from './BlogToc';
import '../../styles/Shimmer.css';
import '../../styles/BlogPage.css';

/**
 * One blog post (/blog/:slug): a dark heading band (category, title,
 * summary, author, date, reading time) with the cover laid over its lower
 * edge, then "On this page" beside the article text, the tags, a call to
 * get an instant price and up to three related posts. The text is drawn
 * from the post's stored editor document (components/blog/BlogContent),
 * never from HTML. Sets the page title, description, share tags and
 * BlogPosting structured data from the post. An old URL of a renamed post
 * moves to the current one; an unknown one shows "not found".
 */

const absolute = (url) => (url ? new URL(url, window.location.origin).href : undefined);

function usePostSeo(post, pathname) {
    useEffect(() => {
        if (!post) return undefined;
        const image = safeImageSrc(post.og_image) || safeImageSrc(post.cover_image) || '';
        const description = post.seo_description || post.excerpt || '';
        setRouteSeo(pathname, {
            title: post.seo_title || post.title,
            description,
            image,
            type: 'article',
            publishedTime: post.published_at,
            modifiedTime: post.updated_at,
        });
        const siteName = document.head.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || '';
        setJsonLd('blog-post', {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: String(post.title).slice(0, 110),
            description: description || undefined,
            image: image ? [absolute(image)] : undefined,
            datePublished: post.published_at,
            dateModified: post.updated_at || post.published_at,
            author: post.author_name ? { '@type': 'Person', name: post.author_name } : undefined,
            publisher: siteName ? { '@type': 'Organization', name: siteName, logo: { '@type': 'ImageObject', url: absolute('/logo-480.webp') } } : undefined,
            mainEntityOfPage: { '@type': 'WebPage', '@id': absolute(pathname) },
            articleSection: post.category || undefined,
            keywords: post.tags?.length ? post.tags.join(', ') : undefined,
            wordCount: post.word_count || undefined,
        });
        return () => {
            setRouteSeo(pathname, null);
            setJsonLd('blog-post', null);
        };
    }, [post, pathname]);
}

function CopyLink() {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href.split('#')[0]);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* clipboard blocked: nothing to do */ }
    };
    return (
        <button type="button" className="bl-btn is-small" onClick={copy}>
            {copied ? <Check size={15} aria-hidden="true" /> : <Link2 size={15} aria-hidden="true" />}
            <span role="status">{copied ? 'Link copied' : 'Copy link'}</span>
        </button>
    );
}

function PostSkeleton() {
    return (
        <div className="bl" aria-busy="true">
            <section className="bl-hero is-post">
                <div className="bl-inner bl-hero-content bl-post-head">
                    <span className="shimmer bl-sk-line is-crumbs" />
                    <span className="shimmer bl-sk-line is-h1" />
                    <span className="shimmer bl-sk-line is-h1 is-short" />
                    <span className="shimmer bl-sk-line is-meta" />
                </div>
            </section>
            <div className="bl-body">
                <div className="bl-inner bl-post-layout">
                    <div className="bl-article">
                        <div className="bl-sk-prose">
                            {[0, 1, 2, 3, 4, 5].map(i => <span key={i} className="shimmer bl-sk-line" />)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function BlogPostPage() {
    const { slug } = useParams();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [state, setState] = useState({ status: 'loading', slug: null, post: null, related: [] });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        blogApi.get(slug, { signal: controller.signal })
            .then(body => {
                if (body.redirect) { navigate(`/blog/${body.redirect}`, { replace: true }); return; }
                setState({ status: 'ready', slug, post: body.data, related: body.related || [] });
            })
            .catch(err => {
                if (err.name === 'AbortError') return;
                setState({ status: err.status === 404 ? 'missing' : 'error', slug, post: null, related: [] });
            });
        return () => controller.abort();
    }, [slug, attempt, navigate]);

    // A new slug shows the skeleton until its post arrives.
    const current = state.slug === slug ? state : { status: 'loading', post: null, related: [] };
    const { status, post, related } = current;
    usePostSeo(status === 'ready' ? post : null, pathname);

    const headings = useMemo(() => (post ? collectHeadings(post.content) : []), [post]);

    // A link to a heading (#materials) opens there once the text is in.
    useEffect(() => {
        if (status !== 'ready') return;
        const hash = decodeURIComponent(window.location.hash.slice(1));
        if (hash) document.getElementById(hash)?.scrollIntoView({ block: 'start' });
    }, [status]);

    if (status === 'loading') return <PostSkeleton />;

    if (status === 'missing' || status === 'error') {
        const missing = status === 'missing';
        return (
            <div className="bl">
                <section className="bl-hero" aria-labelledby="bl-title">
                    <div className="bl-inner bl-hero-content">
                        <nav className="bl-crumbs" aria-label="Breadcrumb">
                            <Link to="/">Home</Link><span aria-hidden="true">/</span><Link to="/blog">Blog</Link>
                        </nav>
                        <span className="bl-rule" aria-hidden="true" />
                        <h1 id="bl-title" className="bl-title is-post">{missing ? 'Post not found' : 'The post did not load'}</h1>
                        <p className="bl-lede">
                            {missing
                                ? 'This post may have been moved or taken down. The rest of the blog is a click away.'
                                : 'Check your connection and try again.'}
                        </p>
                        <div className="bl-state-actions">
                            {missing ? (
                                <Link to="/blog" className="bl-btn is-primary"><ArrowLeft size={16} aria-hidden="true" /> All posts</Link>
                            ) : (
                                <button type="button" className="bl-btn is-primary" onClick={() => setAttempt(n => n + 1)}><RotateCw size={16} aria-hidden="true" /> Try again</button>
                            )}
                            <Link to="/get-instant-pricing" className="bl-btn is-dark">Get instant pricing</Link>
                        </div>
                    </div>
                </section>
                <div className="bl-body is-short" />
            </div>
        );
    }

    const date = postDate(post.published_at);
    const updated = post.updated_at && postDate(post.updated_at) !== date ? postDate(post.updated_at) : '';
    const cover = safeImageSrc(post.cover_image);
    const coverSet = cover ? imageSrcSet(cover, 1120) : undefined;

    return (
        <div className="bl">
            <section className={`bl-hero is-post${cover ? ' has-cover' : ''}`} aria-labelledby="bl-title">
                <div className="bl-inner bl-hero-content bl-post-head">
                    <nav className="bl-crumbs" aria-label="Breadcrumb">
                        <Link to="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <Link to="/blog">Blog</Link>
                        {post.category && (
                            <>
                                <span aria-hidden="true">/</span>
                                <Link to={`/blog?category=${encodeURIComponent(post.category)}`}>{post.category}</Link>
                            </>
                        )}
                    </nav>
                    <span className="bl-rule" aria-hidden="true" />
                    <h1 id="bl-title" className="bl-title is-post">{post.title}</h1>
                    {post.excerpt && <p className="bl-lede">{post.excerpt}</p>}
                    <p className="bl-post-meta">
                        {post.author_name && <span className="bl-post-author">{post.author_name}</span>}
                        {date && <time dateTime={post.published_at}>{date}</time>}
                        <span className="bl-post-time"><Clock3 size={14} aria-hidden="true" /> {post.reading_minutes || 1} min read</span>
                        {updated && <span>Updated {updated}</span>}
                    </p>
                </div>
            </section>

            {cover && (
                <div className="bl-inner bl-cover-wrap">
                    <figure className="bl-cover">
                        <img
                            src={imageVariant(cover, 1120)}
                            srcSet={coverSet}
                            sizes={coverSet ? '(max-width: 1180px) 100vw, 1120px' : undefined}
                            alt={post.cover_alt || ''}
                            fetchPriority="high"
                            decoding="async"
                        />
                    </figure>
                </div>
            )}

            <div className={`bl-body is-post${cover ? ' has-cover' : ''}`}>
                <div className={`bl-inner bl-post-layout${headings.filter(h => h.text && h.level <= 3).length >= 2 ? '' : ' is-single'}`}>
                    <aside className="bl-post-side">
                        <BlogToc headings={headings} />
                    </aside>

                    <article className="bl-article" aria-labelledby="bl-title">
                        <BlogToc headings={headings} compact />
                        <BlogContent doc={post.content} width={760} />

                        <footer className="bl-article-foot">
                            {post.tags?.length > 0 && (
                                <ul className="bl-tags" aria-label="Tags">
                                    {post.tags.map(t => (
                                        <li key={t}><Link to={`/blog?tag=${encodeURIComponent(t)}`} className="bl-tag"><Tag size={13} aria-hidden="true" /> {t}</Link></li>
                                    ))}
                                </ul>
                            )}
                            <CopyLink />
                        </footer>

                        <section className="bl-cta" aria-labelledby="bl-cta-title">
                            <div>
                                <h2 id="bl-cta-title" className="bl-cta-title">Price your part now</h2>
                                <p>Upload a STEP or DXF file, choose the metal, thickness and services, and see the price as you go.</p>
                            </div>
                            <div className="bl-cta-actions">
                                <Link to="/get-instant-pricing" className="bl-btn is-primary">Get instant pricing <ArrowRight size={16} aria-hidden="true" /></Link>
                                <Link to="/guidelines" className="bl-btn">Design guidelines</Link>
                            </div>
                        </section>
                    </article>
                </div>

                {related.length > 0 && (
                    <section className="bl-inner bl-related" aria-labelledby="bl-related-title">
                        <div className="bl-related-head">
                            <h2 id="bl-related-title" className="bl-h2">Keep reading</h2>
                            <Link to="/blog" className="bl-text-link">All posts <ArrowRight size={15} aria-hidden="true" /></Link>
                        </div>
                        <ul className="bl-grid">
                            {related.map(p => <li key={p.slug}><BlogCard post={p} headingLevel={3} /></li>)}
                        </ul>
                    </section>
                )}
            </div>
        </div>
    );
}
