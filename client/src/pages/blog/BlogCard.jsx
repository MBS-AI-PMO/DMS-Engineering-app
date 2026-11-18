import { Link } from 'react-router-dom';
import { ArrowRight, Clock3 } from 'lucide-react';
import ThumbImage from '../../components/ThumbImage';
import { postDate } from '../../components/blog/blogDoc';

/**
 * One post in a list: cover, category, title, excerpt, date and reading
 * time; the whole card is the link. featured: the large card at the top of
 * /blog (picture beside the text). headingLevel: h2 on the index, h3 under
 * a "Keep reading" heading.
 */
export default function BlogCard({ post, featured = false, headingLevel = 2 }) {
    const Heading = `h${headingLevel}`;
    const date = postDate(post.published_at);
    return (
        <article className={`bl-card${featured ? ' is-featured' : ''}`}>
            <Link to={`/blog/${post.slug}`} className="bl-card-link">
                <div className="bl-card-media">
                    {post.cover_image ? (
                        <ThumbImage
                            key={post.cover_image}
                            className="bl-card-img"
                            src={post.cover_image}
                            width={featured ? 820 : 440}
                            sizes={featured ? '(max-width: 900px) 100vw, 760px' : '(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 440px'}
                        />
                    ) : (
                        <span className="bl-card-blank" aria-hidden="true"><span /></span>
                    )}
                </div>
                <div className="bl-card-body">
                    {(featured || post.category) && (
                        <span className="bl-card-eyebrow">
                            {featured && <span className="bl-card-latest">Latest</span>}
                            {post.category && <span className="bl-card-cat">{post.category}</span>}
                        </span>
                    )}
                    <Heading className="bl-card-title">{post.title}</Heading>
                    {post.excerpt && <p className="bl-card-excerpt">{post.excerpt}</p>}
                    <span className="bl-card-meta">
                        {date && <time dateTime={post.published_at}>{date}</time>}
                        {date && <span aria-hidden="true">·</span>}
                        <span className="bl-card-time"><Clock3 size={14} aria-hidden="true" /> {post.reading_minutes || 1} min read</span>
                    </span>
                    {featured && (
                        <span className="bl-card-more">Read the post <ArrowRight size={16} aria-hidden="true" /></span>
                    )}
                </div>
            </Link>
        </article>
    );
}
