import { Clock3 } from 'lucide-react';
import { Button, Modal } from '../../../components/admin/ui';
import BlogContent from '../../../components/blog/BlogContent';
import { postDate, safeImageSrc } from '../../../components/blog/blogDoc';
import { imageVariant } from '../../../utils/imageUrl';
import '../../../styles/BlogPage.css';

/**
 * The post as readers will see it, with unsaved changes: the blog's own
 * heading band, cover and article styles (styles/BlogPage.css and
 * BlogArticle.css), drawn from the editor document by the same
 * BlogContent the site uses.
 */
export default function BlogPreview({ form, post, words, autoExcerpt, onClose }) {
    const cover = safeImageSrc(form.cover_image);
    const date = postDate(post?.state !== 'draft' && post?.published_at ? post.published_at : new Date());
    const excerpt = form.excerpt.trim() || autoExcerpt;
    return (
        <Modal
            title="Preview"
            subtitle="How the post will look on the blog, with your unsaved changes."
            size="xl"
            onClose={onClose}
            className="be-preview-modal"
            footer={<Button variant="primary" onClick={onClose}>Back to editing</Button>}
        >
            <div className="bl be-preview">
                <section className={`bl-hero is-post${cover ? ' has-cover' : ''}`}>
                    <div className="bl-inner bl-hero-content bl-post-head">
                        <nav className="bl-crumbs" aria-label="Breadcrumb">
                            <span>Home</span><span aria-hidden="true">/</span><span>Blog</span>
                            {form.category && <><span aria-hidden="true">/</span><span>{form.category}</span></>}
                        </nav>
                        <span className="bl-rule" aria-hidden="true" />
                        <h1 className="bl-title is-post">{form.title || 'Untitled post'}</h1>
                        {excerpt && <p className="bl-lede">{excerpt}</p>}
                        <p className="bl-post-meta">
                            {form.author_name && <span className="bl-post-author">{form.author_name}</span>}
                            <span>{date}</span>
                            <span className="bl-post-time"><Clock3 size={14} aria-hidden="true" /> {Math.max(1, Math.round(words / 225))} min read</span>
                        </p>
                    </div>
                </section>
                {cover && (
                    <div className="bl-inner bl-cover-wrap">
                        <figure className="bl-cover"><img src={imageVariant(cover, 1120)} alt={form.cover_alt || ''} /></figure>
                    </div>
                )}
                <div className={`bl-body is-post${cover ? ' has-cover' : ''}`}>
                    <div className="bl-inner bl-post-layout is-single">
                        <article className="bl-article">
                            <BlogContent doc={form.content} width={760} />
                            {form.tags.length > 0 && (
                                <footer className="bl-article-foot">
                                    <ul className="bl-tags">{form.tags.map(t => <li key={t}><span className="bl-tag">{t}</span></li>)}</ul>
                                </footer>
                            )}
                        </article>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
