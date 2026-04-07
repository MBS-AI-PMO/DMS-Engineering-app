import { useState, useEffect } from 'react';
import { motion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import {
    CreditCard, Truck, Save, CheckCircle, AlertTriangle, Eye, EyeOff, FlaskConical
} from 'lucide-react';
import { fetchSettings, updateSetting, testPaypalKeys } from '../../utils/api';
import { PaymentMethodSkeleton } from '../../components/admin/AdminSkeletons';
import { useToast } from '../../context/ToastContext';

const PAYPAL_LOGO = (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c1.543 3.186-.618 6.316-5.032 6.316H13.75l-1.179 7.47h3.066c.459 0 .848-.334.92-.788l.038-.196.73-4.625.047-.254a.932.932 0 0 1 .92-.788h.579c3.75 0 6.686-1.524 7.542-5.932.357-1.832.172-3.362-.791-4.662z" fill="#009cde"/>
        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z" fill="#012169"/>
    </svg>
);

function Toggle({ checked, onChange, disabled }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`payment-toggle${checked ? ' payment-toggle--on' : ''}`}
        >
            <span className="payment-toggle-thumb" />
        </button>
    );
}

function SecretInput({ value, onChange, placeholder }) {
    const [show, setShow] = useState(false);
    return (
        <div className="payment-secret-input">
            <input
                type={show ? 'text' : 'password'}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                autoComplete="off"
            />
            <button type="button" className="payment-secret-eye" onClick={() => setShow(s => !s)}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
        </div>
    );
}

