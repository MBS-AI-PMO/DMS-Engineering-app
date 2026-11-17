import { useState } from 'react';
import { Flag } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { Button, Card, Field, Pill, Select, Textarea } from '../../../components/admin/ui';
import { quotesService } from '../../../services/admin/quotes';
import { STATUSES, statusMeta, statusTone } from './quoteFormat';

/**
 * Where the request stands. Changing it is for the shop's own tracking
 * (no email); the note goes to the activity log. Sending a price marks it
 * "Quoted" by itself.
 */
export default function QuoteStatus({ quote, onSaved }) {
    const toast = useToast();
    const [status, setStatus] = useState(quote.status);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const changed = status !== quote.status;

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            await quotesService.setStatus(quote.id, { status, note: note.trim() });
            toast(changed ? `${quote.reference} is now ${statusMeta(status).label}` : 'Note saved', 'success');
            setNote('');
            await onSaved();
        } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
    };

    return (
        <Card title="Status" icon={Flag} actions={<Pill tone={statusTone(quote.status)} dot>{statusMeta(quote.status).label}</Pill>}>
            <form className="ak-stack" onSubmit={submit}>
                <Field label="Status" hint={statusMeta(status).hint}>
                    <Select value={status} onChange={e => setStatus(e.target.value)} options={STATUSES.map(s => ({ value: s.key, label: s.label }))} />
                </Field>
                <Field label="Note" optional hint="Staff only; saved in the activity log. The customer is not emailed.">
                    <Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} maxLength={4000} placeholder={status === 'accepted' ? 'E.g. accepted by email, order to follow' : status === 'declined' ? 'Why it was declined' : ''} />
                </Field>
                <Button type="submit" block loading={busy} disabled={!changed && !note.trim()}>
                    {changed ? `Change to ${statusMeta(status).label}` : note.trim() ? 'Save note' : 'Choose a new status'}
                </Button>
            </form>
        </Card>
    );
}
