import { Facebook, Inbox, Instagram, Link as LinkIcon, Linkedin, Phone, Receipt, Share2 } from 'lucide-react';
import { Card, Field, FieldRow, Input, Skeleton, Switch } from '../../../components/admin/ui';
import { MAX_RECIPIENTS, PLATFORMS } from './contactForm';

/*
 * The text cards of Admin > Contact. Each gets the slice of the form it
 * edits and an onChange for it; ContactPage owns the state and saving.
 */

const FieldsSkeleton = ({ rows = 2 }) => Array.from({ length: rows }, (_, i) => (
    <div key={i} className="ac-ct-sk"><Skeleton width={120} size="sm" /><Skeleton size="lg" /></div>
));

/* Phone, email and address in the footer and on the contact page. */
export function ContactDetailsCard({ value, onChange, errors, loading }) {
    const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });
    return (
        <Card title="Contact details" icon={Phone} subtitle="Shown in the site footer and on the contact page.">
            {loading ? <FieldsSkeleton rows={3} /> : (
                <>
                    <FieldRow>
                        <Field label="Phone">
                            <Input type="tel" value={value.phone} onChange={set('phone')} placeholder="+1 (555) 000-0000" autoComplete="off" />
                        </Field>
                        <Field label="Email" error={errors.email}>
                            <Input type="email" value={value.email} onChange={set('email')} placeholder="info@yourcompany.com" invalid={!!errors.email} autoComplete="off" />
                        </Field>
                    </FieldRow>
                    <Field label="Address">
                        <Input value={value.address} onChange={set('address')} placeholder="1234 Metal St, Dallas, TX 75243" autoComplete="off" />
                    </Field>
                </>
            )}
        </Card>
    );
}

/* Where contact-form messages are emailed (admin only). */
export function InboxCard({ value, onChange, error, publicEmail, loading }) {
    return (
        <Card title="Website messages" icon={Inbox} subtitle="Messages from the contact form are emailed here through the account in Email settings. Not shown on the site.">
            {loading ? <FieldsSkeleton rows={1} /> : (
                <Field
                    label="Send messages to"
                    optional
                    error={error}
                    hint={`Up to ${MAX_RECIPIENTS} addresses, separated by commas. Empty sends them to ${publicEmail || 'the email above'}.`}
                >
                    <Input value={value} onChange={e => onChange(e.target.value)} placeholder="sales@yourcompany.com, support@yourcompany.com" invalid={!!error} spellCheck={false} autoComplete="off" />
                </Field>
            )}
        </Card>
    );
}

const PLATFORM_ICONS = { linkedin: Linkedin, facebook: Facebook, instagram: Instagram };

/* The social icons in the footer: a link and an on/off switch each. */
export function SocialLinksCard({ value, onChange, errors, loading }) {
    const update = (index, patch) => onChange(value.map((s, i) => (i === index ? { ...s, ...patch } : s)));
    return (
        <Card title="Social links" icon={Share2} subtitle="Icons in the site footer. Only links that are on and start with https:// are shown.">
            {loading ? <FieldsSkeleton rows={3} /> : (
                <div className="ac-ct-socials">
                    {value.map((s, i) => {
                        const meta = PLATFORMS.find(p => p.platform === s.platform);
                        const Icon = PLATFORM_ICONS[s.platform] || LinkIcon;
                        const label = meta?.label || s.platform;
                        const error = errors[`social:${s.platform}`];
                        return (
                            <div key={s.platform} className={`ac-ct-social${s.enabled ? '' : ' is-off'}`}>
                                <span className="ac-ct-social-icon" aria-hidden="true"><Icon size={18} /></span>
                                <Field label={label} error={error} className="ac-ct-social-field">
                                    <Input value={s.url} onChange={e => update(i, { url: e.target.value })} placeholder={meta?.placeholder || 'https://…'} invalid={!!error} spellCheck={false} autoComplete="off" />
                                </Field>
                                <Switch label={`Show ${label}`} checked={s.enabled} onChange={enabled => update(i, { enabled })} className="ac-ct-social-switch" />
                            </div>
                        );
                    })}
                </div>
            )}
        </Card>
    );
}

/* Per-service prices on the instant quote. */
export function QuoteDisplayCard({ value, onChange, loading }) {
    return (
        <Card title="Quote display" icon={Receipt} subtitle="What customers see on the instant quote.">
            {loading ? <FieldsSkeleton rows={1} /> : (
                <Switch
                    label="Show the price of each service"
                    description="When off, customers only see the total."
                    checked={value}
                    onChange={onChange}
                />
            )}
        </Card>
    );
}

