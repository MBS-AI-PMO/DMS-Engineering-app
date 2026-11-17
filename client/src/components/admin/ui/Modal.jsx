import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';

/**
 * A dialog over the page. Escape or a click on the backdrop calls onClose;
 * focus starts on the close button and returns afterwards; the page behind
 * does not scroll. size: sm | md | lg | xl. footer: the buttons row.
 */
export function Modal({ title, subtitle, size = 'md', onClose, footer, children, className, closeOnBackdrop = true }) {
    const closeRef = useRef(null);
    const titleId = useId();

    useEffect(() => {
        const previous = document.activeElement;
        closeRef.current?.focus();
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = overflow;
            previous?.focus?.();
        };
    }, [onClose]);

    return createPortal(
        <div className="ak-modal-backdrop" onMouseDown={e => { if (closeOnBackdrop && e.target === e.currentTarget) onClose(); }}>
            <div className={`ak-modal is-${size}${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
                <div className="ak-modal-head">
                    <div>
                        <h2 id={titleId} className="ak-modal-title">{title}</h2>
                        {subtitle && <p className="ak-modal-sub">{subtitle}</p>}
                    </div>
                    <button ref={closeRef} type="button" className="ak-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
                </div>
                <div className="ak-modal-body">{children}</div>
                {footer && <div className="ak-modal-foot">{footer}</div>}
            </div>
        </div>,
        document.body,
    );
}

/**
 * "Are you sure?" Use through useConfirm() rather than directly:
 *   const [confirm, confirmDialog] = useConfirm();
 *   if (!(await confirm({ title: 'Delete this metal?', danger: true }))) return;
 *   … render {confirmDialog} somewhere in the page.
 */
export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, busy = false, onConfirm, onCancel }) {
    return (
        <Modal
            title={title}
            size="sm"
            onClose={onCancel}
            footer={(
                <>
                    <Button onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
                    <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={busy} icon={danger ? AlertTriangle : undefined}>{confirmLabel}</Button>
                </>
            )}
        >
            {message && <p className="ak-confirm-text">{message}</p>}
        </Modal>
    );
}
