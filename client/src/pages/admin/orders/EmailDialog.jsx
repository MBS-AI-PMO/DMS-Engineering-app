import { useState } from 'react';
import { Send } from 'lucide-react';
import { Banner, Button, Field, Input, Modal, Tabs, Textarea } from '../../../components/admin/ui';
import { EMAIL_PRESETS } from './orderFormat';

const MAX_PHOTOS = 6;

/* Write to the customer about their order: a quick start, subject, message
 * and up to six of the order's photos. onSend({ subject, message, photoIds }). */
export default function EmailDialog({ order, photos, onSend, onClose }) {
    const [preset, setPreset] = useState('custom');
    const [subject, setSubject] = useState(EMAIL_PRESETS[0].subject(order));
    const [message, setMessage] = useState('');
    const [photoIds, setPhotoIds] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const choose = (key) => {
        const p = EMAIL_PRESETS.find(x => x.key === key);
        setPreset(key);
        setSubject(p.subject(order));
        setMessage(p.message(order));
        if (key === 'photos') setPhotoIds(photos.slice(0, MAX_PHOTOS).map(ph => ph.id));
    };
    const togglePhoto = (id) => setPhotoIds(prev => (prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length >= MAX_PHOTOS ? prev : [...prev, id]));

    const send = async (e) => {
        e.preventDefault();
        setError('');
        if (/\[[^\]]+\]/.test(message)) { setError('Replace the [bracketed] parts of the message first.'); return; }
        setBusy(true);
        try { await onSend({ subject, message, photoIds }); } catch (err) { setError(err.message); setBusy(false); }
    };

    return (
        <Modal
            title="Email the customer"
            subtitle={`To ${order.full_name ? `${order.full_name} <${order.email}>` : order.email}. Replies go to your contact email.`}
            onClose={onClose}
            size="lg"
            footer={(
                <>
                    <Button onClick={onClose} disabled={busy}>Cancel</Button>
                    <Button type="submit" form="ao-email-form" variant="primary" icon={Send} loading={busy} disabled={!subject.trim() || !message.trim()}>
                        {busy ? 'Sending…' : 'Send email'}
                    </Button>
                </>
            )}
        >
            <form id="ao-email-form" onSubmit={send}>
                <div className="ao-presets">
                    <Tabs label="Start from" value={preset} onChange={choose} items={EMAIL_PRESETS.map(p => ({ value: p.key, label: p.label }))} />
                </div>
                <Field label="Subject">
                    <Input value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} required />
                </Field>
                <Field label="Message" hint="The greeting, order summary and a link to their order are added for you.">
                    <Textarea rows={8} value={message} onChange={e => setMessage(e.target.value)} maxLength={8000} required />
                </Field>
                {photos.length > 0 && (
                    <Field as="fieldset" label={`Attach photos (${photoIds.length}/${MAX_PHOTOS} chosen)`}>
                        <div className="ao-pick-grid">
                            {photos.map(p => {
                                const on = photoIds.includes(p.id);
                                return (
                                    <label key={p.id} className={`ao-pick${on ? ' is-on' : ''}`}>
                                        <input type="checkbox" checked={on} onChange={() => togglePhoto(p.id)} disabled={!on && photoIds.length >= MAX_PHOTOS} />
                                        <img src={p.thumb_url} alt={p.caption || 'Order photo'} loading="lazy" />
                                    </label>
                                );
                            })}
                        </div>
                    </Field>
                )}
                {error && <Banner tone="error">{error}</Banner>}
            </form>
        </Modal>
    );
}
