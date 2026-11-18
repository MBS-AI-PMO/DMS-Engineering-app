import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowUpRight, Copy, CreditCard, Download, FileText, Mail, MapPin, Phone, RotateCcw, ShoppingBag, Trash2, TrendingUp, User } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import {
    Banner, Button, Card, Checkbox, Field, IconButton, KeyValue, Page, PageHeader, SideLayout, Skeleton, Textarea, useConfirm,
} from '../../../components/admin/ui';
import { ordersApi } from './ordersApi';
import { StatusPill } from './StatusMenu';
import OrderParts from './OrderParts';
import OrderShipping from './OrderShipping';
import OrderActivity from './OrderActivity';
import EmailDialog from './EmailDialog';
import { ANNOUNCED, BUCKET_LABEL, STATUSES, ago, dateText, emailToast, money, orderCost, paymentLabel, percent, statusMeta, statusTone } from './orderFormat';
import './adminOrders.css';

/**
 * One order, in full: where it is (progress and status update with an
 * optional email), every part with its specs, files and price breakdown,
 * photos, shipping and tracking, the customer, payment, and the activity
 * log of everything that happened (emails included, sent or not).
 */

const STEPS = ['pending', 'processing', 'shipping', 'completed'];
const BACK = { to: '/admin/orders', label: 'All orders' };

/* When each step was first reached, from the status changes in the log. */
function stepDates(order, events) {
    const dates = { pending: order.created_at };
    [...events].reverse().forEach(ev => {
        if (ev.kind === 'status' && ev.status_to && ev.status_from !== ev.status_to && !dates[ev.status_to]) dates[ev.status_to] = ev.created_at;
    });
    return dates;
}

function Progress({ order, events }) {
    const dates = stepDates(order, events);
    if (order.status === 'rejected') {
        return (
            <Banner tone="error">
                <strong>Rejected</strong>{dates.rejected ? ` on ${dateText(dates.rejected, true)}` : ''}. The customer was told we can't make it as submitted.
            </Banner>
        );
    }
    const reached = STEPS.indexOf(order.status);
    return (
        <ol className="ao-progress" aria-label="Order progress">
            {STEPS.map((key, i) => (
                <li key={key} className={`ao-step${i <= reached ? ' is-done' : ''}${i === reached ? ' is-current' : ''}`} aria-current={i === reached ? 'step' : undefined}>
                    <span className="ao-step-bar" aria-hidden="true" />
                    <span className="ao-step-label">{key === 'pending' ? 'Received' : statusMeta(key).label}</span>
                    <span className="ao-step-date">{i <= reached && dates[key] ? dateText(dates[key]) : ''}</span>
                </li>
            ))}
        </ol>
    );
}

function StatusCard({ order, onSaved }) {
    const toast = useToast();
    const [status, setStatus] = useState(order.status);
    const [note, setNote] = useState('');
    const [notify, setNotify] = useState(true);
    const [busy, setBusy] = useState(false);
    const changed = status !== order.status;
    const canEmail = ANNOUNCED.has(status);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            const result = await ordersApi.setStatus(order.id, { status, note, notify: notify && canEmail });
            emailToast(toast, result.email, changed ? `Status changed to ${statusMeta(status).label}` : 'Update saved');
            setNote('');
            await onSaved();
        } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
    };

    return (
        <Card id="ao-status" title="Status" actions={<StatusPill status={order.status} />}>
            <form onSubmit={submit}>
                <div className="ao-status-choices" role="radiogroup" aria-label="New status">
                    {STATUSES.map(s => (
                        <label key={s.key} className={`ao-status-choice is-${statusTone(s.key)}${status === s.key ? ' is-on' : ''}`}>
                            <input type="radio" name="ao-status" value={s.key} checked={status === s.key} onChange={() => setStatus(s.key)} />
                            <span className="ak-dot" aria-hidden="true" />
                            {s.label}
                        </label>
                    ))}
                </div>
                <Field label="Message to the customer" optional hint="Goes in the email and on their order page.">
                    <Textarea rows={3} value={note} onChange={e => setNote(e.target.value)} maxLength={4000}
                        placeholder={status === 'rejected' ? 'Explain what needs to change…' : status === 'shipping' ? 'Anything they should know about delivery…' : 'E.g. expected ship date…'} />
                </Field>
                <div className="ao-status-email">
                    <Checkbox
                        label={canEmail ? `Email the customer (${statusMeta(status).label} email)` : 'No email for “Pending review”'}
                        checked={notify && canEmail}
                        disabled={!canEmail}
                        onChange={setNotify}
                    />
                </div>
                <Button type="submit" variant="primary" block loading={busy} disabled={!changed && !note.trim()}>
                    {changed ? `Change to ${statusMeta(status).label}` : note.trim() ? (notify && canEmail ? 'Send update' : 'Save message') : 'Choose a new status'}
                </Button>
            </form>
        </Card>
    );
}

