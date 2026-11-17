import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Flag, Inbox, Loader2, Mail, RefreshCw, StickyNote, Tag, Trash2 } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { Button, Card, IconButton, Pill, Textarea, useConfirm } from '../../../components/admin/ui';
import { quotesService } from '../../../services/admin/quotes';
import { ago, dateText } from './quoteFormat';

const ICONS = { created: Inbox, status: Flag, email: Mail, note: StickyNote, reply: Tag };

function EmailState({ event }) {
    if (event.email_status === 'sent') return <Pill tone="green"><CheckCircle2 size={12} aria-hidden="true" /> Sent</Pill>;
    if (event.email_status === 'sending') return <Pill tone="gray"><Loader2 size={12} className="ak-spin" aria-hidden="true" /> Sending</Pill>;
    if (event.email_status === 'failed') return <Pill tone="red"><AlertTriangle size={12} aria-hidden="true" /> Not sent</Pill>;
    return null;
}

/**
 * Everything that happened to the request, newest first: the request
 * itself, emails (and whether they went out), the quote, status changes
 * and staff notes.
 */
export default function QuoteActivity({ quoteId, events, onChanged }) {
    const toast = useToast();
    const [confirm, confirmDialog] = useConfirm();
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const addNote = async (e) => {
        e.preventDefault();
        if (!note.trim()) return;
        setBusy(true);
        try {
            await quotesService.addNote(quoteId, note.trim());
            setNote('');
            await onChanged();
        } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
    };
    const removeNote = async (event) => {
        if (!(await confirm({ title: 'Delete this note?', confirmLabel: 'Delete', danger: true }))) return;
        try { await quotesService.deleteNote(quoteId, event.id); await onChanged(); } catch (err) { toast(err.message, 'error'); }
    };
    const refresh = async () => {
        setRefreshing(true);
        try { await onChanged(); } finally { setRefreshing(false); }
    };

    return (
        <Card title="Activity" count={events.length} actions={<IconButton icon={RefreshCw} label="Refresh activity" onClick={refresh} loading={refreshing} />}>
            <form className="aq-note-form" onSubmit={addNote}>
                <Textarea
                    rows={2}
                    value={note}
                    maxLength={4000}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Add an internal note (staff only). E.g. called the customer, waiting on a material price…"
                    aria-label="Internal note"
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote(e); }}
                />
                <Button type="submit" loading={busy} disabled={!note.trim()}>Add note</Button>
            </form>

            <ol className="aq-timeline">
                {events.map(ev => {
                    const Icon = ICONS[ev.kind] || Flag;
                    return (
                        <li key={ev.id} className={`aq-event is-${ev.kind}${ev.email_status === 'failed' ? ' is-failed' : ''}`}>
                            <span className="aq-event-icon" aria-hidden="true"><Icon size={14} /></span>
                            <div className="aq-event-body">
                                <div className="aq-event-top">
                                    <span className="aq-event-title">{ev.title}</span>
                                    {ev.kind === 'email' && <EmailState event={ev} />}
                                </div>
                                {ev.kind === 'email' && ev.email_to && (
                                    <p className="ak-hint">To {ev.email_to}{ev.email_subject ? ` · “${ev.email_subject}”` : ''}</p>
                                )}
                                {ev.email_status === 'failed' && ev.email_error && <div className="aq-event-error">{ev.email_error}</div>}
                                {ev.body && <p className="aq-event-text">{ev.body}</p>}
                                <div className="aq-event-meta">
                                    <time dateTime={ev.created_at} title={dateText(ev.created_at, true)}>{ago(ev.created_at)}</time>
                                    {ev.actor_email && <span> · {ev.actor_email}</span>}
                                    {ev.kind === 'note' && (
                                        <button type="button" className="aq-text-btn" onClick={() => removeNote(ev)}><Trash2 size={12} aria-hidden="true" /> Delete</button>
                                    )}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ol>
            {confirmDialog}
        </Card>
    );
}
