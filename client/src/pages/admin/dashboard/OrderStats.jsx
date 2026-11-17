import { DollarSign, Inbox, MessageSquareQuote, Wrench } from 'lucide-react';
import { StatGrid, StatCard } from '../../../components/admin/ui';
import { money, plural } from '../people/format';

/** The four numbers at the top: orders to review, in production, quotes to answer, sales in 30 days. */
export default function OrderStats({ orders, quotes }) {
    const ordersLoading = !orders.ready;
    const quoteValue = quotes === undefined ? undefined : quotes === null ? '—' : quotes;
    return (
        <StatGrid label="Today at a glance">
            <StatCard
                icon={Inbox}
                value={orders.error ? '—' : orders.byStatus.pending}
                label="To review"
                title="Orders waiting for review"
                to="/admin/orders?status=pending"
                loading={ordersLoading}
            />
            <StatCard
                icon={Wrench}
                value={orders.error ? '—' : orders.byStatus.processing}
                label="Production"
                title="Orders in production"
                to="/admin/orders?status=processing"
                loading={ordersLoading}
            />
            <StatCard
                icon={MessageSquareQuote}
                value={quoteValue}
                label="New quotes"
                title={quotes === null ? 'Quote requests could not be loaded' : 'Quote requests waiting for an answer'}
                to="/admin/quotes"
                loading={quotes === undefined}
            />
            <StatCard
                icon={DollarSign}
                value={orders.error ? '—' : money(orders.last30.total)}
                label="Last 30 days"
                title={orders.error ? 'Orders could not be loaded' : `${plural(orders.last30.count, 'order')} in the last 30 days, rejected ones left out`}
                to="/admin/orders"
                loading={ordersLoading}
            />
        </StatGrid>
    );
}
