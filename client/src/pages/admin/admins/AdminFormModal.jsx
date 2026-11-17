import { useState } from 'react';
import { Save, UserPlus } from 'lucide-react';
import { Banner, Button, Field, Input, Modal } from '../../../components/admin/ui';
import { adminsService } from '../../../services/admin/admins';
import { PasswordInput } from '../people/PasswordInput';

const MIN_PASSWORD = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function check(form, isNew) {
    const errors = {};
    if (!form.email.trim()) errors.email = 'Add an email address.';
    else if (!EMAIL_RE.test(form.email.trim())) errors.email = 'This is not a valid email address.';
    if (isNew && !form.password) errors.password = 'Choose a password.';
    else if (form.password && form.password.length < MIN_PASSWORD) errors.password = `Use at least ${MIN_PASSWORD} characters.`;
    if (form.password && form.password !== form.confirmPassword) errors.confirmPassword = 'The passwords do not match.';
    return errors;
}

/**
 * Add an admin (admin = null) or change one: name, email and password.
 * When editing, a blank password keeps the current one.
 * onSaved(row, isNew) gets the saved admin.
 */
export default function AdminFormModal({ admin, isSelf, onClose, onSaved }) {
    const isNew = !admin;
    const [form, setForm] = useState({ name: admin?.name || '', email: admin?.email || '', password: '', confirmPassword: '' });
    const [errors, setErrors] = useState({});
    const [serverError, setServerError] = useState('');
    const [saving, setSaving] = useState(false);
    const set = (key) => (e) => {
        const value = e.target.value;
        setForm(f => ({ ...f, [key]: value }));
        if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
    };

    const submit = async (e) => {
        e.preventDefault();
        const found = check(form, isNew);
        setErrors(found);
        setServerError('');
        if (Object.keys(found).length) return;
        const body = { name: form.name.trim(), email: form.email.trim() };
        if (form.password) body.password = form.password;
        setSaving(true);
        try {
            const saved = isNew ? await adminsService.create(body) : await adminsService.update(admin.id, body);
            onSaved(saved, isNew);
        } catch (err) {
            setServerError(err.message);
            setSaving(false);
        }
    };

    return (
        <Modal
            title={isNew ? 'Add an admin' : `Edit ${admin.name?.trim() || admin.email}`}
            subtitle={isNew ? 'They can sign in at /admin/login with this email and password.' : isSelf ? 'This is your own account.' : undefined}
            onClose={onClose}
            footer={(
                <>
                    <Button onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button type="submit" form="admin-form" variant="primary" icon={isNew ? UserPlus : Save} loading={saving}>
                        {isNew ? 'Add admin' : 'Save changes'}
                    </Button>
                </>
            )}
        >
            <form id="admin-form" onSubmit={submit} noValidate>
                {serverError && <Banner tone="error">{serverError}</Banner>}
                <Field label="Name" optional>
                    <Input value={form.name} onChange={set('name')} autoComplete="off" placeholder="Full name" maxLength={120} autoFocus={isNew} />
                </Field>
                <Field label="Email" error={errors.email}>
                    <Input type="email" value={form.email} onChange={set('email')} autoComplete="off" placeholder="name@example.com" invalid={Boolean(errors.email)} />
                </Field>
                <Field
                    label={isNew ? 'Password' : 'New password'}
                    optional={!isNew}
                    hint={isNew ? `At least ${MIN_PASSWORD} characters.` : 'Leave blank to keep the current password.'}
                    error={errors.password}
                >
                    <PasswordInput value={form.password} onChange={set('password')} autoComplete="new-password" invalid={Boolean(errors.password)} />
                </Field>
                {form.password && (
                    <Field label="Confirm password" error={errors.confirmPassword}>
                        <PasswordInput value={form.confirmPassword} onChange={set('confirmPassword')} autoComplete="new-password" invalid={Boolean(errors.confirmPassword)} />
                    </Field>
                )}
            </form>
        </Modal>
    );
}
