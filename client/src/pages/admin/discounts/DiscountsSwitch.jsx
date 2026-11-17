import { Power } from 'lucide-react';
import { Card, Pill, Skeleton, Switch } from '../../../components/admin/ui';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/**
 * The site-wide on/off switch for quantity discounts, made hard to miss:
 * a coloured panel, a large status and what it means for customers.
 * enabled: true | false | null (loading). onToggle(next).
 */
export default function DiscountsSwitch({ enabled, busy, onToggle, biggest }) {
    const loading = enabled === null;
    return (
        <Card className={cx('dc-switch', !loading && (enabled ? 'is-on' : 'is-off'))} aria-live="polite">
            <div className="dc-switch-row">
                <span className="dc-switch-icon" aria-hidden="true"><Power size={22} /></span>
                <div className="dc-switch-text">
                    {loading ? (
                        <>
                            <Skeleton width={220} size="lg" />
                            <Skeleton width="60%" />
                        </>
                    ) : (
                        <>
                            <p className="dc-switch-title">
                                Quantity discounts are {enabled ? 'on' : 'off'}
                                <Pill tone={enabled ? 'green' : 'red'} dot>{enabled ? 'Applied on the website' : 'Not applied'}</Pill>
                            </p>
                            <p className="dc-switch-sub">
                                {enabled
                                    ? `Customers get a tier's percentage off when a line's quantity matches${biggest ? ` (up to ${biggest}% off)` : ''}.`
                                    : 'Customers pay the full price at every quantity. The tiers below are kept, but nothing is taken off until you turn this on.'}
                            </p>
                        </>
                    )}
                </div>
                <Switch
                    checked={Boolean(enabled)}
                    onChange={onToggle}
                    disabled={loading || busy}
                    label={<span className="ak-sr">Quantity discounts on the website</span>}
                />
            </div>
        </Card>
    );
}
