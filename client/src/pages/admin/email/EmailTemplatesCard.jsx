import { useEffect, useState } from 'react';
import { AlertTriangle, LayoutTemplate, Send } from 'lucide-react';
import { Button, Card, EmptyState, Select, Skeleton } from '../../../components/admin/ui';
import { emailService } from '../../../services/admin/email';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/**
 * Every email the site sends, previewed with sample data, and a button that
 * sends the shown one (sample data) to the sending account.
 */
export default function EmailTemplatesCard({ config, dirty, toast, onProblem }) {
    const [templates, setTemplates] = useState(null);
    const [active, setActive] = useState(null);
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        let cancelled = false;
        emailService.templates()
            .then(list => {
                if (cancelled) return;
                setTemplates(list || []);
                if (list?.length) setActive(list[0].key);
            })
            .catch(err => { if (!cancelled) { setTemplates([]); setError(err.message); } });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!active) return undefined;
        let cancelled = false;
        emailService.preview(active)
            .then(data => { if (!cancelled) { setPreview({ key: active, ...data }); setError(''); } })
            .catch(err => { if (!cancelled) setError(err.message); });
        return () => { cancelled = true; };
    }, [active]);

    const sendSample = async () => {
        setSending(true);
        try {
            const res = await emailService.sendSample(active);
            toast(res?.message || 'Sample sent', 'success');
        } catch (err) {
            onProblem({ message: err.message, context: 'The sample email was not sent' });
            toast('Sample not sent', 'error');
        } finally {
            setSending(false);
        }
    };

    const current = templates?.find(t => t.key === active);
    const loadingPreview = active && preview?.key !== active && !error;

    return (
        <Card
            title="Emails the site sends"
            icon={LayoutTemplate}
            count={templates?.length || undefined}
            subtitle="Each uses the sender name above, the navbar logo and the phone, address and email from Admin › Contact. New-order alerts and website messages go to the inbox set there. Previews use sample data."
        >
            {templates === null ? <Skeleton size="block" /> : templates.length === 0 ? (
                <EmptyState icon={AlertTriangle} title="Could not load the emails">{error}</EmptyState>
            ) : (
                <div className="em-templates">
                    <div className="em-template-picker">
                        <Select value={active || ''} onChange={e => setActive(e.target.value)} aria-label="Email" options={templates.map(t => ({ value: t.key, label: `${t.label} (to ${t.audience.toLowerCase()})` }))} />
                    </div>
                    <ul className="em-template-list" aria-label="Emails">
                        {templates.map(t => (
                            <li key={t.key}>
                                <button type="button" className={cx('em-template', t.key === active && 'is-active')} aria-current={t.key === active ? 'true' : undefined} onClick={() => setActive(t.key)}>
                                    <span className="ak-cell-main">{t.label}</span>
                                    <span className="ak-cell-sub">To {t.audience.toLowerCase()}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <div className="em-preview">
                        <div className="em-preview-bar">
                            <div className="em-preview-subject">
                                <span className="ak-hint">Subject</span>
                                <strong>{loadingPreview ? '…' : preview?.subject || '—'}</strong>
                            </div>
                            {config && (
                                <Button size="sm" icon={Send} loading={sending} disabled={!active || dirty} onClick={sendSample} title={dirty ? 'Save your changes first' : undefined}>
                                    Send sample to {config.email}
                                </Button>
                            )}
                        </div>
                        {error ? (
                            <p className="ak-error-text em-preview-error"><AlertTriangle size={15} aria-hidden="true" className="em-inline-icon" /> {error}</p>
                        ) : (
                            <iframe className={cx('em-preview-frame', loadingPreview && 'is-loading')} title={`Preview: ${current?.label || 'email'}`} sandbox="" srcDoc={preview?.html || ''} />
                        )}
                    </div>
                </div>
            )}
        </Card>
    );
}
