import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    CalendarClock, CheckCircle2, Clock3, ExternalLink, FileText, Newspaper, PenLine, Plus, Tag, Type,
} from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import {
    Page, PageHeader, StatGrid, StatCard, Toolbar, Tabs, SearchInput, Select, Button, IconButton,
    DataTable, CellText, RowActions, EmptyState, Banner, Pill, useConfirm,
} from '../../../components/admin/ui';
import { blogService } from '../../../services/admin/blog';
import { imageVariant } from '../../../utils/imageUrl';
import Pager from '../content/Pager';
import PostRowMenu from './PostRowMenu';
import { STATES, ago, dateTime, shortDay, stateMeta } from './blogModel';
import '../content/content.css';
import './blogAdmin.css';

/**
 * Admin > Blog (/admin/blog): every post with its status. Counts at the
 * top (click to filter), search, status tabs, category and sort; a row
 * opens the editor. Each row can be published, unpublished, previewed,
 * duplicated or deleted. Filters live in the URL so "back" keeps them.
 */

const PAGE_SIZE = 20;
const SORTS = {
    edited: { label: 'Last edited', fn: (a, b) => new Date(b.updated_at) - new Date(a.updated_at) },
    published: { label: 'Publish date', fn: (a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0) },
    created: { label: 'Newest first', fn: (a, b) => new Date(b.created_at) - new Date(a.created_at) },
    title: { label: 'Title A–Z', fn: (a, b) => (a.title || '').localeCompare(b.title || '') },
};

function matches(post, text) {
    if (!text) return true;
    const needle = text.toLowerCase();
    return [post.title, post.slug, post.category, post.author_name, post.excerpt, ...(post.tags || [])]
        .some(v => v && String(v).toLowerCase().includes(needle));
}

function StatusCell({ post }) {
    const meta = stateMeta(post.state);
    const sub = post.state === 'scheduled' ? dateTime(post.published_at)
        : post.state === 'published' ? shortDay(post.published_at)
            : `Edited ${ago(post.updated_at)}`;
    return (
        <span className="be-status-cell">
            <Pill tone={meta.tone} dot>{meta.label}</Pill>
            <span className="ak-cell-sub">{sub}</span>
        </span>
    );
}

