import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
    ArrowUpRight, ChevronLeft, ChevronRight, Clock3, CreditCard, DollarSign, Inbox, Layers, PackageCheck, RotateCcw, ShoppingBag, Trash2, Truck, User, Wrench,
} from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import {
    Page, PageHeader, Segmented, StatGrid, StatCard, Toolbar, Tabs, SearchInput, Select, Button, IconButton,
    DataTable, CellText, RowActions, EmptyState, Banner, useConfirm,
} from '../../../components/admin/ui';
import { ordersApi } from './ordersApi';
import StatusMenu, { StatusPill } from './StatusMenu';
import { STATUSES, ago, dateText, emailToast, money, paymentLabel, statusMeta, statusTone } from './orderFormat';
import './adminOrders.css';

/**
 * Admin > Orders: every order placed on the site. Counts by status at the
 * top (click one to filter), then status tabs, search and sort, then the
 * orders; a row opens the order page (/admin/orders/:id). Status can be
 * changed from the row, with or without emailing the customer. Trash keeps
 * orders moved out of the queue until restored or deleted for good.
 * Filters live in the URL so "back" returns to them.
 */

const PAGE_SIZE = 20;
const SORTS = {
    newest: { label: 'Newest first', fn: (a, b) => new Date(b.created_at) - new Date(a.created_at) },
    oldest: { label: 'Oldest first', fn: (a, b) => new Date(a.created_at) - new Date(b.created_at) },
    high: { label: 'Highest total', fn: (a, b) => Number(b.total_price) - Number(a.total_price) },
    low: { label: 'Lowest total', fn: (a, b) => Number(a.total_price) - Number(b.total_price) },
};
const STAT_ICONS = { pending: Inbox, processing: Wrench, shipping: Truck, completed: PackageCheck };

const customerName = (o) => o.full_name || o.account_name || 'Guest';

