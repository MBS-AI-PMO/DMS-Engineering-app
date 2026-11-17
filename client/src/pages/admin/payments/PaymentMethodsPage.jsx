import { useCallback, useEffect, useState } from 'react';
import { CreditCard, RotateCcw, Save, Truck, Undo2 } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { Banner, Button, Card, FormActions, Page, PageHeader, Skeleton, Stack } from '../../../components/admin/ui';
import { paymentsService } from '../../../services/admin/payments';
import PaymentMethodCard from './PaymentMethodCard';
import PaypalSettings from './PaypalSettings';
import PaypalLogo from './PaypalLogo';
import './payments.css';

const FIELDS = ['cod_enabled', 'paypal_enabled', 'paypal_mode', 'sandbox_client_id', 'sandbox_secret', 'live_client_id', 'live_secret'];
const same = (a, b) => FIELDS.every(k => String(a?.[k] ?? '') === String(b?.[k] ?? ''));

/* What a customer can choose at checkout with these settings. */
function checkoutSummary(s) {
    const ways = [s.cod_enabled && 'cash on delivery', s.paypal_enabled && `PayPal${s.paypal_mode === 'sandbox' ? ' (sandbox: test payments only)' : ''}`].filter(Boolean);
    return ways.length ? `At checkout customers can pay by ${ways.join(' or ')}.` : 'No payment method is on.';
}

/* The same rules the server checks, said before saving. */
function validate(form) {
    const errors = {};
    if (!form.cod_enabled && !form.paypal_enabled) errors.form = 'Keep at least one payment method on, or customers cannot check out.';
    if (form.paypal_enabled) {
        const m = form.paypal_mode;
        if (!String(form[`${m}_client_id`] || '').trim()) errors[`${m}_client_id`] = `Enter the ${m} client ID to turn PayPal on.`;
        if (!String(form[`${m}_secret`] || '').trim()) errors[`${m}_secret`] = `Enter the ${m} secret to turn PayPal on.`;
    }
    return errors;
}

/**
 * Admin > Payment methods (/admin/payment): cash on delivery and PayPal
 * (mode and keys). Everything is saved together; checkout reads it.
 */
export default function PaymentMethodsPage() {
    const toast = useToast();
    const [saved, setSaved] = useState(null);
    const [form, setForm] = useState(null);
    const [error, setError] = useState('');
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    const load = useCallback(() => paymentsService.settings()
        .then(s => { setSaved(s); setForm(s); setError(''); })
        .catch(err => setError(err.message)), []);
    useEffect(() => { load(); }, [load]);

    const dirty = Boolean(form && saved) && !same(form, saved);
    useEffect(() => {
        if (!dirty) return undefined;
        const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    const set = (key, value) => {
        setForm(f => ({ ...f, [key]: value }));
        setErrors(e => ({ ...e, [key]: undefined, form: undefined }));
    };

    const save = async () => {
        const found = validate(form);
        setErrors(found);
        if (Object.keys(found).length) {
            toast(found.form || 'Some PayPal keys are missing', 'error');
            return;
        }
        setSaving(true);
        try {
            const next = await paymentsService.save(form);
            setSaved(next);
            setForm(next);
            toast('Payment methods saved', 'success');
        } catch (err) {
            toast(`Could not save: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const testKeys = async () => {
        const mode = form.paypal_mode;
        const client_id = String(form[`${mode}_client_id`] || '').trim();
        const secret = String(form[`${mode}_secret`] || '').trim();
        if (!client_id || !secret) {
            setErrors(e => ({
                ...e,
                [`${mode}_client_id`]: client_id ? undefined : `Enter the ${mode} client ID to test it.`,
                [`${mode}_secret`]: secret ? undefined : `Enter the ${mode} secret to test it.`,
            }));
            return;
        }
        setTesting(true);
        try {
            const res = await paymentsService.testPaypal({ mode, client_id, secret });
            toast(res?.message || `PayPal ${mode} keys work`, 'success');
        } catch (err) {
            toast(`PayPal did not accept the ${mode} keys: ${err.message}`, 'error');
        } finally {
            setTesting(false);
        }
    };

    const header = (
        <PageHeader
            icon={CreditCard}
            title="Payment methods"
            subtitle="How customers can pay at checkout."
            actions={dirty ? <Button variant="primary" icon={Save} onClick={save} loading={saving}>Save</Button> : null}
        />
    );

    if (error && !form) {
        return (
            <Page>
                {header}
                <Banner tone="error" action={<Button size="sm" icon={RotateCcw} onClick={load}>Try again</Button>}>Could not load the payment settings: {error}</Banner>
            </Page>
        );
    }
    if (!form) {
        return (
            <Page busy>
                {header}
                <Stack>
                    <Card><Skeleton width="40%" size="lg" /><Skeleton width="60%" /></Card>
                    <Card><Skeleton width="40%" size="lg" /><Skeleton size="block" /></Card>
                </Stack>
            </Page>
        );
    }

    const live = saved && checkoutSummary(saved);
    return (
        <Page>
            {header}
            <Stack>
                {saved && (
                    <Banner tone={saved.paypal_enabled && saved.paypal_mode === 'sandbox' ? 'warn' : 'info'}>
                        <strong>Now:</strong> {live}
                    </Banner>
                )}
                {errors.form && <Banner tone="error">{errors.form}</Banner>}
                <PaymentMethodCard
                    icon={Truck}
                    title="Cash on delivery"
                    description="The customer pays when the parts arrive."
                    enabled={Boolean(form.cod_enabled)}
                    onToggle={v => set('cod_enabled', v)}
                    disabled={saving}
                />
                <PaymentMethodCard
                    icon={PaypalLogo}
                    title="PayPal"
                    description="The customer pays online with PayPal or a card through PayPal."
                    enabled={Boolean(form.paypal_enabled)}
                    onToggle={v => set('paypal_enabled', v)}
                    disabled={saving}
                >
                    <PaypalSettings form={form} set={set} errors={errors} onTest={testKeys} testing={testing} />
                </PaymentMethodCard>
            </Stack>
            {dirty && (
                <FormActions sticky>
                    <span className="pm-unsaved">Unsaved changes</span>
                    <Button icon={Undo2} onClick={() => { setForm(saved); setErrors({}); }} disabled={saving}>Discard</Button>
                    <Button variant="primary" icon={Save} onClick={save} loading={saving}>Save</Button>
                </FormActions>
            )}
        </Page>
    );
}
