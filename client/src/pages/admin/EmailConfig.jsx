import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Send, Trash2, Mail, CheckCircle, AlertTriangle } from 'lucide-react';
import { fetchEmailConfig, saveEmailConfig, testEmailConfig, deleteEmailConfig, sendTestEmail } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

const emptyForm = {
    smtp_host: '',
    smtp_port: 587,
    email: '',
    password: '',
    encryption_type: 'TLS',
    sender_name: 'DMS Engineering',
};

export default function EmailConfig() {
    const [form, setForm] = useState(emptyForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [sendingTest, setSendingTest] = useState(false);
    const [configured, setConfigured] = useState(false);
    const [errorBanner, setErrorBanner] = useState(null);
    const toast = useToast();

    useEffect(() => {
        fetchEmailConfig()
            .then(data => {
                if (data) {
                    setForm({
                        smtp_host: data.smtp_host || '',
                        smtp_port: data.smtp_port || 587,
                        email: data.email || '',
                        password: '',
                        encryption_type: data.encryption_type || 'TLS',
                        sender_name: data.sender_name || 'DMS Engineering',
                    });
                    setConfigured(true);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        if (!form.smtp_host || !form.email) {
            toast('SMTP host and email are required', 'error');
            return;
        }
        if (!configured && !form.password) {
            toast('Password is required for initial setup', 'error');
            return;
        }
        setSaving(true);
        try {
            await saveEmailConfig(form);
            setConfigured(true);
            toast('Email configuration saved', 'success');
        } catch (err) {
            toast('Save failed: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        setErrorBanner(null);
        try {
            const result = await testEmailConfig();
            toast(result.message || 'Connection successful!', 'success');
        } catch (err) {
            setErrorBanner(err.message);
            toast('Test failed: ' + err.message, 'error');
        } finally {
            setTesting(false);
        }
    };

    const handleSendTest = async () => {
        setSendingTest(true);
        setErrorBanner(null);
        try {
            const result = await sendTestEmail();
            toast(result.message || 'Test email sent!', 'success');
        } catch (err) {
            setErrorBanner(err.message);
            toast('Send failed: ' + err.message, 'error');
        } finally {
            setSendingTest(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Remove email configuration? Newsletter emails will stop working.')) return;
        try {
            await deleteEmailConfig();
            setForm(emptyForm);
            setConfigured(false);
            toast('Email configuration removed', 'success');
        } catch (err) {
            toast('Delete failed: ' + err.message, 'error');
        }
    };

    if (loading) {
        return <div className="admin-page"><div className="skeleton skeleton-card" style={{ height: 300 }} /></div>;
    }

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <h1 className="admin-page-title">Email Configuration</h1>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {configured && (
                        <span className="email-status-badge configured">
                            <CheckCircle size={14} /> Configured
                        </span>
                    )}
                    {!configured && (
                        <span className="email-status-badge not-configured">
                            <AlertTriangle size={14} /> Not Configured
                        </span>
                    )}
                </div>
            </div>

            <motion.div
                className="email-config-card"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="email-config-icon">
                    <Mail size={32} />
                </div>
                <p className="admin-field-hint" style={{ marginBottom: 16 }}>
                    Configure SMTP credentials used for sending newsletter and notification emails.
                </p>

                <div className="admin-form-grid">
                    <div className="admin-form-group">
                        <label>SMTP Host</label>
                        <input
                            type="text"
                            value={form.smtp_host}
                            onChange={e => setForm(f => ({ ...f, smtp_host: e.target.value }))}
                            placeholder="smtp.gmail.com"
                        />
                    </div>
                    <div className="admin-form-group">
                        <label>SMTP Port</label>
                        <input
                            type="number"
                            value={form.smtp_port}
                            onChange={e => setForm(f => ({ ...f, smtp_port: parseInt(e.target.value) || 587 }))}
                            placeholder="587"
                        />
                    </div>
                    <div className="admin-form-group">
                        <label>Email Address (Sender)</label>
                        <input
                            type="email"
                            value={form.email}
                            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                            placeholder="noreply@example.com"
                        />
                    </div>
                    <div className="admin-form-group">
                        <label>{configured ? 'Password (leave blank to keep)' : 'Password / App Password'}</label>
                        <input
                            type="password"
                            value={form.password}
                            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                            placeholder={configured ? '••••••••' : 'App password'}
                        />
                    </div>
                    <div className="admin-form-group">
                        <label>Encryption Type</label>
                        <select
                            value={form.encryption_type}
                            onChange={e => setForm(f => ({ ...f, encryption_type: e.target.value }))}
                        >
                            <option value="TLS">TLS</option>
                            <option value="SSL">SSL</option>
                            <option value="NONE">None</option>
                        </select>
                    </div>
                    <div className="admin-form-group">
                        <label>Sender Display Name</label>
                        <input
                            type="text"
                            value={form.sender_name}
                            onChange={e => setForm(f => ({ ...f, sender_name: e.target.value }))}
                            placeholder="DMS Engineering"
                        />
                    </div>
                </div>

                {errorBanner && (
                    <div className="email-error-banner" style={{
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: 8,
                        padding: '12px 16px',
                        marginBottom: 16,
                        color: '#991b1b',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                    }}>
                        <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                        <div>
                            <strong style={{ display: 'block', marginBottom: 2 }}>Email Error</strong>
                            {errorBanner}
                        </div>
                    </div>
                )}

                <div className="email-config-actions">
                    <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>
                        <Save size={16} /> {saving ? 'Saving...' : 'Save Configuration'}
                    </button>
                    {configured && (
                        <>
                            <button className="admin-btn-secondary" onClick={handleTest} disabled={testing}>
                                <Send size={16} /> {testing ? 'Testing...' : 'Test Connection'}
                            </button>
                            <button className="admin-btn-secondary" onClick={handleSendTest} disabled={sendingTest}>
                                <Mail size={16} /> {sendingTest ? 'Sending...' : 'Send Test Email'}
                            </button>
                            <button className="admin-btn-danger" onClick={handleDelete}>
                                <Trash2 size={16} /> Remove
                            </button>
                        </>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