export default function PaymentMethods() {
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    const [form, setForm] = useState({
        cod_enabled: true,
        paypal_enabled: false,
        paypal_mode: 'sandbox',
        sandbox_client_id: '',
        sandbox_secret: '',
        live_client_id: '',
        live_secret: '',
    });

    useEffect(() => {
        fetchSettings()
            .then(settings => {
                setForm({
                    cod_enabled: settings.payment_cod_enabled ?? true,
                    paypal_enabled: settings.payment_paypal_enabled ?? false,
                    paypal_mode: settings.payment_paypal_mode ?? 'sandbox',
                    sandbox_client_id: settings.payment_paypal_sandbox_client_id ?? '',
                    sandbox_secret: settings.payment_paypal_sandbox_secret ?? '',
                    live_client_id: settings.payment_paypal_live_client_id ?? '',
                    live_secret: settings.payment_paypal_live_secret ?? '',
                });
            })
            .catch(err => toast({ title: 'Load Failed', message: err.message }, 'error'))
            .finally(() => setLoading(false));
    }, [toast]);

    const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

    const handleSave = async () => {
        if (form.paypal_enabled) {
            const hasKeys = form.paypal_mode === 'sandbox'
                ? (form.sandbox_client_id && form.sandbox_secret)
                : (form.live_client_id && form.live_secret);
            if (!hasKeys) {
                toast({ title: 'Missing Keys', message: `Enter ${form.paypal_mode} Client ID and Secret before enabling PayPal` }, 'error');
                return;
            }
        }
        if (!form.cod_enabled && !form.paypal_enabled) {
            toast({ title: 'No Payment Method', message: 'At least one payment method must be enabled' }, 'warning');
            return;
        }

        setSaving(true);
        try {
            await Promise.all([
                updateSetting('payment_cod_enabled', form.cod_enabled),
                updateSetting('payment_paypal_enabled', form.paypal_enabled),
                updateSetting('payment_paypal_mode', form.paypal_mode),
                updateSetting('payment_paypal_sandbox_client_id', form.sandbox_client_id),
                updateSetting('payment_paypal_sandbox_secret', form.sandbox_secret),
                updateSetting('payment_paypal_live_client_id', form.live_client_id),
                updateSetting('payment_paypal_live_secret', form.live_secret),
            ]);
            toast({ title: 'Saved', message: 'Payment settings updated successfully' }, 'success');
        } catch (err) {
            toast({ title: 'Save Failed', message: err.message }, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleTestKeys = async () => {
        const client_id = form.paypal_mode === 'sandbox' ? form.sandbox_client_id : form.live_client_id;
        const secret = form.paypal_mode === 'sandbox' ? form.sandbox_secret : form.live_secret;

        if (!client_id || !secret) {
            toast({ title: 'Missing Keys', message: `Enter ${form.paypal_mode} Client ID and Secret to test` }, 'error');
            return;
        }

        setTesting(true);
        try {
            const result = await testPaypalKeys({ mode: form.paypal_mode, client_id, secret });
            toast({ title: 'Keys Valid', message: result.message || `PayPal ${form.paypal_mode} credentials are valid` }, 'success');
        } catch (err) {
            toast({ title: 'Invalid Keys', message: err.message || 'PayPal credentials are invalid' }, 'error');
        } finally {
            setTesting(false);
        }
    };

    if (loading) {
        return (
            <div className="admin-page">
                <div className="admin-page-header">
                    <h1 className="admin-page-title">Payment Methods</h1>
                    <div className="skeleton skeleton-rectangle" style={{ width: 120, height: 40, borderRadius: 8 }} />
                </div>
                <PaymentMethodSkeleton />
            </div>
        );
    }

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <h1 className="admin-page-title">Payment Methods</h1>
                <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>
                    <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <div className="payment-methods-grid">
                {/* ── COD Card ───────────────────────────────── */}
                <motion.div
                    className={`payment-method-card${form.cod_enabled ? ' payment-method-card--active' : ''}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0 }}
                >
                    <div className="payment-method-header">
                        <div className="payment-method-icon payment-method-icon--cod">
                            <Truck size={26} />
                        </div>
                        <div className="payment-method-info">
                            <h3>Cash on Delivery</h3>
                            <p>Customer pays when parts arrive</p>
                        </div>
                        <div className="payment-method-toggle-wrap">
                            <Toggle checked={form.cod_enabled} onChange={v => set('cod_enabled', v)} />
                            <span className={`payment-status-pill ${form.cod_enabled ? 'active' : 'inactive'}`}>
                                {form.cod_enabled ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                    </div>
                </motion.div>

                {/* ── PayPal Card ────────────────────────────── */}
                <motion.div
                    className={`payment-method-card${form.paypal_enabled ? ' payment-method-card--active' : ''}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 }}
                >
                    <div className="payment-method-header">
                        <div className="payment-method-icon payment-method-icon--paypal">
                            {PAYPAL_LOGO}
                        </div>
                        <div className="payment-method-info">
                            <h3>PayPal</h3>
                            <p>Accept online payments via PayPal</p>
                        </div>
                        <div className="payment-method-toggle-wrap">
                            <Toggle checked={form.paypal_enabled} onChange={v => set('paypal_enabled', v)} />
                            <span className={`payment-status-pill ${form.paypal_enabled ? 'active' : 'inactive'}`}>
                                {form.paypal_enabled ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                    </div>

                    <div className="payment-paypal-body">
                        {/* Mode Switcher */}
                        <div className="payment-mode-switcher">
                            <button
                                type="button"
                                className={`payment-mode-btn${form.paypal_mode === 'sandbox' ? ' active' : ''}`}
                                onClick={() => set('paypal_mode', 'sandbox')}
                            >
                                <FlaskConical size={14} /> Sandbox
                            </button>
                            <button
                                type="button"
                                className={`payment-mode-btn${form.paypal_mode === 'live' ? ' active' : ''}`}
                                onClick={() => set('paypal_mode', 'live')}
                            >
                                <CheckCircle size={14} /> Live
                            </button>
                        </div>

                        {form.paypal_mode === 'live' && (
                            <div className="payment-live-warning">
                                <AlertTriangle size={14} />
                                Live mode — real transactions will be processed
                            </div>
                        )}

                        {/* Sandbox Keys */}
                        <div className={`payment-keys-section${form.paypal_mode !== 'sandbox' ? ' payment-keys-section--dim' : ''}`}>
                            <div className="payment-keys-label">
                                <FlaskConical size={13} /> Sandbox Keys
                            </div>
                            <div className="admin-form-grid" style={{ gap: 12 }}>
                                <div className="admin-form-group">
                                    <label>Client ID</label>
                                    <input
                                        type="text"
                                        value={form.sandbox_client_id}
                                        onChange={e => set('sandbox_client_id', e.target.value)}
                                        placeholder="AaBbCcDd..."
                                        autoComplete="off"
                                    />
                                </div>
                                <div className="admin-form-group">
                                    <label>Secret</label>
                                    <SecretInput
                                        value={form.sandbox_secret}
                                        onChange={v => set('sandbox_secret', v)}
                                        placeholder="EeFfGgHh..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Live Keys */}
                        <div className={`payment-keys-section${form.paypal_mode !== 'live' ? ' payment-keys-section--dim' : ''}`}>
                            <div className="payment-keys-label">
                                <CheckCircle size={13} /> Live Keys
                            </div>
                            <div className="admin-form-grid" style={{ gap: 12 }}>
                                <div className="admin-form-group">
                                    <label>Client ID</label>
                                    <input
                                        type="text"
                                        value={form.live_client_id}
                                        onChange={e => set('live_client_id', e.target.value)}
                                        placeholder="AaBbCcDd..."
                                        autoComplete="off"
                                    />
                                </div>
                                <div className="admin-form-group">
                                    <label>Secret</label>
                                    <SecretInput
                                        value={form.live_secret}
                                        onChange={v => set('live_secret', v)}
                                        placeholder="EeFfGgHh..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="payment-paypal-actions">
                            <button
                                type="button"
                                className="admin-btn-secondary"
                                onClick={handleTestKeys}
                                disabled={testing}
                            >
                                <FlaskConical size={15} />
                                {testing ? 'Testing...' : `Test ${form.paypal_mode === 'sandbox' ? 'Sandbox' : 'Live'} Keys`}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
