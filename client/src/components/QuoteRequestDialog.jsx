import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { AlertCircle, ArrowRight, Check, FileBox, Loader2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { quoteRequestsService } from '../services/quotes';
import { plainReasons, summaryFacts } from '../utils/quoteRequest';
import '../styles/QuoteRequestDialog.css';

/**
 * "Request a quote" for a part the site could not price instantly (quote
 * page and cart). Shows the part and why it needs a quote, asks who to send
 * the price to (filled in for signed-in customers and from the last request
 * on this browser), and sends the request with the uploaded file. Ends on
 * the reference number and what happens next.
 *
 * part: null (closed) or { source: 'quote-page' | 'cart', fileName, fileRef,
 *       quantity, reasons: [{ code, message }], configuration (see
 *       utils/quoteRequest configurationSummary), pricingInput }
 */

const CONTACT_KEY = 'dms_quote_contact';
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const MAX_QTY = 1000000;

const readSavedContact = () => {
    try { return JSON.parse(localStorage.getItem(CONTACT_KEY) || '{}') || {}; } catch { return {}; }
};
const saveContact = (contact) => {
    try { localStorage.setItem(CONTACT_KEY, JSON.stringify(contact)); } catch { /* storage unavailable */ }
};

function validateForm(form) {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Add your name.';
    if (!form.email.trim()) errors.email = 'Add your email so we can send the price.';
    else if (!EMAIL_RE.test(form.email.trim())) errors.email = 'Check the email address.';
    const qty = Number.parseInt(form.quantity, 10);
    if (!Number.isFinite(qty) || qty < 1) errors.quantity = 'Enter how many parts you need (1 or more).';
    else if (qty > MAX_QTY) errors.quantity = `For more than ${MAX_QTY.toLocaleString()} parts, contact us.`;
    return errors;
}

function Field({ id, label, optional, error, children }) {
    return (
        <div className={`qr-field${error ? ' has-error' : ''}`}>
            <label className="qr-label" htmlFor={id}>
                {label}{optional && <span className="qr-optional">optional</span>}
            </label>
            {children}
            {error && <p className="qr-field-error" id={`${id}-error`}>{error}</p>}
        </div>
    );
}

function Success({ result, email, signedIn }) {
    return (
        <div className="qr-done">
            <span className="qr-done-icon" aria-hidden="true"><Check size={26} strokeWidth={2.5} /></span>
            <h3 className="qr-done-title">Request sent</h3>
            <p className="qr-done-ref">
                Your reference is <strong>{result.reference}</strong>. We'll send the price to <strong>{email}</strong>.
            </p>
            <h4 className="qr-subtitle">What happens next</h4>
            <ol className="qr-steps">
                <li><strong>We review your part.</strong> We check the file, the material and the options you chose.</li>
                <li><strong>You get a price by email.</strong> Price per part, total and lead time.</li>
                <li><strong>Reply to accept.</strong> We start production once you confirm.</li>
            </ol>
            {signedIn && (
                <p className="qr-note">You can also follow this request under <Link to="/orders">My orders</Link>.</p>
            )}
        </div>
    );
}

function DialogBody({ part, onClose }) {
    const { user } = useAuth() || {};
    const reduceMotion = useReducedMotion();
    const titleId = useId();
    const formId = useId();
    const dialogRef = useRef(null);
    const openerRef = useRef(null);
    const [form, setForm] = useState(() => {
        const saved = readSavedContact();
        return {
            name: user?.name || saved.name || '',
            email: user?.email || saved.email || '',
            phone: saved.phone || '',
            company: saved.company || '',
            quantity: String(Math.max(1, Number.parseInt(part.quantity, 10) || 1)),
            message: '',
            website: '',
        };
    });
    const [errors, setErrors] = useState({});
    const [serverError, setServerError] = useState('');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    // Latest values for the key handler, so opening sets things up once.
    const busyRef = useRef(false);
    const closeRef = useRef(onClose);
    useEffect(() => {
        busyRef.current = busy;
        closeRef.current = onClose;
    });

    // The account may load after the dialog opens: fill what is still empty.
    useEffect(() => {
        if (!user) return;
        setForm(f => ({ ...f, name: f.name || user.name || '', email: f.email || user.email || '' }));
    }, [user]);

    // Focus, Escape, Tab kept inside, page behind not scrolling, focus back after.
    useEffect(() => {
        openerRef.current = document.activeElement;
        const first = dialogRef.current?.querySelector('input:not([type=hidden]):not([tabindex="-1"])');
        const empty = [...(dialogRef.current?.querySelectorAll('.qr-form input:not([tabindex="-1"])') || [])].find(el => !el.value);
        (empty || first)?.focus();
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e) => {
            if (e.key === 'Escape' && !busyRef.current) { e.preventDefault(); closeRef.current(); }
            if (e.key === 'Tab' && dialogRef.current) {
                const items = [...dialogRef.current.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled])')];
                if (!items.length) return;
                const firstItem = items[0];
                const lastItem = items[items.length - 1];
                if (e.shiftKey && document.activeElement === firstItem) { e.preventDefault(); lastItem.focus(); }
                else if (!e.shiftKey && document.activeElement === lastItem) { e.preventDefault(); firstItem.focus(); }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = previous;
            if (openerRef.current && typeof openerRef.current.focus === 'function') openerRef.current.focus();
        };
    }, []);

    const set = (key) => (e) => {
        const value = key === 'quantity' ? e.target.value.replace(/\D/g, '').slice(0, 7) : e.target.value;
        setForm(f => ({ ...f, [key]: value }));
        if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
    };

    const submit = async (e) => {
        e.preventDefault();
        if (busy) return;
        const found = validateForm(form);
        setErrors(found);
        setServerError('');
        if (Object.keys(found).length) {
            dialogRef.current?.querySelector(`#${CSS.escape(`${formId}-${Object.keys(found)[0]}`)}`)?.focus();
            return;
        }
        const quantity = Number.parseInt(form.quantity, 10);
        setBusy(true);
        try {
            const sent = await quoteRequestsService.send({
                name: form.name.trim(),
                email: form.email.trim(),
                phone: form.phone.trim(),
                company: form.company.trim(),
                message: form.message.trim(),
                website: form.website,
                quantity,
                file_ref: part.fileRef,
                file_name: part.fileName,
                source: part.source,
                configuration: part.configuration || {},
                pricing_input: part.pricingInput ? { ...part.pricingInput, quantity } : null,
                reasons: part.reasons || [],
            });
            saveContact({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), company: form.company.trim() });
            setResult(sent);
        } catch (err) {
            setServerError(err.message || 'Could not send the request. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    const facts = summaryFacts(part.configuration);
    const reasons = plainReasons(part.reasons);
    const fieldProps = (key) => ({
        id: `${formId}-${key}`,
        value: form[key],
        onChange: set(key),
        'aria-invalid': errors[key] ? true : undefined,
        'aria-describedby': errors[key] ? `${formId}-${key}-error` : undefined,
        disabled: busy,
    });

    return (
        <motion.div
            className="qr-overlay"
            onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
        >
            <motion.div
                ref={dialogRef}
                className="qr-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
                <div className="qr-head">
                    <div className="qr-head-text">
                        <p className="qr-eyebrow">{result ? 'Quote request' : 'Request a quote'}</p>
                        <h2 id={titleId} className="qr-title">{result ? `Thanks${form.name.trim() ? `, ${form.name.trim().split(/\s+/)[0]}` : ''}` : 'Get a price for this part'}</h2>
                    </div>
                    <button type="button" className="qr-close" onClick={onClose} disabled={busy} aria-label="Close">
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                <div className="qr-body">
                    {result ? (
                        <Success result={result} email={form.email.trim()} signedIn={Boolean(user)} />
                    ) : (
                        <>
                            <section className="qr-part" aria-label="The part">
                                <div className="qr-part-head">
                                    <span className="qr-part-icon" aria-hidden="true"><FileBox size={18} /></span>
                                    <span className="qr-part-name" title={part.fileName}>{part.fileName}</span>
                                </div>
                                {facts.length > 0 && (
                                    <dl className="qr-facts">
                                        {facts.map(([label, value]) => (
                                            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                                        ))}
                                    </dl>
                                )}
                                {reasons.length > 0 && (
                                    <div className="qr-why">
                                        <p className="qr-why-title"><AlertCircle size={15} aria-hidden="true" /> Why there's no instant price</p>
                                        <ul>
                                            {reasons.map(text => <li key={text}>{text}</li>)}
                                        </ul>
                                        <p className="qr-why-next">Our team will look at it and email you a price and lead time.</p>
                                    </div>
                                )}
                            </section>

                            <form id={formId} className="qr-form" onSubmit={submit} noValidate>
                                <div className="qr-row">
                                    <Field id={`${formId}-name`} label="Your name" error={errors.name}>
                                        <input type="text" autoComplete="name" maxLength={120} {...fieldProps('name')} />
                                    </Field>
                                    <Field id={`${formId}-email`} label="Email" error={errors.email}>
                                        <input type="email" autoComplete="email" inputMode="email" maxLength={254} {...fieldProps('email')} />
                                    </Field>
                                </div>
                                <div className="qr-row">
                                    <Field id={`${formId}-phone`} label="Phone" optional>
                                        <input type="tel" autoComplete="tel" maxLength={50} {...fieldProps('phone')} />
                                    </Field>
                                    <Field id={`${formId}-company`} label="Company" optional>
                                        <input type="text" autoComplete="organization" maxLength={160} {...fieldProps('company')} />
                                    </Field>
                                </div>
                                <Field id={`${formId}-quantity`} label="Quantity" error={errors.quantity}>
                                    <input type="text" inputMode="numeric" pattern="[0-9]*" className="qr-qty" {...fieldProps('quantity')} />
                                </Field>
                                <Field id={`${formId}-message`} label="Notes" optional>
                                    <textarea
                                        rows={3}
                                        maxLength={5000}
                                        placeholder="Deadline, tolerances, material you could use instead, anything we should know"
                                        {...fieldProps('message')}
                                    />
                                </Field>
                                {/* Left empty by people; bots fill it. */}
                                <input
                                    type="text"
                                    name="website"
                                    className="qr-hp"
                                    tabIndex={-1}
                                    autoComplete="off"
                                    aria-hidden="true"
                                    value={form.website}
                                    onChange={set('website')}
                                />
                                {serverError && <p className="qr-error" role="alert">{serverError}</p>}
                            </form>
                        </>
                    )}
                </div>

                <div className="qr-foot">
                    {result ? (
                        <>
                            {user && <Link to="/orders" className="qr-btn" onClick={onClose}>View my requests</Link>}
                            <button type="button" className="qr-btn is-primary" onClick={onClose}>Done</button>
                        </>
                    ) : (
                        <>
                            <p className="qr-foot-note">We'll attach your file to the request.</p>
                            <button type="button" className="qr-btn" onClick={onClose} disabled={busy}>Cancel</button>
                            <button type="submit" form={formId} className="qr-btn is-accent" disabled={busy} aria-busy={busy || undefined}>
                                {busy ? <Loader2 size={16} className="qr-spin" aria-hidden="true" /> : null}
                                {busy ? 'Sending…' : 'Send request'}
                                {!busy && <ArrowRight size={16} aria-hidden="true" />}
                            </button>
                        </>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}

const QuoteRequestDialog = ({ part, onClose }) => createPortal(
    <AnimatePresence>
        {part && <DialogBody key={`${part.fileRef || part.fileName}-${part.openedAt || ''}`} part={part} onClose={onClose} />}
    </AnimatePresence>,
    document.body,
);

export default QuoteRequestDialog;
