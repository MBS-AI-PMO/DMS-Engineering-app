import { useId, useState } from 'react';
import { Send, Tag } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { Button, Card, Checkbox, Field, FieldRow, Input, Textarea } from '../../../components/admin/ui';
import { quotesService } from '../../../services/admin/quotes';
import { dateText, emailToast, money } from './quoteFormat';

const LEAD_TIMES = ['3 to 5 business days', '5 to 7 business days', '7 to 10 business days', '2 to 3 weeks', '3 to 4 weeks'];
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * The shop's answer: price per part, quantity (the total follows), lead
 * time and a message. Sending marks the request "Quoted" and, unless
 * unticked, emails the customer the "Quote ready" email.
 */
export default function QuoteReply({ quote, onSent }) {
    const toast = useToast();
    const listId = useId();
    const answer = quote.answer;
    const [form, setForm] = useState({
        unit: answer?.unit_price != null ? String(answer.unit_price) : '',
        quantity: String(answer?.quantity || quote.quantity || 1),
        lead: answer?.lead_time || '',
        message: answer?.message || '',
        notify: true,
    });
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);

    const unit = Number.parseFloat(form.unit);
    const qty = Number.parseInt(form.quantity, 10);
    const total = Number.isFinite(unit) && unit > 0 && Number.isInteger(qty) && qty > 0 ? round2(round2(unit) * qty) : null;

    const set = (key) => (e) => {
        const value = typeof e === 'boolean' ? e : e.target.value;
        setForm(f => ({ ...f, [key]: value }));
        if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
    };

    const submit = async (e) => {
        e.preventDefault();
        const found = {};
        if (!(Number.isFinite(unit) && unit >= 0.01)) found.unit = 'Enter the price per part.';
        if (!(Number.isInteger(qty) && qty >= 1)) found.quantity = 'Enter a quantity of 1 or more.';
        setErrors(found);
        if (Object.keys(found).length) return;
        setBusy(true);
        try {
            const result = await quotesService.reply(quote.id, {
                unit_price: unit, quantity: qty, lead_time: form.lead.trim(), message: form.message.trim(), notify: form.notify,
            });
            emailToast(toast, result.email, `Quote saved: ${money(result.quote?.answer?.total)}`);
            await onSent();
        } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
    };

    return (
        <Card
            title={answer ? 'Quote' : 'Reply with a price'}
            icon={Tag}
            subtitle={answer
                ? `Sent ${dateText(answer.quoted_at, true)}: ${money(answer.unit_price)} each × ${answer.quantity} = ${money(answer.total)}. Change it below to send an update.`
                : 'The customer gets the price, lead time and your message by email.'}
        >
            <form className="aq-reply" onSubmit={submit} noValidate>
                <FieldRow columns={3}>
                    <Field label="Price per part (USD)" error={errors.unit}>
                        <Input type="number" inputMode="decimal" min="0.01" step="0.01" value={form.unit} onChange={set('unit')} invalid={Boolean(errors.unit)} placeholder="0.00" />
                    </Field>
                    <Field label="Quantity" error={errors.quantity} hint={Number(form.quantity) !== Number(quote.quantity) ? `Customer asked for ${quote.quantity}` : undefined}>
                        <Input type="number" inputMode="numeric" min="1" step="1" value={form.quantity} onChange={set('quantity')} invalid={Boolean(errors.quantity)} />
                    </Field>
                    <Field label="Total" as="div">
                        <output className="aq-total" aria-live="polite">{total !== null ? money(total) : '—'}</output>
                    </Field>
                </FieldRow>
                <Field label="Lead time" optional hint="Shown to the customer as written.">
                    <Input value={form.lead} onChange={set('lead')} maxLength={120} list={listId} placeholder="e.g. 5 to 7 business days" />
                    <datalist id={listId}>{LEAD_TIMES.map(t => <option key={t} value={t} />)}</datalist>
                </Field>
                <Field label="Message to the customer" optional>
                    <Textarea rows={4} value={form.message} onChange={set('message')} maxLength={8000} placeholder="What the price includes, material notes, how to accept…" />
                </Field>
                <div className="aq-reply-foot">
                    <Checkbox checked={form.notify} onChange={set('notify')} label={`Email the quote to ${quote.email}`} />
                    <Button type="submit" variant="primary" icon={Send} loading={busy}>
                        {form.notify ? (answer ? 'Send updated quote' : 'Send quote') : 'Save without emailing'}
                    </Button>
                </div>
            </form>
        </Card>
    );
}