/* What the order cost the shop and what it earned, by cost group. */
function ProfitCard({ items }) {
    const o = orderCost(items);
    if (!o.knownCount) {
        return (
            <Card id="ao-profit" title="Cost & profit" icon={TrendingUp}>
                <p className="ak-hint">No cost could be worked out for this order. Each part says why.</p>
            </Card>
        );
    }
    const loss = o.profit < 0;
    return (
        <Card id="ao-profit" title="Cost & profit" icon={TrendingUp}>
            <div className={`ao-profit-hero ${loss ? 'is-loss' : 'is-gain'}`}>
                <span className="ao-profit-label">{loss ? 'Loss' : 'Profit'}</span>
                <strong>{money(o.profit)}</strong>
                <span className="ao-profit-margin">{percent(o.margin)} margin</span>
            </div>
            <KeyValue items={[
                ['Customer paid', money(o.paid)],
                ...Object.entries(BUCKET_LABEL).map(([key, label]) => [label, o.byBucket[key] ? money(o.byBucket[key]) : null]),
                ['Total cost', <strong key="c">{money(o.cost)}</strong>],
                ['Markups earned', o.estimated ? null : money(o.markups)],
            ]} />
            {(o.estimated || o.unknownCount > 0) && (
                <p className="ak-hint ao-pay-note">
                    {o.estimated ? "Some costs are estimates with today's rules (the order was placed before costs were saved). " : ''}
                    {o.unknownCount > 0 ? `${o.unknownCount} ${o.unknownCount === 1 ? 'part' : 'parts'} (${money(o.unknownPaid)}) left out: no cost could be worked out.` : ''}
                </p>
            )}
            <p className="ak-hint ao-pay-note">Shipping and payment fees are not included.</p>
        </Card>
    );
}

