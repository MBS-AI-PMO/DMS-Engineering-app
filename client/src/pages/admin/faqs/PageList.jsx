import { useMemo, useState } from 'react';
import { Layers } from 'lucide-react';
import { Banner, Button, Card, SearchInput, Skeleton } from '../../../components/admin/ui';
import { groupPages } from './faqPages';

/**
 * The pages of the site down the side of "On pages": searchable, grouped,
 * each with how many FAQs are placed on it. The picked one is marked.
 * pages: { list, loading, error, reload }; counts: Map key -> number.
 */
export default function PageList({ pages, counts, value, onChange }) {
    const [query, setQuery] = useState('');
    const groups = useMemo(() => groupPages(pages.list, query), [pages.list, query]);

    return (
        <Card className="ac-faq-nav" as="nav" aria-label="Pages of the site">
            <SearchInput value={query} onChange={setQuery} placeholder="Find a page…" label="Find a page" className="ac-faq-nav-search" />
            {pages.error ? (
                <Banner tone="error" action={<Button size="sm" onClick={pages.reload}>Try again</Button>}>Could not load the pages. {pages.error}</Banner>
            ) : (
                <div className="ac-faq-nav-list">
                    {pages.loading && [0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} width={`${50 + ((i * 19) % 40)}%`} />)}
                    {!pages.loading && groups.map(group => (
                        <div key={group.id} className="ac-faq-nav-group" role="group" aria-labelledby={`ac-faq-nav-${group.id}`}>
                            <p id={`ac-faq-nav-${group.id}`} className="ac-faq-nav-heading">{group.label}</p>
                            {group.pages.map(page => {
                                const count = counts.get(page.key) || 0;
                                const active = page.key === value;
                                return (
                                    <button
                                        key={page.key}
                                        type="button"
                                        className={`ac-faq-nav-item${active ? ' is-active' : ''}${page.wildcard ? ' is-all' : ''}${page.missing ? ' is-missing' : ''}`}
                                        aria-current={active ? 'page' : undefined}
                                        onClick={() => onChange(page.key)}
                                    >
                                        {page.wildcard && <Layers size={14} aria-hidden="true" />}
                                        <span className="ac-faq-nav-label">{page.label}</span>
                                        <span className={`ac-faq-nav-count${count ? '' : ' is-zero'}`} aria-label={`${count} FAQs`}>{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                    {!pages.loading && !groups.length && <p className="ac-faq-picker-empty">No page matches “{query.trim()}”.</p>}
                </div>
            )}
        </Card>
    );
}
