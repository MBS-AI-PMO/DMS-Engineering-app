import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { Button, KeyValue, Modal, Pill } from '../../../components/admin/ui';
import { ago, dateText, money, orderStatus, plural } from '../people/format';
import '../people/people.css';

/** One customer: contact details, shipping address and their orders. */
export default function CustomerDetail({ customer, onClose }) {
    const name = customer.name || customer.email;
    const orders = customer.orders;
    return (
        <Modal
            title={name}
            subtitle={`Customer since ${dateText(customer.created_at)} (${ago(customer.created_at)})`}
            onClose={onClose}
            footer={(
                <>
                    <Button onClick={onClose}>Close</Button>
                    <Button variant="primary" icon={Mail} href={`mailto:${customer.email}`}>Email customer</Button>
                </>
            )}
        >
            <KeyValue items={[
                ['Email', <a className="ak-link" href={`mailto:${customer.email}`}>{customer.email}</a>],
                ['Phone', customer.phone ? <a className="ak-link" href={`tel:${customer.phone}`}>{customer.phone}</a> : 'Not given'],
                ['Shipping address', customer.address || 'Not given'],
                ...(orders ? [['Spent', <span title="Rejected orders are left out">{money(customer.spent)}</span>]] : []),
            ]} />

            <h3 className="pp-section-title">{orders ? plural(orders.length, 'order') : 'Orders'}</h3>
            {!orders && <p className="ak-hint">Orders could not be loaded.</p>}
            {orders && orders.length === 0 && <p className="ak-hint">No orders yet.</p>}
            {orders && orders.length > 0 && (
                <ul className="pp-list">
                    {orders.map(o => {
                        const status = orderStatus(o.status);
                        return (
                            <li key={o.id}>
                                <Link className="pp-list-row" to={`/admin/orders/${o.id}`}>
                                    <span>
                                        <span className="ak-cell-main">Order #{o.id}</span>
                                        <span className="ak-cell-sub">{dateText(o.created_at)}{o.user_id ? '' : ' · guest checkout'}</span>
                                    </span>
                                    <span className="pp-list-end">
                                        <Pill tone={status.tone} dot>{status.label}</Pill>
                                        <strong>{money(o.total_price)}</strong>
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Modal>
    );
}
