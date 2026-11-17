import { useMemo } from 'react';
import { LayoutDashboard, Plus, ShoppingBag } from 'lucide-react';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { Page, PageHeader, Button, SideLayout, Grid } from '../../../components/admin/ui';
import { useDashboard } from './useDashboard';
import { summarizeOrders } from './orderSummary';
import OrderStats from './OrderStats';
import RecentOrders from './RecentOrders';
import AttentionCard from './AttentionCard';
import EmailCard from './EmailCard';
import { CatalogCard, ContentCard, PeopleCard } from './SummaryCards';
import './dashboard.css';

const today = () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

/**
 * Admin home (/admin): the numbers that need action (orders to review, in
 * production, new quote requests, sales in 30 days), the newest orders by
 * status, what needs attention, the email setup, and counts with links
 * for the catalog, content, people and settings.
 */
export default function DashboardPage() {
    const { admin } = useAdminAuth();
    const data = useDashboard();
    const orders = useMemo(() => summarizeOrders(data.orders), [data.orders]);
    // New quote requests: undefined while loading, null when the list failed.
    const quotesWaiting = !data.quotes ? undefined : data.quotes.error ? null : Number(data.quotes.value?.counts?.new) || 0;
    const firstName = admin?.name?.trim().split(/\s+/)[0];

    return (
        <Page>
            <PageHeader
                icon={LayoutDashboard}
                eyebrow={today()}
                title="Dashboard"
                subtitle={`Welcome back${firstName ? `, ${firstName}` : ''}. Here is what needs you today.`}
                actions={(
                    <>
                        <Button icon={Plus} to="/admin/metals/new">Add metal</Button>
                        <Button variant="primary" icon={ShoppingBag} to="/admin/orders">Orders</Button>
                    </>
                )}
            />

            <OrderStats orders={orders} quotes={quotesWaiting} />

            <SideLayout
                main={<RecentOrders orders={orders} />}
                side={(
                    <div className="db-side">
                        <AttentionCard orders={orders} quotesWaiting={quotesWaiting} email={data.emailConfig} settings={data.settings} />
                        <EmailCard email={data.emailConfig} />
                    </div>
                )}
            />

            <div className="db-section">
                <Grid columns={3}>
                    <CatalogCard data={data} />
                    <ContentCard data={data} />
                    <PeopleCard data={data} />
                </Grid>
            </div>
        </Page>
    );
}
