import { useCallback, useEffect, useMemo, useState } from 'react';
import { AtSign, Calendar, CircleCheck, Download, Mail, Tag, Trash2, UserPlus } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import {
    Page, PageHeader, StatGrid, StatCard, SearchInput, Toolbar, Tabs, Button, IconButton, Banner,
    DataTable, CellText, RowActions, Pill, EmptyState, useConfirm,
} from '../../../components/admin/ui';
import { subscribersService } from '../../../services/admin/subscribers';
import Pager from '../people/Pager';
import { downloadCsv, datedName } from '../people/csv';
import { ago, dateText, matchesText, paginate, plural, withinDays } from '../people/format';
import '../people/people.css';

/**
 * Admin › Subscribers: emails signed up to the newsletter on the website.
 * Search, filter by status (when there is more than one), export as CSV,
 * remove one.
 */

const PAGE_SIZE = 50;
const statusLabel = (status) => (status === 'active' ? 'Subscribed' : status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown');

const CSV_COLUMNS = [
    { header: 'Email', value: s => s.email },
    { header: 'Status', value: s => s.status },
    { header: 'Subscribed', value: s => (s.subscribed_at ? new Date(s.subscribed_at).toISOString().slice(0, 10) : '') },
];

export default function SubscribersPage() {
    const toast = useToast();
    const [confirm, confirmDialog] = useConfirm();
    const [subscribers, setSubscribers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('all');
    const [page, setPage] = useState(1);
    const [removingId, setRemovingId] = useState(null);

    const load = useCallback(() => subscribersService.list()
        .then(rows => { setSubscribers(rows || []); setError(''); })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false)), []);
    useEffect(() => { load(); }, [load]);

    const statuses = useMemo(() => {
        const counts = new Map();
        subscribers.forEach(s => counts.set(s.status, (counts.get(s.status) || 0) + 1));
        return [...counts.entries()].sort((a, b) => b[1] - a[1]);
    }, [subscribers]);

    const stats = useMemo(() => ({
        total: subscribers.length,
        active: subscribers.filter(s => s.status === 'active').length,
        recent: subscribers.filter(s => withinDays(s.subscribed_at, 30)).length,
    }), [subscribers]);

    const visible = useMemo(() => subscribers
        .filter(s => status === 'all' || s.status === status)
        .filter(s => matchesText(query, s.email)), [subscribers, status, query]);
    const shown = paginate(visible, page, PAGE_SIZE);

    const remove = async (row) => {
        const yes = await confirm({
            title: `Remove ${row.email}?`,
            message: 'They will stop getting the newsletter. They can sign up again from the website.',
            confirmLabel: 'Remove',
            danger: true,
        });
        if (!yes) return;
        setRemovingId(row.id);
        try {
            await subscribersService.remove(row.id);
            setSubscribers(list => list.filter(s => s.id !== row.id));
            toast(`${row.email} removed.`, 'success');
        } catch (err) {
            toast(`Could not remove the subscriber: ${err.message}`, 'error');
        } finally {
            setRemovingId(null);
        }
    };

    const columns = [
        { key: 'email', header: 'Email', icon: Mail, render: s => <CellText avatar={s.email} main={s.email} /> },
        { key: 'status', header: 'Status', icon: Tag, render: s => <Pill tone={s.status === 'active' ? 'green' : 'gray'} dot>{statusLabel(s.status)}</Pill> },
        { key: 'subscribed', header: 'Subscribed', icon: Calendar, render: s => <CellText main={dateText(s.subscribed_at)} sub={ago(s.subscribed_at)} /> },
        {
            key: 'actions', header: 'Actions', actions: true,
            render: s => (
                <RowActions>
                    <IconButton icon={Trash2} variant="danger" label={`Remove ${s.email}`} loading={removingId === s.id} onClick={() => remove(s)} />
                </RowActions>
            ),
        },
    ];

    const filtered = query || status !== 'all';
    const emptyState = filtered ? (
        <EmptyState icon={AtSign} title="No subscribers match" action={<Button size="sm" onClick={() => { setQuery(''); setStatus('all'); setPage(1); }}>Clear search</Button>}>
            Try another part of the email address.
        </EmptyState>
    ) : (
        <EmptyState icon={AtSign} title="No subscribers yet">Emails entered in the newsletter box on the website show up here.</EmptyState>
    );

    return (
        <Page>
            <PageHeader
                icon={AtSign}
                title="Subscribers"
                subtitle={loading ? 'Newsletter sign-ups from the website.' : `${plural(stats.total, 'email')} signed up to the newsletter from the website.`}
                actions={(
                    <Button icon={Download} disabled={!visible.length} onClick={() => downloadCsv(datedName('subscribers'), CSV_COLUMNS, visible)}>
                        Export CSV
                    </Button>
                )}
            />

            {error && <Banner tone="error" action={<Button size="sm" onClick={() => { setLoading(true); load(); }}>Try again</Button>}>Could not load the subscribers. {error}</Banner>}

            <StatGrid label="Subscriber numbers">
                <StatCard icon={AtSign} value={stats.total} label="All sign-ups" loading={loading} />
                <StatCard icon={CircleCheck} value={stats.active} label="Subscribed" loading={loading} />
                <StatCard icon={UserPlus} value={stats.recent} label="New, 30 days" title="Signed up in the last 30 days" loading={loading} />
            </StatGrid>

            <SearchInput block value={query} onChange={(v) => { setQuery(v); setPage(1); }} placeholder="Search by email…" label="Search subscribers" />

            {statuses.length > 1 && (
                <Toolbar
                    left={(
                        <Tabs
                            label="Show subscribers"
                            value={status}
                            onChange={(v) => { setStatus(v); setPage(1); }}
                            items={[
                                { value: 'all', label: 'All', count: stats.total },
                                ...statuses.map(([key, count]) => ({ value: key, label: statusLabel(key), count })),
                            ]}
                        />
                    )}
                />
            )}

            <DataTable
                caption="Newsletter subscribers"
                columns={columns}
                rows={shown.rows}
                loading={loading}
                skeletonRows={6}
                empty={emptyState}
                footer={<Pager page={shown.page} pageSize={PAGE_SIZE} total={visible.length} onChange={setPage} label="subscribers" />}
            />
            {confirmDialog}
        </Page>
    );
}
