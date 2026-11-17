import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
    CheckCircle2, ChevronLeft, ChevronRight, Clock3, DollarSign, FileBox, FileQuestion, Hash, Inbox, Send, Tag, Trash2, User,
} from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import {
    Page, PageHeader, StatGrid, StatCard, Toolbar, Tabs, SearchInput, Select, Button, IconButton,
    DataTable, CellText, RowActions, EmptyState, Banner, Pill, useConfirm,
} from '../../../components/admin/ui';
import { quotesService } from '../../../services/admin/quotes';
import { STATUSES, ago, dateText, money, statusMeta, statusTone } from './quoteFormat';
import './adminQuotes.css';

/**
 * Admin > Quotes: requests from customers for parts the site could not
 * price instantly. Counts at the top (click one to filter), search, status
 * tabs, then the requests; a row opens the request page
 * (/admin/quotes/:id) where the shop replies with a price. Filters live in
 * the URL so "back" returns to them.
 */

const PAGE_SIZE = 20;
const SORTS = {
    newest: { label: 'Newest first', fn: (a, b) => new Date(b.created_at) - new Date(a.created_at) },
    oldest: { label: 'Oldest first', fn: (a, b) => new Date(a.created_at) - new Date(b.created_at) },
    quantity: { label: 'Largest quantity', fn: (a, b) => Number(b.quantity) - Number(a.quantity) },
};

const customerName = (q) => q.name || q.account_name || q.email;

function matches(q, text) {
    if (!text) return true;
    const needle = text.toLowerCase();
    const ref = needle.match(/^(?:q-?)?(\d+)$/);
    if (ref && String(q.id) === ref[1]) return true;
    return [q.reference, q.name, q.account_name, q.email, q.phone, q.company, q.file_name, q.material, q.thickness, q.process]
        .some(v => v && String(v).toLowerCase().includes(needle));
}

