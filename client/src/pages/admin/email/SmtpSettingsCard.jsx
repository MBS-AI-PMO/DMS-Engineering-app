import { useEffect, useState } from 'react';
import { Save, Server, Trash2, Undo2, Wand2 } from 'lucide-react';
import { Button, Card, Field, FieldRow, FormActions, Input, Select } from '../../../components/admin/ui';
import SecretInput from '../payments/SecretInput';
import { isGmail } from './emailProblems';

const EMPTY_SMTP = { smtp_host: '', smtp_port: 587, email: '', password: '', encryption_type: 'TLS', sender_name: 'DMS Engineering' };

const ENCRYPTION = [
    { value: 'TLS', label: 'TLS (port 587)' },
    { value: 'SSL', label: 'SSL (port 465)' },
    { value: 'NONE', label: 'None' },
];

const formOf = (config) => (config ? {
    smtp_host: config.smtp_host || '',
    smtp_port: config.smtp_port || 587,
    email: config.email || '',
    password: '',
    encryption_type: config.encryption_type || 'TLS',
    sender_name: config.sender_name || 'DMS Engineering',
} : EMPTY_SMTP);

const sameForm = (a, b) => Object.keys(EMPTY_SMTP).every(k => String(a[k] ?? '') === String(b[k] ?? ''));

/* What to say under the password box (Gmail needs an app password). */
function passwordHint(form, configured) {
    const typed = form.password.replace(/\s+/g, '');
    if (isGmail(form)) {
        if (typed && !/^[a-z]{16}$/i.test(typed)) {
            return { warn: true, text: `That is not a Gmail app password: those are exactly 16 letters (yours has ${typed.length} characters). Your normal Gmail password will not work.` };
        }
        return { text: `Gmail: paste a 16-letter app password, not your normal password.${configured ? ' Leave blank to keep the saved one.' : ''}` };
    }
    return { text: configured ? 'Leave blank to keep the saved password.' : 'Many providers need an app password when 2-step sign-in is on.' };
}

/**
 * The sending account: SMTP server, the address and password, encryption
 * and the name customers see. Save keeps a blank password as it was.
 * onSave(form) and onRemove() resolve true when done.
 */
export default function SmtpSettingsCard({ config, onSave, onRemove, onDirtyChange, passwordRef }) {
    const initial = formOf(config);
    const [form, setForm] = useState(initial);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const dirty = !sameForm(form, initial);
    const configured = Boolean(config);

    useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
    useEffect(() => {
        if (!dirty) return undefined;
        const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    const set = (key) => (e) => {
        const value = e.target.value;
        setForm(f => ({ ...f, [key]: value }));
        setErrors(x => ({ ...x, [key]: undefined }));
    };
    const useGmail = () => setForm(f => ({ ...f, smtp_host: 'smtp.gmail.com', smtp_port: 587, encryption_type: 'TLS' }));

    const save = async (e) => {
        e?.preventDefault();
        const next = {};
        if (!form.smtp_host.trim()) next.smtp_host = 'Enter the SMTP host, e.g. smtp.gmail.com.';
        if (!form.email.trim()) next.email = 'Enter the address emails are sent from.';
        const port = Number(form.smtp_port);
        if (!Number.isInteger(port) || port < 1 || port > 65535) next.smtp_port = 'Use a port from 1 to 65535 (usually 587).';
        if (!configured && !form.password.trim()) next.password = 'Enter the password (an app password for Gmail).';
        setErrors(next);
        if (Object.keys(next).length) return;
        setSaving(true);
        const done = await onSave({ ...form, smtp_host: form.smtp_host.trim(), email: form.email.trim(), smtp_port: port });
        setSaving(false);
        if (done) setForm(f => ({ ...f, password: '' }));
    };

    const pw = passwordHint(form, configured);
    const portHint = form.encryption_type === 'SSL' && Number(form.smtp_port) === 587
        ? 'SSL normally uses port 465.'
        : form.encryption_type === 'TLS' && Number(form.smtp_port) === 465 ? 'Port 465 normally needs SSL.' : undefined;

    return (
        <Card
            title="Sending account"
            icon={Server}
            subtitle="Every site email is sent from this account."
            actions={form.smtp_host.trim() !== 'smtp.gmail.com'
                ? <Button size="sm" icon={Wand2} onClick={useGmail}>Use Gmail settings</Button>
                : null}
        >
            <form onSubmit={save} noValidate>
                <FieldRow>
                    <Field label="SMTP host" error={errors.smtp_host}>
                        <Input value={form.smtp_host} invalid={Boolean(errors.smtp_host)} onChange={set('smtp_host')} placeholder="smtp.gmail.com" autoComplete="off" />
                    </Field>
                    <Field label="Port" error={errors.smtp_port} hint={portHint}>
                        <Input type="number" inputMode="numeric" value={form.smtp_port} invalid={Boolean(errors.smtp_port)} onChange={set('smtp_port')} placeholder="587" />
                    </Field>
                </FieldRow>
                <FieldRow>
                    <Field label="Email address" error={errors.email} hint="Emails come from this address; it also signs in to the server.">
                        <Input type="email" value={form.email} invalid={Boolean(errors.email)} onChange={set('email')} placeholder="orders@yourshop.com" autoComplete="off" />
                    </Field>
                    <Field label={configured ? 'Password (leave blank to keep)' : 'Password'} error={errors.password}>
                        <SecretInput
                            ref={passwordRef}
                            value={form.password}
                            invalid={Boolean(errors.password) || pw.warn}
                            onChange={set('password')}
                            placeholder={configured ? '•••••••• saved' : 'App password'}
                            aria-describedby="em-password-hint"
                        />
                        <p id="em-password-hint" className={pw.warn ? 'ak-error-text' : 'ak-hint'}>{pw.text}</p>
                    </Field>
                </FieldRow>
                <FieldRow>
                    <Field label="Encryption">
                        <Select value={form.encryption_type} options={ENCRYPTION} onChange={set('encryption_type')} />
                    </Field>
                    <Field label="Sender name" hint="What customers see as the sender.">
                        <Input value={form.sender_name} onChange={set('sender_name')} placeholder="DMS Engineering" />
                    </Field>
                </FieldRow>

                {dirty ? (
                    <FormActions sticky>
                        <span className="em-unsaved">Unsaved changes</span>
                        <Button icon={Undo2} onClick={() => { setForm(initial); setErrors({}); }} disabled={saving}>Discard</Button>
                        <Button type="submit" variant="primary" icon={Save} loading={saving}>Save</Button>
                    </FormActions>
                ) : (
                    <FormActions>
                        {configured && <Button variant="ghost" icon={Trash2} onClick={onRemove} className="em-remove">Remove account</Button>}
                        {!configured && <Button type="submit" variant="primary" icon={Save} loading={saving}>Save</Button>}
                    </FormActions>
                )}
            </form>
        </Card>
    );
}
