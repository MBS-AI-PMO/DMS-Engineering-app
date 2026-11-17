import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, DollarSign, Hash, ShoppingBag, Tag, User } from 'lucide-react';
import { Banner, Button, Card, CellText, DataTable, EmptyState, Pill, Tabs } from '../../../components/admin/ui';
import { ORDER_STATUSES, ago, dateText, money, orderStatus } from '../people/format';
import './dashboard.css';

const SHOWN = 6;

/** The newest orders, with a tab per status (its count) to narrow them. Rows open the order. */
export default function RecentOrders({ orders }) {
    const navigate = useNavigate();
    const [status, setStatus] = useState('all');
    const rows = orders.rows.filter(o => status === 'all' || o.status === status).slice(0, SHOWN);
    const listLink = status === 'all' ? '/admin/orders' : `/admin/orders?status=${status}`;

    const columns = [
        { key: 'id', header: 'Order', icon: Hash, render: o => <CellText main={`#${o.id}`} sub={ago(o.created_at)} /> },
        { key: 'customer', header: 'Customer', icon: User, render: o => <CellText avatar={o.full_name || o.account_name || o.email} main={o.full_name || o.account_name || 'Guest'} sub={o.email} /> },
        { key: 'placed', header: 'Placed', icon: Clock, hideBelow: 1280, render: o => dateText(o.created_at) },
        { key: 'total', header: 'Total', icon: DollarSign, align: 'right', render: o => <strong>{money(o.total_price)}</strong> },
        {
            key: 'status', header: 'Status', icon: Tag, render: o => {
                const s = orderStatus(o.status);
                return <Pill tone={s.tone} dot>{s.label}</Pill>;
            },
        },
    ];

    return (
        <Card
            className="db-recent"
            title="Recent orders"
            icon={ShoppingBag}
            count={orders.ready && !orders.error ? orders.total : undefined}
            flush
            actions={<Button size="sm" variant="ghost" to={listLink} iconRight={ArrowRight}>All orders</Button>}
        >
            {orders.error ? (
                <div className="db-pad"><Banner tone="error">Could not load the orders. {orders.error}</Banner></div>
            ) : (
                <>
                    <div className="db-pad db-tabs">
                        <Tabs
                            label="Order status"
                            value={status}
                            onChange={setStatus}
                            items={[
                                { value: 'all', label: 'All', count: orders.ready ? orders.total : undefined },
                                ...ORDER_STATUSES.map(s => ({ value: s.key, label: s.short, count: orders.ready ? orders.byStatus[s.key] || 0 : undefined, dot: s.tone })),
                            ]}
                        />
                    </div>
                    <DataTable
                        caption="Recent orders"
                        columns={columns}
                        rows={rows}
                        loading={!orders.ready}
                        skeletonRows={4}
                        onRowClick={o => navigate(`/admin/orders/${o.id}`)}
                        empty={(
                            <EmptyState icon={ShoppingBag} title={status === 'all' ? 'No orders yet' : `No orders ${orderStatus(status).label.toLowerCase()}`}>
                                {status === 'all' ? 'Orders placed on the website show up here.' : 'Pick another status to see more.'}
                            </EmptyState>
                        )}
                    />
                </>
            )}
        </Card>
    );
}
