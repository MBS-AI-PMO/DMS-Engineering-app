import { useId } from 'react';
import { Card, Pill, Switch } from '../../../components/admin/ui';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/**
 * One way to pay: icon, name, what it means for the customer, and its
 * on/off switch. children: its settings (shown under the head).
 */
export default function PaymentMethodCard({ icon, title, description, enabled, onToggle, disabled, children }) {
    const Icon = icon;
    const titleId = useId();
    return (
        <Card className={cx('pm-method', enabled && 'is-on')} aria-labelledby={titleId}>
            <div className="pm-method-head">
                <span className="pm-method-icon" aria-hidden="true"><Icon size={24} /></span>
                <div className="pm-method-text">
                    <h2 className="ak-card-title" id={titleId}>{title}</h2>
                    <p className="ak-card-sub">{description}</p>
                </div>
                <div className="pm-method-switch">
                    <Pill tone={enabled ? 'green' : 'gray'} dot>{enabled ? 'On at checkout' : 'Off'}</Pill>
                    <Switch checked={enabled} onChange={onToggle} disabled={disabled} label={<span className="ak-sr">{title} at checkout</span>} />
                </div>
            </div>
            {children && <div className="pm-method-body">{children}</div>}
        </Card>
    );
}
