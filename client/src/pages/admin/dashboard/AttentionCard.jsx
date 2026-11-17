import { BellRing, CircleCheck, CreditCard, Inbox, MailWarning, MessageSquareQuote } from 'lucide-react';
import { Card, Skeleton } from '../../../components/admin/ui';
import { ago, plural } from '../people/format';
import LinkList from './LinkList';

/**
 * What needs someone now: orders waiting for review, quote requests to
 * answer, email not set up, no way to pay at checkout. "All caught up"
 * when nothing does.
 */
export default function AttentionCard({ orders, quotesWaiting, email, settings }) {
    const loading = !orders.ready || quotesWaiting === undefined || email === undefined || settings === undefined;
    const items = [];

    const pending = orders.byStatus.pending || 0;
    if (pending > 0) {
        items.push({
            to: '/admin/orders?status=pending',
            icon: Inbox,
            tone: 'amber',
            label: `${plural(pending, 'order')} to review`,
            sub: orders.oldestPending ? `Oldest placed ${ago(orders.oldestPending.created_at)}` : undefined,
        });
    }
    if (quotesWaiting > 0) {
        items.push({ to: '/admin/quotes', icon: MessageSquareQuote, tone: 'violet', label: `${plural(quotesWaiting, 'quote request')} to answer`, sub: 'Customers are waiting for a price' });
    }
    if (email && !email.error && !email.value) {
        items.push({ to: '/admin/email', icon: MailWarning, tone: 'red', label: 'Email is not set up', sub: 'Customers get no order or quote emails' });
    }
    const site = settings?.value;
    if (site && !site.payment_cod_enabled && !site.payment_paypal_enabled) {
        items.push({ to: '/admin/payment', icon: CreditCard, tone: 'red', label: 'No way to pay is turned on', sub: 'Customers cannot check out' });
    }

    return (
        <Card title="Needs attention" icon={BellRing} count={items.length || undefined}>
            {items.length > 0 ? <LinkList items={items} />
                : loading ? (
                    <div aria-hidden="true">
                        <Skeleton width="70%" />
                        <Skeleton width="45%" size="sm" />
                    </div>
                ) : (
                    <div className="db-calm" role="status">
                        <span className="db-link-icon is-tile is-green" aria-hidden="true"><CircleCheck size={17} /></span>
                        <span className="db-link-text">
                            <span className="db-link-label">All caught up</span>
                            <span className="db-link-sub">No orders or quote requests are waiting.</span>
                        </span>
                    </div>
                )}
        </Card>
    );
}
