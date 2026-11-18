import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Banner, Button, Checkbox, SearchInput, Skeleton } from '../../../components/admin/ui';
import { groupPages, pageLabel } from './faqPages';

/**
 * "Show on pages": pick any number of pages of the public site. The picked
 * ones show as chips on top (× takes one off); below, a search and every
 * page grouped as main / metal / service pages, each type starting with its
 * "All … pages" choice. value: page keys; onChange(keys).
 */
export default function PagePicker({ pages, value, onChange, loading = false, error = '', onRetry }) {
    const [query, setQuery] = useState('');
    const byKey = useMemo(() => new Map(pages.map(p => [p.key, p])), [pages]);
    const groups = useMemo(() => groupPages(pages, query), [pages, query]);
    const picked = new Set(value);
    const set = (key, on) => onChange(on ? [...value.filter(k => k !== key), key] : value.filter(k => k !== key));

    return (
        <div className="ac-faq-picker">
            <div className="ac-faq-chips" aria-live="polite">
                {value.length ? value.map(key => {
                    const label = pageLabel(key, byKey);
                    return (
                        <span key={key} className={`ac-faq-chip${byKey.get(key)?.missing ? ' is-missing' : ''}`}>
                            {label}
                            <button type="button" onClick={() => set(key, false)} aria-label={`Remove ${label}`} title={`Remove ${label}`}>
                                <X size={12} aria-hidden="true" />
                            </button>
                        </span>
                    );
                }) : <span className="ac-faq-chips-empty">Only on the FAQ page.</span>}
            </div>

            {error ? (
                <Banner tone="error" action={onRetry ? <Button size="sm" onClick={onRetry}>Try again</Button> : null}>Could not load the pages. {error}</Banner>
            ) : (
                <div className="ac-faq-picker-box">
                    <SearchInput value={query} onChange={setQuery} placeholder="Search pages…" label="Search pages" className="ac-faq-picker-search" />
                    <div className="ac-faq-picker-list">
                        {loading && (
                            <div className="ac-faq-picker-sk" aria-hidden="true">
                                {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} width={`${45 + ((i * 17) % 40)}%`} />)}
                            </div>
                        )}
                        {!loading && groups.map(group => (
                            <fieldset key={group.id} className="ac-faq-picker-group">
                                <legend>{group.label}</legend>
                                {group.pages.map(page => (
                                    <Checkbox
                                        key={page.key}
                                        className={page.wildcard ? 'is-all' : undefined}
                                        checked={picked.has(page.key)}
                                        onChange={on => set(page.key, on)}
                                        label={(
                                            <span className="ac-faq-picker-label">
                                                <span>{page.label}{page.hidden && <em> (hidden)</em>}</span>
                                                <small>{page.wildcard ? 'every page of this type, now and later' : page.key}</small>
                                            </span>
                                        )}
                                    />
                                ))}
                            </fieldset>
                        ))}
                        {!loading && !groups.length && <p className="ac-faq-picker-empty">No page matches “{query.trim()}”.</p>}
                    </div>
                </div>
            )}
        </div>
    );
}