function CustomerCard({ order, account }) {
    const toast = useToast();
    const address = [order.address, [order.city, order.zip_code].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const copy = (value, what) => navigator.clipboard?.writeText(value).then(() => toast(`${what} copied`, 'success'), () => toast('Could not copy', 'error'));
    return (
        <Card id="ao-customer" title="Customer" icon={User}>
            <p className="ao-customer-name">{order.full_name || account?.name || 'Guest'}</p>
            <ul className="ao-contact">
                <li>
                    <Mail size={14} aria-hidden="true" />
                    <a href={`mailto:${order.email}?subject=${encodeURIComponent(`Your order #${order.id}`)}`}>{order.email}</a>
                    <IconButton icon={Copy} label="Copy email" size="xs" onClick={() => copy(order.email, 'Email')} />
                </li>
                {order.phone && (
                    <li>
                        <Phone size={14} aria-hidden="true" />
                        <a href={`tel:${order.phone.replace(/[^\d+]/g, '')}`}>{order.phone}</a>
                    </li>
                )}
                {address && (
                    <li>
                        <MapPin size={14} aria-hidden="true" />
                        <span>{address}</span>
                        <IconButton icon={Copy} label="Copy address" size="xs" onClick={() => copy([order.full_name, address].filter(Boolean).join('\n'), 'Address')} />
                        <IconButton icon={ArrowUpRight} label="Open in Google Maps" size="xs" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" />
                    </li>
                )}
            </ul>
            <div className="ao-account">
                {account ? (
                    <>
                        <span>Account since {dateText(account.created_at)}</span>
                        <span>{account.order_count} {account.order_count === 1 ? 'order' : 'orders'} · {money(account.lifetime_total)} total</span>
                        {account.email && account.email.toLowerCase() !== String(order.email).toLowerCase() && <span>Account email: {account.email}</span>}
                    </>
                ) : <span>Guest checkout, no account</span>}
            </div>
        </Card>
    );
}

function PaymentCard({ order, items }) {
    const subtotal = items.reduce((s, i) => s + (i.line_total !== null && i.line_total !== undefined ? Number(i.line_total) : Number(i.unit_price) * (Number(i.quantity) || 1)), 0);
    const clientTotal = order.client_total_price !== null && order.client_total_price !== undefined ? Number(order.client_total_price) : null;
    return (
        <Card id="ao-pay" title="Payment" icon={CreditCard}>
            <KeyValue items={[
                ['Method', paymentLabel(order.payment_method)],
                ['Reference', order.payment_id ? <span className="ak-mono">{order.payment_id}</span> : null],
                ['Parts', money(subtotal)],
                ['Order total', <strong key="t" className="ao-total">{money(order.total_price)}</strong>],
                ['Customer saw', clientTotal !== null && Math.abs(clientTotal - Number(order.total_price)) >= 0.01 ? money(clientTotal) : null],
            ]} />
            <p className="ak-hint ao-pay-note">
                {String(order.payment_method).toUpperCase() === 'PAYPAL' ? 'Paid online with PayPal.' : 'Collect payment when the parts are delivered.'}
                {order.pricing_version ? ` Prices checked by the server at checkout (${order.pricing_version}).` : ''}
            </p>
        </Card>
    );
}

function DetailSkeleton() {
    return (
        <Page busy>
            <PageHeader back={BACK} title={<Skeleton width={260} size="lg" />} subtitle={<Skeleton width={320} />} />
            <SideLayout
                main={[0, 1].map(i => <Card key={i}><Skeleton width={140} /><Skeleton size="block" /></Card>)}
                side={[0, 1, 2].map(i => <Card key={i}><Skeleton width={110} /><Skeleton size="block" /></Card>)}
            />
        </Page>
    );
}

export default function OrderDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const [confirm, confirmDialog] = useConfirm();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [emailing, setEmailing] = useState(false);
    const [working, setWorking] = useState('');

    const load = useCallback(() => ordersApi.detail(id)
        .then(d => { setData(d); setError(''); })
        .catch(err => setError(err.message)), [id]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (data?.order) document.title = `Order #${data.order.id} · Admin`;
    }, [data?.order]);

    if (error && !data) {
        return (
            <Page>
                <PageHeader back={BACK} title="Order" />
                <Banner tone="error" action={<Button size="sm" onClick={load}>Try again</Button>}>{error}</Banner>
            </Page>
        );
    }
    if (!data) return <DetailSkeleton />;

    const { order, account, items, shipments, photos, events, carriers } = data;
    const pieces = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    const trashed = order.admin_deletion_status === 'soft_deleted';

    const run = async (key, fn) => {
        setWorking(key);
        try { await fn(); } catch (err) { toast(err.message, 'error'); } finally { setWorking(''); }
    };
    const report = () => run('pdf', async () => {
        const { generateOrderReport } = await import('../../../utils/generateOrderReport');
        await generateOrderReport(order, items.map(i => ({ ...i, configuration_json: i.configuration })));
        toast('PDF report downloaded', 'success');
    });
    const zip = () => run('zip', () => ordersApi.downloadZip(order.id));
    const trash = async () => {
        if (!(await confirm({ title: `Move order #${order.id} to the trash?`, message: 'You can restore it from the trash later.', confirmLabel: 'Move to trash', danger: true }))) return;
        run('trash', async () => {
            await ordersApi.trash(order.id);
            toast(`Order #${order.id} moved to trash`, 'success');
            navigate('/admin/orders');
        });
    };
    const restore = () => run('restore', async () => {
        await ordersApi.restore(order.id);
        toast(`Order #${order.id} restored`, 'success');
        await load();
    });
    const sendEmail = async (body) => {
        const result = await ordersApi.email(order.id, body);
        emailToast(toast, result.email, 'Message saved to the activity log');
        setEmailing(false);
        await load();
    };

    return (
        <Page>
            <PageHeader
                back={BACK}
                icon={ShoppingBag}
                eyebrow={`Placed ${dateText(order.created_at, true)} · ${ago(order.created_at)}`}
                title={<>Order #{order.id} <StatusPill status={order.status} /></>}
                subtitle={<>{items.length} {items.length === 1 ? 'file' : 'files'} · {pieces} pcs · <strong className="ao-total">{money(order.total_price)}</strong> · {paymentLabel(order.payment_method)}</>}
                actions={(
                    <>
                        <Button variant="primary" icon={Mail} onClick={() => setEmailing(true)}>Email customer</Button>
                        <Button icon={Download} loading={working === 'zip'} onClick={zip}>All files (.zip)</Button>
                        <Button icon={FileText} loading={working === 'pdf'} onClick={report}>PDF report</Button>
                        {!trashed && <IconButton icon={Trash2} label="Move to trash" variant="danger" loading={working === 'trash'} onClick={trash} />}
                    </>
                )}
            />

            {trashed && (
                <Banner tone="warn" action={<Button size="sm" icon={RotateCcw} loading={working === 'restore'} onClick={restore}>Restore</Button>}>
                    This order is in the trash.
                </Banner>
            )}

            <Progress order={order} events={events} />

            <SideLayout
                main={(
                    <>
                        <OrderParts items={items} />
                        <OrderActivity orderId={order.id} order={order} events={events} onChanged={load} />
                    </>
                )}
                side={(
                    <>
                        <StatusCard key={order.status} order={order} onSaved={load} />
                        <ProfitCard items={items} />
                        <OrderShipping orderId={order.id} status={order.status} shipments={shipments} carriers={carriers} onChanged={load} />
                        <CustomerCard order={order} account={account} />
                        <PaymentCard order={order} items={items} />
                    </>
                )}
            />

            {emailing && <EmailDialog order={order} photos={photos} onSend={sendEmail} onClose={() => setEmailing(false)} />}
            {confirmDialog}
        </Page>
    );
}
