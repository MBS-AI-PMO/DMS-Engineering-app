import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Info, Lightbulb, Play } from 'lucide-react';
import { imageSrcSet, imageVariant } from '../../utils/imageUrl';
import { collectHeadings, safeHref, safeImageSrc, youtubeId } from './blogDoc';
import '../../styles/BlogArticle.css';

/**
 * A blog post's text, drawn from the editor's JSON document as React
 * elements (never as HTML). Only the blocks and marks in blogDoc.js are
 * drawn; anything else is skipped, links and pictures are checked again
 * and YouTube videos load only when played. Used by the post page and by
 * the admin preview, so both look the same (styles/BlogArticle.css).
 *
 * Headings get the ids collectHeadings() gives them, for the table of
 * contents. width: the widest the text column gets (picture sizes).
 */

const ALIGN_CLASS = { center: 'is-center', right: 'is-right', justify: 'is-justify' };
const CALLOUTS = {
    info: { icon: Info, label: 'Note' },
    tip: { icon: Lightbulb, label: 'Tip' },
    warning: { icon: AlertTriangle, label: 'Important' },
};

function LiteYouTube({ id, start }) {
    const [playing, setPlaying] = useState(false);
    const query = `${start ? `start=${start}&` : ''}rel=0`;
    if (playing) {
        return (
            <iframe
                className="bp-video-frame"
                src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&${query}`}
                title="YouTube video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
            />
        );
    }
    return (
        <button type="button" className="bp-video-poster" onClick={() => setPlaying(true)} aria-label="Play the YouTube video">
            <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" decoding="async" />
            <span className="bp-video-play" aria-hidden="true"><Play size={26} fill="currentColor" /></span>
        </button>
    );
}

function renderMarks(text, marks, key) {
    let out = text;
    // Innermost first; the link wraps everything else.
    const order = ['code', 'highlight', 'strike', 'underline', 'italic', 'bold', 'link'];
    const list = (Array.isArray(marks) ? marks : []).filter(m => order.includes(m?.type)).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    list.forEach((mark, i) => {
        const k = `${key}-${i}`;
        switch (mark.type) {
            case 'bold': out = <strong key={k}>{out}</strong>; break;
            case 'italic': out = <em key={k}>{out}</em>; break;
            case 'underline': out = <u key={k}>{out}</u>; break;
            case 'strike': out = <s key={k}>{out}</s>; break;
            case 'code': out = <code key={k}>{out}</code>; break;
            case 'highlight': out = <mark key={k}>{out}</mark>; break;
            case 'link': {
                const href = safeHref(mark.attrs?.href);
                if (!href) break;
                if (href.startsWith('/') && !/^\/(?:api\/)?uploads\//.test(href)) out = <Link key={k} to={href}>{out}</Link>;
                else if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) out = <a key={k} href={href}>{out}</a>;
                else out = <a key={k} href={href} target="_blank" rel="noopener noreferrer">{out}</a>;
                break;
            }
            default: break;
        }
    });
    return out;
}

function renderChildren(node, ctx) {
    return (Array.isArray(node?.content) ? node.content : []).map((child, i) => renderNode(child, i, ctx));
}

const alignClass = (node) => ALIGN_CLASS[node.attrs?.textAlign] || undefined;

function renderNode(node, key, ctx) {
    if (!node || typeof node !== 'object') return null;
    switch (node.type) {
        case 'text':
            return typeof node.text === 'string' && node.text ? <Fragment key={key}>{renderMarks(node.text, node.marks, key)}</Fragment> : null;
        case 'hardBreak':
            return <br key={key} />;
        case 'paragraph': {
            const children = renderChildren(node, ctx);
            if (!children.some(Boolean)) return null;
            return <p key={key} className={alignClass(node)}>{children}</p>;
        }
        case 'heading': {
            const level = Math.min(4, Math.max(2, Number(node.attrs?.level) || 2));
            const Tag = `h${level}`;
            const id = ctx.headings[ctx.headingIndex]?.id;
            ctx.headingIndex += 1;
            return <Tag key={key} id={id} className={alignClass(node)}>{renderChildren(node, ctx)}</Tag>;
        }
        case 'bulletList':
            return <ul key={key}>{renderChildren(node, ctx)}</ul>;
        case 'orderedList': {
            const start = Number(node.attrs?.start) || 1;
            return <ol key={key} start={start !== 1 ? start : undefined}>{renderChildren(node, ctx)}</ol>;
        }
        case 'listItem':
            return <li key={key}>{renderChildren(node, ctx)}</li>;
        case 'blockquote':
            return <blockquote key={key}>{renderChildren(node, ctx)}</blockquote>;
        case 'callout': {
            const tone = CALLOUTS[node.attrs?.tone] ? node.attrs.tone : 'info';
            const { icon: Icon, label } = CALLOUTS[tone];
            return (
                <aside key={key} className={`bp-callout is-${tone}`} aria-label={label}>
                    <span className="bp-callout-icon" aria-hidden="true"><Icon size={18} /></span>
                    <div className="bp-callout-body">{renderChildren(node, ctx)}</div>
                </aside>
            );
        }
        case 'codeBlock':
            return <pre key={key}><code>{(node.content || []).map(c => (c?.type === 'text' ? c.text : '')).join('')}</code></pre>;
        case 'horizontalRule':
            return <hr key={key} />;
        case 'image': {
            const src = safeImageSrc(node.attrs?.src);
            if (!src) return null;
            const width = Number(node.attrs?.width) || undefined;
            const height = Number(node.attrs?.height) || undefined;
            const srcSet = imageSrcSet(src, ctx.width);
            const caption = typeof node.attrs?.caption === 'string' ? node.attrs.caption.trim() : '';
            return (
                <figure key={key} className="bp-figure">
                    <img
                        src={imageVariant(src, ctx.width)}
                        srcSet={srcSet}
                        sizes={srcSet ? `(max-width: ${ctx.width}px) 100vw, ${ctx.width}px` : undefined}
                        width={width}
                        height={height}
                        alt={typeof node.attrs?.alt === 'string' ? node.attrs.alt : ''}
                        loading="lazy"
                        decoding="async"
                    />
                    {caption && <figcaption>{caption}</figcaption>}
                </figure>
            );
        }
        case 'youtube': {
            const id = youtubeId(node.attrs?.src);
            if (!id) return null;
            const start = Math.max(0, Math.floor(Number(node.attrs?.start) || 0));
            return <div key={key} className="bp-video"><LiteYouTube id={id} start={start} /></div>;
        }
        case 'table':
            return (
                <div key={key} className="bp-table" role="region" aria-label="Table" tabIndex={0}>
                    <table><tbody>{renderChildren(node, ctx)}</tbody></table>
                </div>
            );
        case 'tableRow':
            return <tr key={key}>{renderChildren(node, ctx)}</tr>;
        case 'tableHeader':
        case 'tableCell': {
            const Cell = node.type === 'tableHeader' ? 'th' : 'td';
            const colSpan = Number(node.attrs?.colspan) > 1 ? Number(node.attrs.colspan) : undefined;
            const rowSpan = Number(node.attrs?.rowspan) > 1 ? Number(node.attrs.rowspan) : undefined;
            return <Cell key={key} colSpan={colSpan} rowSpan={rowSpan} scope={Cell === 'th' ? 'col' : undefined}>{renderChildren(node, ctx)}</Cell>;
        }
        default:
            return null;
    }
}

export default function BlogContent({ doc, className = '', width = 760 }) {
    const headings = useMemo(() => collectHeadings(doc), [doc]);
    const body = useMemo(
        () => (doc && doc.type === 'doc' ? renderChildren(doc, { headings, headingIndex: 0, width }) : null),
        [doc, headings, width],
    );
    return <div className={`bp-prose ${className}`.trim()}>{body}</div>;
}
