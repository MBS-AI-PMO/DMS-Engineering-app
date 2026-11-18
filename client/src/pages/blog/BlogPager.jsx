import { ChevronLeft, ChevronRight } from 'lucide-react';

/* 1 … 4 5 6 … 12: the first, the last and two either side of the current page. */
function pageList(page, pages) {
    const keep = new Set([1, pages, page - 1, page, page + 1].filter(n => n >= 1 && n <= pages));
    const out = [];
    [...keep].sort((a, b) => a - b).forEach((n, i, arr) => {
        if (i && n - arr[i - 1] > 1) out.push(`gap-${n}`);
        out.push(n);
    });
    return out;
}

/** Pages of blog posts: previous, numbers, next. onChange(page). */
export default function BlogPager({ page, pages, onChange }) {
    if (pages <= 1) return null;
    return (
        <nav className="bl-pager" aria-label="Pages of posts">
            <button type="button" className="bl-pager-step" onClick={() => onChange(page - 1)} disabled={page <= 1}>
                <ChevronLeft size={16} aria-hidden="true" /> <span>Newer</span>
            </button>
            <ol className="bl-pager-pages">
                {pageList(page, pages).map(item => (typeof item === 'string' ? (
                    <li key={item} className="bl-pager-gap" aria-hidden="true">…</li>
                ) : (
                    <li key={item}>
                        <button
                            type="button"
                            className={`bl-pager-num${item === page ? ' is-current' : ''}`}
                            aria-current={item === page ? 'page' : undefined}
                            aria-label={`Page ${item}`}
                            onClick={() => onChange(item)}
                        >
                            {item}
                        </button>
                    </li>
                )))}
            </ol>
            <button type="button" className="bl-pager-step" onClick={() => onChange(page + 1)} disabled={page >= pages}>
                <span>Older</span> <ChevronRight size={16} aria-hidden="true" />
            </button>
        </nav>
    );
}
