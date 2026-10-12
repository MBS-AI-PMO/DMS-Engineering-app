import React, { useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { Loader2 } from 'lucide-react';
import '../styles/ConfirmDialog.css';

/**
 * The site's own "are you sure?" box, in place of the browser's
 * window.confirm. Focus starts on Cancel (the safe choice), Tab stays
 * inside, Escape or a click outside cancels, the page behind does not
 * scroll, and focus goes back to what opened it. While `busy`, both
 * buttons wait and the main one shows a spinner.
 */
const ConfirmDialog = ({
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    busy = false,
    error = '',
    onConfirm,
    onCancel,
}) => {
    const reduceMotion = useReducedMotion();
    const titleId = useId();
    const textId = useId();
    const cancelRef = useRef(null);
    const dialogRef = useRef(null);
    const openerRef = useRef(null);
    // Latest values for the key handler, so opening sets things up once.
    const busyRef = useRef(busy);
    const cancelFnRef = useRef(onCancel);
    useEffect(() => {
        busyRef.current = busy;
        cancelFnRef.current = onCancel;
    });

    useEffect(() => {
        if (!open) return undefined;
        openerRef.current = document.activeElement;
        cancelRef.current?.focus();
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const onKey = (e) => {
            if (e.key === 'Escape' && !busyRef.current) {
                e.preventDefault();
                cancelFnRef.current();
            }
            if (e.key === 'Tab' && dialogRef.current) {
                const items = [...dialogRef.current.querySelectorAll('button:not([disabled])')];
                if (items.length === 0) return;
                const first = items[0];
                const last = items[items.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = previous;
            if (openerRef.current && typeof openerRef.current.focus === 'function') openerRef.current.focus();
        };
    }, [open]);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="cf-overlay"
                    onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                >
                    <motion.div
                        ref={dialogRef}
                        className="cf-dialog"
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        aria-describedby={message ? textId : undefined}
                        initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <h2 id={titleId} className="cf-title">{title}</h2>
                        {message && <p id={textId} className="cf-text">{message}</p>}
                        {error && <p className="cf-error" role="alert">{error}</p>}
                        <div className="cf-actions">
                            <button ref={cancelRef} type="button" className="cf-btn" onClick={onCancel} disabled={busy}>
                                {cancelLabel}
                            </button>
                            <button
                                type="button"
                                className={`cf-btn ${danger ? 'is-danger' : 'is-primary'}`}
                                onClick={onConfirm}
                                disabled={busy}
                            >
                                {busy && <Loader2 size={15} className="cf-spin" aria-hidden="true" />}
                                {confirmLabel}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ConfirmDialog;
