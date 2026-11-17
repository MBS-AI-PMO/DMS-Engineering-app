import { useId, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { Checkbox, Pill, Popover } from '../../../components/admin/ui';
import { ANNOUNCED, STATUSES, statusMeta, statusTone } from './orderFormat';

export function StatusPill({ status }) {
    return <Pill tone={statusTone(status)} dot>{statusMeta(status).label}</Pill>;
}

/* The status pill as a button: pick a new status, with or without an
 * email to the customer. onChange(status, notify) returns a promise. */
export default function StatusMenu({ status, onChange, disabled = false }) {
    const [open, setOpen] = useState(false);
    const [notify, setNotify] = useState(true);
    const [busy, setBusy] = useState(false);
    const buttonRef = useRef(null);
    const menuId = useId();
    const meta = statusMeta(status);

    const pick = async (key) => {
        if (key === status) { setOpen(false); return; }
        setBusy(true);
        setOpen(false);
        try { await onChange(key, notify && ANNOUNCED.has(key)); } finally { setBusy(false); }
    };

    return (
        <div className="ao-status-menu" onClick={e => e.stopPropagation()}>
            <button
                ref={buttonRef}
                type="button"
                className={`ak-pill is-${statusTone(status)} ao-pill-button`}
                aria-haspopup="true"
                aria-expanded={open}
                aria-controls={menuId}
                disabled={disabled || busy}
                onClick={() => setOpen(v => !v)}
            >
                {busy ? <Loader2 size={12} className="ak-spin" aria-hidden="true" /> : <span className="ak-dot" aria-hidden="true" />}
                {meta.label}
                <ChevronDown size={13} aria-hidden="true" />
            </button>
            <Popover anchorRef={buttonRef} open={open} onClose={() => setOpen(false)} id={menuId} role="menu" label="Change status" width={236}>
                <div className="ao-menu">
                    <div className="ao-menu-label">Change status</div>
                    {STATUSES.map(s => (
                        <button key={s.key} type="button" role="menuitemradio" aria-checked={s.key === status} className={`ao-menu-item is-${statusTone(s.key)}`} onClick={() => pick(s.key)}>
                            <span className="ak-dot" aria-hidden="true" />
                            <span>{s.label}</span>
                            {s.key === status && <Check size={14} className="ao-menu-check" aria-hidden="true" />}
                        </button>
                    ))}
                    <div className="ao-menu-foot">
                        <Checkbox label="Email the customer" checked={notify} onChange={setNotify} />
                        <p className="ao-menu-hint">“Pending review” never sends an email.</p>
                    </div>
                </div>
            </Popover>
        </div>
    );
}
