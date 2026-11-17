import { CheckCircle2, FlaskConical, KeyRound } from 'lucide-react';
import { Banner, Button, Field, FieldRow, Input, Pill, Segmented } from '../../../components/admin/ui';
import SecretInput from './SecretInput';

const MODES = [
    { value: 'sandbox', label: 'Sandbox (testing)', icon: FlaskConical },
    { value: 'live', label: 'Live', icon: CheckCircle2 },
];

const cx = (...parts) => parts.filter(Boolean).join(' ');

/** One mode's keys; the mode not in use is dimmed. */
function KeyPair({ mode, form, set, inUse, errors }) {
    const idKey = `${mode}_client_id`;
    const secretKey = `${mode}_secret`;
    return (
        <fieldset className={cx('pm-keys', !inUse && 'is-idle')}>
            <legend className="pm-keys-title">
                <KeyRound size={14} aria-hidden="true" /> {mode === 'sandbox' ? 'Sandbox keys' : 'Live keys'}
                {inUse ? <Pill tone="blue">In use</Pill> : <Pill tone="gray">Not in use</Pill>}
            </legend>
            <FieldRow>
                <Field label="Client ID" error={errors[idKey]}>
                    <Input value={form[idKey]} invalid={Boolean(errors[idKey])} onChange={e => set(idKey, e.target.value)} placeholder="AaBbCcDd…" autoComplete="off" spellCheck={false} />
                </Field>
                <Field label="Secret" error={errors[secretKey]}>
                    <SecretInput value={form[secretKey]} invalid={Boolean(errors[secretKey])} onChange={e => set(secretKey, e.target.value)} placeholder="EeFfGgHh…" />
                </Field>
            </FieldRow>
        </fieldset>
    );
}

/**
 * PayPal's mode (sandbox for testing, live for real money), the keys for
 * each, and a check that asks PayPal whether the keys in use work.
 */
export default function PaypalSettings({ form, set, errors, onTest, testing }) {
    const mode = form.paypal_mode;
    return (
        <>
            <Field as="div" label="Mode">
                <Segmented items={MODES} value={mode} onChange={v => set('paypal_mode', v)} label="PayPal mode" />
            </Field>
            {mode === 'live'
                ? <Banner tone="warn">Live mode: customers are charged real money.</Banner>
                : <Banner>Sandbox mode: payments use PayPal test accounts and no real money moves. Switch to Live when you are ready to take payments.</Banner>}
            <KeyPair mode="sandbox" form={form} set={set} inUse={mode === 'sandbox'} errors={errors} />
            <KeyPair mode="live" form={form} set={set} inUse={mode === 'live'} errors={errors} />
            <div className="pm-test">
                <Button icon={FlaskConical} loading={testing} onClick={onTest}>Test {mode === 'live' ? 'live' : 'sandbox'} keys</Button>
                <p className="ak-hint">Asks PayPal whether these keys work. Nothing is charged, and nothing is saved.</p>
            </div>
        </>
    );
}
