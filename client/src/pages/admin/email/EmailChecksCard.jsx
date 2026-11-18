import { useState } from 'react';
import { CheckCircle2, MailCheck, PlugZap, Send } from 'lucide-react';
import { Banner, Button, Card, KeyValue, Pill } from '../../../components/admin/ui';
import { emailService } from '../../../services/admin/email';

const when = (at) => (at ? new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');

/**
 * Checks for the saved account: log in to the mail server (sends nothing)
 * or send a test email to the sending address, plus the last order email
 * that went out and the last that failed. A failure goes to onProblem so
 * the page can explain it at the top; onPassed clears it.
 */
export default function EmailChecksCard({ config, status, dirty, onProblem, onPassed, toast }) {
    const [busy, setBusy] = useState(null);
    const [passed, setPassed] = useState('');
    const configured = Boolean(config);

    const run = async (kind) => {
        setBusy(kind);
        setPassed('');
        try {
            const res = kind === 'test' ? await emailService.testConnection() : await emailService.sendTest();
            const message = res?.message || (kind === 'test' ? 'Connection works.' : 'Test email sent.');
            setPassed(message);
            onPassed();
            toast(message, 'success');
        } catch (err) {
            onProblem({ message: err.message, context: kind === 'test' ? 'Connection test failed' : 'The test email was not sent' });
            toast(kind === 'test' ? 'Connection test failed' : 'Test email not sent', 'error');
        } finally {
            setBusy(null);
        }
    };

    const failing = Boolean(status?.failing);

    return (
        <Card title="Check it" icon={MailCheck} subtitle="Uses the saved account.">
            {!configured && <p className="ak-hint">Save a sending account first.</p>}
            {configured && dirty && <Banner tone="warn">Save your changes first: the checks use the saved account.</Banner>}
            <div className="em-checks">
                <Button icon={PlugZap} loading={busy === 'test'} disabled={!configured || dirty || Boolean(busy)} onClick={() => run('test')} block>
                    Test connection
                </Button>
                <p className="ak-hint">Signs in to the mail server. Sends nothing.</p>
                <Button icon={Send} loading={busy === 'send'} disabled={!configured || dirty || Boolean(busy)} onClick={() => run('send')} block>
                    Send test email
                </Button>
                <p className="ak-hint">{configured ? `Sends one email to ${config.email}.` : 'Sends one email to the sending address.'}</p>
            </div>
            {passed && <Banner tone="success"><CheckCircle2 size={15} aria-hidden="true" className="em-inline-icon" /> {passed}</Banner>}

            <hr className="ak-divider" />
            <h3 className="em-h3">Order emails {failing ? <Pill tone="red" dot>Failing</Pill> : status?.lastSent ? <Pill tone="green" dot>Going out</Pill> : null}</h3>
            {status === null ? <p className="ak-hint">Loading…</p> : (
                <KeyValue
                    items={[
                        ['Last sent', status?.lastSent ? `${when(status.lastSent.at)} · #${status.lastSent.orderId}` : 'None yet'],
                        ['Last failed', status?.lastFailed ? `${when(status.lastFailed.at)} · #${status.lastFailed.orderId}` : 'None'],
                        ...(failing && status.failedSinceSent ? [['Failed in a row', String(status.failedSinceSent)]] : []),
                    ]}
                />
            )}
        </Card>
    );
}
