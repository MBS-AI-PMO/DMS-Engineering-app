import { useState } from 'react';
import { ArrowRight, Mail, PlugZap } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { Banner, Button, Card, KeyValue, Pill, Skeleton } from '../../../components/admin/ui';
import { dashboardService } from '../../../services/admin/dashboard';
import { ago } from '../people/format';
import './dashboard.css';

/**
 * The email setup at a glance. "Test connection" logs in to the mail
 * server to check it works; it sends no email.
 */
export default function EmailCard({ email }) {
    const toast = useToast();
    const [testing, setTesting] = useState(false);
    const [check, setCheck] = useState(null); // { ok, message }
    const config = email?.value;

    const test = async () => {
        setTesting(true);
        try {
            const body = await dashboardService.testEmailConnection();
            setCheck({ ok: true, message: body?.message || 'Connected.' });
            toast('Email connection works.', 'success');
        } catch (err) {
            setCheck({ ok: false, message: err.message });
            toast('The email connection failed.', 'error');
        } finally {
            setTesting(false);
        }
    };

    const status = !email ? null
        : email.error ? <Pill tone="gray">Unknown</Pill>
            : !config ? <Pill tone="red" dot>Not set up</Pill>
                : check ? <Pill tone={check.ok ? 'green' : 'red'} dot>{check.ok ? 'Working' : 'Not working'}</Pill>
                    : <Pill tone="green" dot>Set up</Pill>;

    return (
        <Card title="Email" icon={Mail} actions={status}>
            {!email && (
                <div aria-hidden="true">
                    <Skeleton width="80%" />
                    <Skeleton width="60%" />
                </div>
            )}
            {email?.error && <Banner tone="error">Could not read the email setup. {email.error.message}</Banner>}
            {email && !email.error && !config && (
                <p className="db-note">Order, quote and account emails are not sent until a mail server is set up.</p>
            )}
            {config && (
                <KeyValue items={[
                    ['Sends as', config.sender_name ? `${config.sender_name} <${config.email}>` : config.email],
                    ['Server', `${config.smtp_host}:${config.smtp_port}`],
                    ['Security', config.encryption_type],
                    ['Last changed', ago(config.updated_at)],
                ]} />
            )}
            {check && <div className="db-gap"><Banner tone={check.ok ? 'success' : 'error'}>{check.message}</Banner></div>}
            {email && !email.error && (
                <div className="db-actions">
                    {config && <Button size="sm" icon={PlugZap} loading={testing} onClick={test}>Test connection</Button>}
                    <Button size="sm" variant={config ? 'ghost' : 'primary'} to="/admin/email" iconRight={ArrowRight}>
                        {config ? 'Email settings' : 'Set up email'}
                    </Button>
                </div>
            )}
        </Card>
    );
}