export default function BlogListPage() {
    const toast = useToast();
    const navigate = useNavigate();
    const [confirm, confirmDialog] = useConfirm();
    const [params, setParams] = useSearchParams();
    const status = params.get('status') || 'all';
    const query = params.get('q') || '';
    const category = params.get('category') || '';
    const sort = SORTS[params.get('sort')] ? params.get('sort') : 'edited';
    const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);

    const [posts, setPosts] = useState([]);
    const [counts, setCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState(null);

    const setParam = useCallback((changes) => {
        setParams(prev => {
            const next = new URLSearchParams(prev);
            Object.entries(changes).forEach(([k, v]) => {
                const isDefault = v === null || v === undefined || v === '' || (k === 'status' && v === 'all') || (k === 'sort' && v === 'edited') || (k === 'page' && v === 1);
                if (isDefault) next.delete(k); else next.set(k, String(v));
            });
            return next;
        }, { replace: true });
    }, [setParams]);

    const load = useCallback(() => blogService.list()
        .then(body => { setPosts(body.data || []); setCounts(body.counts || {}); setError(''); })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false)), []);

    useEffect(() => { load(); }, [load]);

    const categories = useMemo(() => [...new Set(posts.map(p => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [posts]);

    const visible = useMemo(() => posts
        .filter(p => status === 'all' || p.state === status)
        .filter(p => !category || p.category === category)
        .filter(p => matches(p, query.trim()))
        .sort(SORTS[sort].fn), [posts, status, category, query, sort]);

    const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const current = Math.min(page, pages);
    const shown = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

    const run = async (post, work, done) => {
        setBusyId(post.id);
        try {
            const result = await work();
            if (done) toast(typeof done === 'function' ? done(result) : done, 'success');
            await load();
            return result;
        } catch (err) {
            toast(err.message, 'error');
            return null;
        } finally {
            setBusyId(null);
        }
    };

    const onAction = async (post, kind) => {
        const name = post.title || 'Untitled post';
        if (kind === 'preview') {
            if (post.state === 'published') window.open(post.url, '_blank', 'noopener');
            else navigate(`/admin/blog/${post.id}?preview=1`);
            return;
        }
        if (kind === 'publish') {
            if (!(await confirm({ title: `Publish “${name}”?`, message: 'It goes on the blog right away, where anyone can read it.', confirmLabel: 'Publish now' }))) return;
            await run(post, () => blogService.publish(post.id), 'Post published');
        } else if (kind === 'unpublish') {
            const scheduled = post.state === 'scheduled';
            if (!(await confirm({
                title: scheduled ? `Cancel the schedule for “${name}”?` : `Unpublish “${name}”?`,
                message: scheduled ? 'It goes back to being a draft and will not go live.' : 'It comes off the blog and goes back to being a draft. Links to it stop working until you publish it again.',
                confirmLabel: scheduled ? 'Cancel schedule' : 'Unpublish',
                danger: !scheduled,
            }))) return;
            await run(post, () => blogService.unpublish(post.id), scheduled ? 'Schedule cancelled' : 'Post unpublished');
        } else if (kind === 'duplicate') {
            const copy = await run(post, () => blogService.duplicate(post.id), 'Copy made as a draft');
            if (copy?.id) navigate(`/admin/blog/${copy.id}`);
        } else if (kind === 'delete') {
            if (!(await confirm({
                title: `Delete “${name}”?`,
                message: `The post${post.state === 'published' ? ' comes off the blog and' : ''} is removed for good, with its pictures (unless another post uses them).`,
                confirmLabel: 'Delete post',
                danger: true,
            }))) return;
            await run(post, () => blogService.remove(post.id), 'Post deleted');
        }
    };

    const columns = [
        {
            key: 'post', header: 'Post', icon: Type,
            render: (p) => (
                <CellText
                    thumb={p.cover_image ? imageVariant(p.cover_image, 160) : ''}
                    thumbAlt=""
                    main={<span className="be-title-cell">{p.title || <em>Untitled post</em>}</span>}
                    sub={<span className="be-slug-cell">/blog/{p.slug}</span>}
                />
            ),
        },
        { key: 'status', header: 'Status', icon: CheckCircle2, width: 190, render: (p) => <StatusCell post={p} /> },
        {
            key: 'topic', header: 'Category and tags', icon: Tag, hideBelow: 1100,
            render: (p) => (p.category || p.tags.length ? (
                <CellText main={p.category || '—'} sub={p.tags.length ? p.tags.join(', ') : undefined} />
            ) : <span className="ak-cell-sub">—</span>),
        },
        {
            key: 'length', header: 'Length', icon: Clock3, width: 130, hideBelow: 1280,
            render: (p) => <CellText main={`${p.reading_minutes} min read`} sub={`${p.word_count.toLocaleString()} words`} />,
        },
        {
            key: 'actions', header: 'Actions', actions: true,
            render: (p) => (
                <RowActions>
                    {p.state === 'published'
                        ? <IconButton icon={ExternalLink} label={`View ${p.title || 'post'} on the site`} href={p.url} target="_blank" rel="noreferrer" />
                        : null}
                    <IconButton icon={PenLine} label={`Edit ${p.title || 'post'}`} to={`/admin/blog/${p.id}`} />
                    <PostRowMenu post={p} busy={busyId === p.id} onAction={(kind) => onAction(p, kind)} />
                </RowActions>
            ),
        },
    ];

    const stat = (key, icon, label) => (
        <StatCard
            icon={icon}
            value={counts[key] || 0}
            label={label}
            loading={loading}
            active={status === key}
            onClick={() => setParam({ status: status === key ? 'all' : key, page: 1 })}
        />
    );

    return (
        <Page>
            <PageHeader
                title="Blog"
                icon={Newspaper}
                subtitle="Write posts for the site's blog. Drafts stay private until you publish or schedule them."
                actions={(
                    <>
                        <Button icon={ExternalLink} href="/blog" target="_blank" rel="noreferrer">View blog</Button>
                        <Button variant="primary" icon={Plus} to="/admin/blog/new">New post</Button>
                    </>
                )}
            />

            <StatGrid label="Posts by status">
                {stat('all', FileText, 'All posts')}
                {stat('published', CheckCircle2, 'Published')}
                {stat('scheduled', CalendarClock, 'Scheduled')}
                {stat('draft', PenLine, 'Drafts')}
            </StatGrid>

            <SearchInput block value={query} onChange={(v) => setParam({ q: v, page: 1 })} placeholder="Search by title, address, category, tag or author…" label="Search posts" />

            <Toolbar
                left={(
                    <Tabs
                        label="Filter by status"
                        value={status}
                        onChange={(v) => setParam({ status: v, page: 1 })}
                        items={[
                            { value: 'all', label: 'All', count: counts.all || 0 },
                            ...Object.entries(STATES).reverse().map(([key, s]) => ({ value: key, label: s.label, count: counts[key] || 0, dot: s.tone })),
                        ]}
                    />
                )}
                right={(
                    <>
                        {categories.length > 0 && (
                            <Select
                                size="sm"
                                value={category}
                                onChange={e => setParam({ category: e.target.value, page: 1 })}
                                aria-label="Filter by category"
                                options={[{ value: '', label: 'All categories' }, ...categories.map(c => ({ value: c, label: c }))]}
                            />
                        )}
                        <Select size="sm" value={sort} onChange={e => setParam({ sort: e.target.value })} aria-label="Sort posts" options={Object.entries(SORTS).map(([k, s]) => ({ value: k, label: s.label }))} />
                    </>
                )}
            />

            {error ? (
                <Banner tone="error" action={<Button size="sm" onClick={() => { setLoading(true); load(); }}>Try again</Button>}>{error}</Banner>
            ) : (
                <DataTable
                    caption="Blog posts"
                    columns={columns}
                    rows={shown}
                    loading={loading}
                    skeletonRows={5}
                    onRowClick={(p) => navigate(`/admin/blog/${p.id}`)}
                    footer={<Pager page={current} pageSize={PAGE_SIZE} total={visible.length} onChange={(n) => setParam({ page: n })} label="posts" />}
                    empty={(
                        <EmptyState
                            icon={Newspaper}
                            title={posts.length === 0 ? 'No posts yet' : 'No posts match'}
                            action={posts.length === 0
                                ? <Button variant="primary" size="sm" icon={Plus} to="/admin/blog/new">Write your first post</Button>
                                : <Button size="sm" onClick={() => setParam({ q: '', status: 'all', category: '', page: 1 })}>Clear filters</Button>}
                        >
                            {posts.length === 0 ? 'Guides and news you write here appear on the site’s blog once you publish them.' : null}
                        </EmptyState>
                    )}
                />
            )}
            {confirmDialog}
        </Page>
    );
}