function matches(order, q) {
    if (!q) return true;
    const needle = q.toLowerCase().replace(/^#/, '');
    return [
        String(order.id), order.full_name, order.account_name, order.email, order.phone, order.city, order.zip_code,
        order.payment_id, order.last_shipment?.tracking_number, ...(order.file_names || []), ...(order.materials || []),
    ].some(v => v && String(v).toLowerCase().includes(needle));
}

export default function OrdersList() {
    const toast = useToast();
    const navigate = useNavigate();
    const [confirm, confirmDialog] = useConfirm();
    const [params, setParams] = useSearchParams();
    const view = params.get('view') === 'trash' ? 'trash' : 'active';
    const status = params.get('status') || 'all';
    const query = params.get('q') || '';
    const sort = SORTS[params.get('sort')] ? params.get('sort') : 'newest';
    const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);

    const [orders, setOrders] = useState([]);
    const [counts, setCounts] = useState({ active: 0, trash: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState(null);

    const setParam = useCallback((changes) => {
        setParams(prev => {
            const next = new URLSearchParams(prev);
            Object.entries(changes).forEach(([k, v]) => {
                const isDefault = v === null || v === undefined || v === '' || (k === 'status' && v === 'all') || (k === 'sort' && v === 'newest') || (k === 'page' && v === 1) || (k === 'view' && v === 'active');
                if (isDefault) next.delete(k); else next.set(k, String(v));
            });
            return next;
        }, { replace: true });
    }, [setParams]);

    const load = useCallback(() => {
        setLoading(true);
        setError('');
        return ordersApi.list(view)
            .then(d => { setOrders(d.data || []); setCounts(d.counts || { active: 0, trash: 0 }); })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [view]);

    useEffect(() => { load(); }, [load]);

    const byStatus = useMemo(() => {
        const map = Object.fromEntries(STATUSES.map(s => [s.key, 0]));
        orders.forEach(o => { map[o.status] = (map[o.status] || 0) + 1; });
        return map;
    }, [orders]);

    const last30 = useMemo(() => {
        const since = Date.now() - 30 * 86400000;
        const recent = orders.filter(o => new Date(o.created_at).getTime() >= since && o.status !== 'rejected');
        return { total: recent.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0), count: recent.length };
    }, [orders]);

    const visible = useMemo(() => orders
        .filter(o => status === 'all' || o.status === status)
        .filter(o => matches(o, query.trim()))
        .sort(SORTS[sort].fn), [orders, status, query, sort]);

    const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const current = Math.min(page, pages);
    const shown = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

    const changeStatus = async (order, next, notify) => {
        try {
            const result = await ordersApi.setStatus(order.id, { status: next, notify });
            setOrders(prev => prev.map(o => (o.id === order.id ? { ...o, status: next } : o)));
            emailToast(toast, result.email, `Order #${order.id} is now ${statusMeta(next).label}`);
        } catch (err) { toast(err.message, 'error'); }
    };

    const act = async (order, action) => {
        if (action === 'destroy' && !(await confirm({ title: `Delete order #${order.id} for good?`, message: 'Its files and photos are removed too. This cannot be undone.', confirmLabel: 'Delete for good', danger: true }))) return;
        setBusyId(order.id);
        try {
            await ordersApi[action](order.id);
            toast(action === 'trash' ? `Order #${order.id} moved to trash` : action === 'restore' ? `Order #${order.id} restored` : `Order #${order.id} deleted`, 'success');
            await load();
        } catch (err) { toast(err.message, 'error'); } finally { setBusyId(null); }
    };

    const emptyTrash = async () => {
        if (!(await confirm({ title: `Delete all ${orders.length} orders in the trash?`, message: 'They are removed for good, with their files and photos.', confirmLabel: 'Empty trash', danger: true }))) return;
        const results = await Promise.allSettled(orders.map(o => ordersApi.destroy(o.id)));
        const failed = results.filter(r => r.status === 'rejected').length;
        toast(failed ? `${failed} could not be deleted` : 'Trash emptied', failed ? 'warning' : 'success');
        load();
    };

    const columns = [
        {
            key: 'order', header: 'Order', width: 120,
            render: (o) => (
                <>
                    <Link to={`/admin/orders/${o.id}`} className="ao-order-no" onClick={e => e.stopPropagation()}>#{o.id}</Link>
                    <span className="ak-cell-sub ao-when" title={dateText(o.created_at, true)}><Clock3 size={12} aria-hidden="true" /> {ago(o.created_at)}</span>
                </>
            ),
        },
        { key: 'customer', header: 'Customer', icon: User, render: (o) => <CellText avatar={customerName(o)} main={customerName(o)} sub={o.email} /> },
        {
            key: 'parts', header: 'Parts', icon: Layers, hideBelow: 860,
            render: (o) => (
                <CellText
                    main={`${o.item_count} ${Number(o.item_count) === 1 ? 'file' : 'files'} · ${o.part_count} pcs`}
                    sub={<span className="ak-ellipsis" title={(o.file_names || []).join(', ')}>{(o.materials || []).join(', ') || o.file_names?.[0] || '—'}</span>}
                />
            ),
        },
        {
            key: 'total', header: 'Total', icon: CreditCard, align: 'right',
            render: (o) => <CellText main={<span className="ao-money">{money(o.total_price)}</span>} sub={<span title={o.payment_id || undefined}>{paymentLabel(o.payment_method)}</span>} />,
        },
        {
            key: 'status', header: 'Status',
            render: (o) => (view === 'trash'
                ? <StatusPill status={o.status} />
                : <StatusMenu status={o.status} onChange={(next, notify) => changeStatus(o, next, notify)} />),
        },
        {
            key: 'shipping', header: 'Shipping', icon: Truck, hideBelow: 1100,
            render: (o) => (o.last_shipment ? (
                <CellText
                    main={`${o.last_shipment.carrier}${o.shipment_count > 1 ? ` +${o.shipment_count - 1}` : ''}`}
                    sub={o.last_shipment.tracking_link ? (
                        <a className="ao-track" href={o.last_shipment.tracking_link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                            {o.last_shipment.tracking_number} <ArrowUpRight size={12} aria-hidden="true" />
                        </a>
                    ) : o.last_shipment.tracking_number}
                />
            ) : <span className="ak-cell-sub">Not shipped</span>),
        },
        {
            key: 'actions', header: 'Actions', actions: true,
            render: (o) => (
                <RowActions>
                    {view === 'trash' ? (
                        <>
                            <IconButton icon={RotateCcw} label={`Restore order #${o.id}`} disabled={busyId === o.id} onClick={() => act(o, 'restore')} />
                            <IconButton icon={Trash2} label={`Delete order #${o.id} for good`} variant="danger" disabled={busyId === o.id} onClick={() => act(o, 'destroy')} />
                        </>
                    ) : (
                        <>
                            <IconButton icon={Trash2} label={`Move order #${o.id} to trash`} variant="danger" disabled={busyId === o.id} onClick={() => act(o, 'trash')} />
                            <IconButton icon={ChevronRight} label={`Open order #${o.id}`} to={`/admin/orders/${o.id}`} />
                        </>
                    )}
                </RowActions>
            ),
        },
    ];

    const pager = !loading && visible.length > PAGE_SIZE ? (
        <div className="ao-pager">
            <span>{(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, visible.length)} of {visible.length}</span>
            <div className="ak-row-actions">
                <IconButton icon={ChevronLeft} label="Previous page" disabled={current <= 1} onClick={() => setParam({ page: current - 1 })} />
                <IconButton icon={ChevronRight} label="Next page" disabled={current >= pages} onClick={() => setParam({ page: current + 1 })} />
            </div>
        </div>
    ) : null;

    return (
        <Page>
            <PageHeader
                title="Orders"
                icon={ShoppingBag}
                subtitle="Every order placed on the website. Open one to see its parts, files, photos, shipping and emails."
                actions={(
                    <Segmented
                        label="Order lists"
                        value={view}
                        onChange={(v) => setParam({ view: v, status: 'all', page: 1 })}
                        items={[{ value: 'active', label: 'Orders', count: counts.active }, { value: 'trash', label: 'Trash', icon: Trash2, count: counts.trash }]}
                    />
                )}
            />

            {view === 'active' && (
                <StatGrid label="Orders by status">
                    {STATUSES.filter(s => STAT_ICONS[s.key]).map(s => (
                        <StatCard
                            key={s.key}
                            icon={STAT_ICONS[s.key]}
                            tone={statusTone(s.key)}
                            value={byStatus[s.key] || 0}
                            label={s.label}
                            loading={loading}
                            active={status === s.key}
                            onClick={() => setParam({ status: status === s.key ? 'all' : s.key, page: 1 })}
                        />
                    ))}
                    <StatCard icon={DollarSign} value={money(last30.total)} label="Last 30 days" loading={loading} title={`${last30.count} ${last30.count === 1 ? 'order' : 'orders'} in the last 30 days, rejected ones left out`} />
                </StatGrid>
            )}

            <Toolbar
                left={(
                    <Tabs
                        label="Filter by status"
                        value={status}
                        onChange={(v) => setParam({ status: v, page: 1 })}
                        items={[{ value: 'all', label: 'All', count: orders.length }, ...STATUSES.map(s => ({ value: s.key, label: s.short, count: byStatus[s.key] || 0, dot: statusTone(s.key) }))]}
                    />
                )}
                right={(
                    <>
                        <SearchInput value={query} onChange={(v) => setParam({ q: v, page: 1 })} placeholder="Order #, customer, email, file, tracking…" label="Search orders" />
                        <Select value={sort} onChange={e => setParam({ sort: e.target.value })} aria-label="Sort orders" options={Object.entries(SORTS).map(([k, s]) => ({ value: k, label: s.label }))} />
                        {view === 'trash' && orders.length > 0 && <Button variant="danger" icon={Trash2} onClick={emptyTrash}>Empty trash</Button>}
                    </>
                )}
            />

            {error ? (
                <Banner tone="error" action={<Button size="sm" onClick={load}>Try again</Button>}>{error}</Banner>
            ) : (
                <DataTable
                    caption="Orders"
                    columns={columns}
                    rows={shown}
                    loading={loading}
                    skeletonRows={6}
                    onRowClick={(o) => navigate(`/admin/orders/${o.id}`)}
                    footer={pager}
                    empty={(
                        <EmptyState
                            icon={Inbox}
                            title={orders.length === 0 ? (view === 'trash' ? 'The trash is empty' : 'No orders yet') : 'No orders match'}
                            action={orders.length > 0 ? <Button size="sm" onClick={() => setParam({ q: '', status: 'all', page: 1 })}>Clear filters</Button> : null}
                        >
                            {orders.length === 0 && view === 'active' ? 'Orders appear here as soon as a customer checks out.' : null}
                        </EmptyState>
                    )}
                />
            )}
            {confirmDialog}
        </Page>
    );
}
