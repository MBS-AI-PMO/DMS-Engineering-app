import { useCallback, useMemo, useState } from 'react';
import { Calendar, Download, Mail, MapPin, Phone, ShoppingBag, User, UserCheck, UserPlus, Users } from 'lucide-react';
import {
    Page, PageHeader, StatGrid, StatCard, SearchInput, Toolbar, Tabs, Select, Button, Banner,
    DataTable, CellText, EmptyState,
} from '../../../components/admin/ui';
import Pager from '../people/Pager';
import { downloadCsv, datedName } from '../people/csv';
import { ago, dateText, matchesText, money, paginate, plural, withinDays } from '../people/format';
import { useCustomers } from './useCustomers';
import CustomerDetail from './CustomerDetail';
import '../people/people.css';

/**
 * Admin › Customers: every account on the site (role "user"), with their
 * order count and spend. Search, filter by "has ordered", sort, export as
 * CSV; a row opens the customer's details and orders.
 */

const PAGE_SIZE = 25;
const byName = (c) => (c.name || c.email || '').toLowerCase();
const SORTS = {
    newest: { label: 'Newest first', fn: (a, b) => new Date(b.created_at) - new Date(a.created_at) },
    oldest: { label: 'Oldest first', fn: (a, b) => new Date(a.created_at) - new Date(b.created_at) },
    name: { label: 'Name A–Z', fn: (a, b) => byName(a).localeCompare(byName(b)) },
    spent: { label: 'Most spent', fn: (a, b) => (b.spent || 0) - (a.spent || 0) },
};
const FILTERS = {
    all: () => true,
    ordered: (c) => c.orderCount > 0,
    none: (c) => c.orderCount === 0,
};

const none = <span className="pp-none">—</span>;

const CSV_COLUMNS = [
    { header: 'Name', value: c => c.name },
    { header: 'Email', value: c => c.email },
    { header: 'Phone', value: c => c.phone },
    { header: 'Shipping address', value: c => c.address },
    { header: 'Joined', value: c => (c.created_at ? new Date(c.created_at).toISOString().slice(0, 10) : '') },
    { header: 'Orders', value: c => c.orderCount ?? '' },
    { header: 'Spent (USD)', value: c => (c.spent === null || c.spent === undefined ? '' : c.spent.toFixed(2)) },
];

export default function CustomersPage() {
    const { customers, loading, error, ordersError, reload } = useCustomers();
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [sort, setSort] = useState('newest');
    const [page, setPage] = useState(1);
    const [openId, setOpenId] = useState(null);
    const ordersKnown = !loading && !ordersError;

    const stats = useMemo(() => ({
        total: customers.length,
        recent: customers.filter(c => withinDays(c.created_at, 30)).length,
        withPhone: customers.filter(c => c.phone).length,
        withAddress: customers.filter(c => c.address).length,
        ordered: customers.filter(FILTERS.ordered).length,
    }), [customers]);

    const visible = useMemo(() => customers
        .filter(ordersKnown ? FILTERS[filter] : FILTERS.all)
        .filter(c => matchesText(query, c.name, c.email, c.phone, c.address))
        .sort(SORTS[sort].fn), [customers, filter, query, sort, ordersKnown]);
    const shown = paginate(visible, page, PAGE_SIZE);
    const open = customers.find(c => c.id === openId);
    const closeDetail = useCallback(() => setOpenId(null), []);

    const changeFilter = (next) => { setFilter(next); setPage(1); };
    const changeQuery = (next) => { setQuery(next); setPage(1); };

    const columns = [
        { key: 'name', header: 'Name', icon: User, render: c => <CellText avatar={c.name || c.email} main={c.name || '—'} /> },
        { key: 'email', header: 'Email', icon: Mail, render: c => c.email },
        { key: 'phone', header: 'Phone', icon: Phone, hideBelow: 1100, render: c => c.phone || none },
        { key: 'address', header: 'Shipping address', icon: MapPin, hideBelow: 1280, render: c => (c.address ? <span className="ak-ellipsis" title={c.address}>{c.address}</span> : none) },
        {
            key: 'orders', header: 'Orders', icon: ShoppingBag, render: c => (c.orderCount === null ? none
                : c.orderCount === 0 ? <span className="pp-none">None yet</span>
                    : <CellText main={plural(c.orderCount, 'order')} sub={money(c.spent)} />),
        },
        { key: 'joined', header: 'Joined', icon: Calendar, render: c => <CellText main={dateText(c.created_at)} sub={ago(c.created_at)} /> },
    ];

    const emptyState = query || filter !== 'all' ? (
        <EmptyState icon={Users} title="No customers match" action={<Button size="sm" onClick={() => { changeQuery(''); changeFilter('all'); }}>Clear search and filter</Button>}>
            Try another name, email, phone or address.
        </EmptyState>
    ) : (
        <EmptyState icon={Users} title="No customers yet">People who create an account on the website show up here.</EmptyState>
    );

    return (
        <Page>
            <PageHeader
                icon={Users}
                title="Customers"
                subtitle={loading ? 'Accounts registered on the website.' : `${plural(stats.total, 'registered customer')}. Open one to see their details and orders.`}
                actions={(
                    <Button icon={Download} disabled={!visible.length} onClick={() => downloadCsv(datedName('customers'), CSV_COLUMNS, visible)}>
                        Export CSV
                    </Button>
                )}
            />

            {error && <Banner tone="error" action={<Button size="sm" onClick={reload}>Try again</Button>}>Could not load the customers. {error}</Banner>}
            {ordersError && <Banner tone="warn">Order counts are missing: the orders could not be loaded. {ordersError}</Banner>}

            <StatGrid label="Customer numbers">
                <StatCard icon={UserCheck} value={stats.total} label="Accounts" loading={loading} />
                <StatCard icon={UserPlus} value={stats.recent} label="New, 30 days" title="Accounts created in the last 30 days" loading={loading} />
                <StatCard icon={Phone} value={stats.withPhone} label="With phone" loading={loading} />
                <StatCard icon={MapPin} value={stats.withAddress} label="With address" loading={loading} />
            </StatGrid>

            <SearchInput block value={query} onChange={changeQuery} placeholder="Search by name, email, phone or address…" label="Search customers" />

            <Toolbar
                left={ordersKnown ? (
                    <Tabs
                        label="Show customers"
                        value={filter}
                        onChange={changeFilter}
                        items={[
                            { value: 'all', label: 'All', count: stats.total },
                            { value: 'ordered', label: 'Have ordered', count: stats.ordered },
                            { value: 'none', label: 'No orders yet', count: stats.total - stats.ordered },
                        ]}
                    />
                ) : null}
                right={(
                    <Select
                        className="pp-sort"
                        aria-label="Sort customers"
                        value={sort}
                        onChange={e => { setSort(e.target.value); setPage(1); }}
                        options={Object.entries(SORTS).map(([value, s]) => ({ value, label: s.label, disabled: value === 'spent' && !ordersKnown }))}
                    />
                )}
            />

            <DataTable
                caption="Customers"
                columns={columns}
                rows={shown.rows}
                loading={loading}
                skeletonRows={8}
                empty={emptyState}
                onRowClick={c => setOpenId(c.id)}
                footer={<Pager page={shown.page} pageSize={PAGE_SIZE} total={visible.length} onChange={setPage} label="customers" />}
            />

            {open && <CustomerDetail customer={open} onClose={closeDetail} />}
        </Page>
    );
}
