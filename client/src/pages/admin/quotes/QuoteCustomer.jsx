import { Building2, Copy, Mail, Phone, User } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { Avatar, Card, IconButton, KeyValue } from '../../../components/admin/ui';
import { dateText } from './quoteFormat';

const SOURCE = { 'quote-page': 'Quote page', cart: 'Cart' };

/** Who asked: contact details, their account (if signed in) and where they asked from. */
export default function QuoteCustomer({ quote, account }) {
    const toast = useToast();
    const copy = (value, what) => navigator.clipboard?.writeText(value)
        .then(() => toast(`${what} copied`, 'success'), () => toast('Could not copy', 'error'));
    const name = quote.name || account?.name || quote.email;

    return (
        <Card title="Customer" icon={User}>
            <div className="aq-who">
                <Avatar name={name} size="lg" />
                <div className="aq-who-text">
                    <span className="aq-who-name">{name}</span>
                    <span className="ak-hint">{account ? 'Signed-in customer' : 'Guest (no account)'}</span>
                </div>
            </div>
            <ul className="aq-contact">
                <li>
                    <Mail size={14} aria-hidden="true" />
                    <a href={`mailto:${quote.email}?subject=${encodeURIComponent(`Your quote request ${quote.reference}`)}`} className="ak-link">{quote.email}</a>
                    <IconButton icon={Copy} size="xs" label="Copy email" onClick={() => copy(quote.email, 'Email')} />
                </li>
                {quote.phone && (
                    <li><Phone size={14} aria-hidden="true" /><a href={`tel:${quote.phone.replace(/[^\d+]/g, '')}`} className="ak-link">{quote.phone}</a></li>
                )}
                {quote.company && <li><Building2 size={14} aria-hidden="true" /><span>{quote.company}</span></li>}
            </ul>
            <KeyValue
                items={[
                    ['Requested', dateText(quote.created_at, true)],
                    ['From', SOURCE[quote.source] || null],
                    ['Account', account ? `${account.name || account.email}, since ${dateText(account.created_at)}` : null],
                    ['Orders', account ? String(account.order_count) : null],
                    ['Quote requests', account ? String(account.quote_count) : null],
                ]}
            />
        </Card>
    );
}