export default function QuotesList() {
    const toast = useToast();
    const navigate = useNavigate();
    const [confirm, confirmDialog] = useConfirm();
    const [params, setParams] = useSearchParams();
    const status = params.get('status') || 'all';
    const query = params.get('q') || '';
    const sort = SORTS[params.get('sort')] ? params.get('sort') : 'newest';
    const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);

    const [quotes, setQuotes] = useState([]);
    const [counts, setCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState(null);

    const setParam = useCallback((changes) => {
        setParams(prev => {
            const next = new URLSearchParams(prev);
            Object.entries(changes).forEach(([k, v]) => {
                const isDefault = v === null || v === undefined || v === '' || (k === 'status' && v === 'all') || (k === 'sort' && v === 'newest') || (k === 'page' && v === 1);
                if (isDefault) next.delete(k); else next.set(k, String(v));
            });
            return next;
        }, { replace: true });
    }, [setParams]);

    const load = useCallback(() => {
        setLoading(true);
        setError('');
        return quotesService.list()
            .then(body => { setQuotes(body.data || []); setCounts(body.counts || {}); })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const quotedValue = useMemo(() => quotes
        .filter(q => q.status === 'quoted' || q.status === 'accepted')
        .reduce((sum, q) => sum + (Number(q.quoted_total) || 0), 0), [quotes]);

    const visible = useMemo(() => quotes
        .filter(q => status === 'all' || q.status === status)
        .filter(q => matches(q, query.trim()))
        .sort(SORTS[sort].fn), [quotes, status, query, sort]);

    const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const current = Math.min(page, pages);
    const shown = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

    const remove = async (q) => {
        if (!(await confirm({
            title: `Delete quote request ${q.reference}?`,
            message: 'The request, its file and its activity are removed for good. The customer is not told.',
            confirmLabel: 'Delete',
            danger: true,
        }))) return;
        setBusyId(q.id);
        try {
            await quotesService.remove(q.id);
            toast(`${q.reference} deleted`, 'success');
            await load();
        } catch (err) { toast(err.message, 'error'); } finally { setBusyId(null); }
    };

    const columns = [
        {
            key: 'ref', header: 'Request', icon: Hash, width: 130,
            render: (q) => (
                <>
                    <Link to={`/admin/quotes/${q.id}`} className="aq-ref" onClick={e => e.stopPropagation()}>{q.reference}</Link>
                    <span className="ak-cell-sub aq-when" title={dateText(q.created_at, true)}><Clock3 size={12} aria-hidden="true" /> {ago(q.created_at)}</span>
                </>
            ),
        },
        {
            key: 'customer', header: 'Customer', icon: User,
            render: (q) => <CellText avatar={customerName(q)} main={customerName(q)} sub={q.company ? `${q.company} · ${q.email}` : q.email} />,
        },
        {
            key: 'part', header: 'Part', icon: FileBox, hideBelow: 860,
            render: (q) => (
                <CellText
                    main={<span className="ak-ellipsis aq-file-cell" title={q.file_name}>{q.file_name || '—'}</span>}
                    sub={[q.material, q.thickness, q.process].filter(Boolean).join(' · ') || '—'}
                />
            ),
        },
        { key: 'quantity', header: 'Qty', align: 'right', width: 80, render: (q) => <span className="aq-num">{q.quantity}</span> },
        { key: 'status', header: 'Status', render: (q) => <Pill tone={statusTone(q.status)} dot>{statusMeta(q.status).label}</Pill> },
        {
            key: 'quote', header: 'Quote', icon: Tag, align: 'right', hideBelow: 1100,
            render: (q) => (q.quoted_total !== null && q.quoted_total !== undefined
                ? <CellText main={<span className="aq-num">{money(q.quoted_total)}</span>} sub={q.lead_time || `${money(q.quoted_unit_price)} each`} />
                : <span className="ak-cell-sub">Not quoted</span>),
        },
        {
            key: 'actions', header: 'Actions', actions: true,
            render: (q) => (
                <RowActions>
                    <IconButton icon={Trash2} label={`Delete ${q.reference}`} variant="danger" disabled={busyId === q.id} onClick={() => remove(q)} />
                    <IconButton icon={ChevronRight} label={`Open ${q.reference}`} to={`/admin/quotes/${q.id}`} />
                </RowActions>
            ),
        },
    ];

    const pager = !loading && visible.length > PAGE_SIZE ? (
        <div className="aq-pager">
            <span>{(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, visible.length)} of {visible.length}</span>
            <div className="ak-row-actions">
                <IconButton icon={ChevronLeft} label="Previous page" disabled={current <= 1} onClick={() => setParam({ page: current - 1 })} />
                <IconButton icon={ChevronRight} label="Next page" disabled={current >= pages} onClick={() => setParam({ page: current + 1 })} />
            </div>
        </div>
    ) : null;

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
                title="Quote requests"
                icon={FileQuestion}
                subtitle="Parts customers could not price instantly. Open one to see the file and reply with a price."
            />

            <StatGrid label="Quote requests by status">
                {stat('new', Inbox, 'New')}
                {stat('quoted', Send, 'Quoted')}
                {stat('accepted', CheckCircle2, 'Accepted')}
                <StatCard icon={DollarSign} value={money(quotedValue)} label="Pipeline" loading={loading} title="Total of quoted and accepted requests" />
            </StatGrid>

            <SearchInput block value={query} onChange={(v) => setParam({ q: v, page: 1 })} placeholder="Search by reference, customer, email, company, file or material…" label="Search quote requests" />

            <Toolbar
                left={(
                    <Tabs
                        label="Filter by status"
                        value={status}
                        onChange={(v) => setParam({ status: v, page: 1 })}
                        items={[{ value: 'all', label: 'All', count: counts.all || 0 }, ...STATUSES.map(s => ({ value: s.key, label: s.label, count: counts[s.key] || 0, dot: statusTone(s.key) }))]}
                    />
                )}
                right={<Select value={sort} onChange={e => setParam({ sort: e.target.value })} aria-label="Sort quote requests" options={Object.entries(SORTS).map(([k, s]) => ({ value: k, label: s.label }))} />}
            />

            {error ? (
                <Banner tone="error" action={<Button size="sm" onClick={load}>Try again</Button>}>{error}</Banner>
            ) : (
                <DataTable
                    caption="Quote requests"
                    columns={columns}
                    rows={shown}
                    loading={loading}
                    skeletonRows={6}
                    onRowClick={(q) => navigate(`/admin/quotes/${q.id}`)}
                    footer={pager}
                    empty={(
                        <EmptyState
                            icon={FileQuestion}
                            title={quotes.length === 0 ? 'No quote requests yet' : 'No requests match'}
                            action={quotes.length > 0 ? <Button size="sm" onClick={() => setParam({ q: '', status: 'all', page: 1 })}>Clear filters</Button> : null}
                        >
                            {quotes.length === 0 ? 'When a part has no instant price, customers can request a quote. Requests show up here with their file.' : null}
                        </EmptyState>
                    )}
                />
            )}
            {confirmDialog}
        </Page>
    );
}
