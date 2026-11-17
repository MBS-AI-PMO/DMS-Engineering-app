import { useMemo, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Banner, Button, Field, Input, Modal, Switch } from '../../../components/admin/ui';
import { parseQuantities, rangeLabel, rangesText, toRanges } from './discountFormat';

/**
 * Add or edit one tier: the percentage off, the quantities it applies to
 * (typed as 50, 10-25 or 500+, shown as ranges you can remove) and whether
 * it is active. Warns when a quantity is already in another tier.
 * onSave(tier) resolves true when saved (the dialog then closes).
 */
export default function DiscountTierDialog({ tier, otherTiers, onSave, onClose }) {
    const [quantities, setQuantities] = useState(() => (Array.isArray(tier?.quantities) ? tier.quantities.map(Number) : []));
    const [percent, setPercent] = useState(tier ? String(Number(tier.discount_percent)) : '');
    const [active, setActive] = useState(tier?.is_active !== false);
    const [typed, setTyped] = useState('');
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const ranges = toRanges(quantities);
    const clashes = useMemo(() => otherTiers
        .map(t => ({ tier: t, shared: (t.quantities || []).map(Number).filter(q => quantities.includes(q)) }))
        .filter(c => c.shared.length), [otherTiers, quantities]);

    const addTyped = () => {
        const { values, error } = parseQuantities(typed);
        if (error) { setErrors(e => ({ ...e, typed: error })); return; }
        setQuantities(q => [...new Set([...q, ...values])].sort((a, b) => a - b));
        setTyped('');
        setErrors(e => ({ ...e, typed: undefined, quantities: undefined }));
    };
    const removeRange = ([start, end]) => setQuantities(q => q.filter(n => n < start || n > end));

    const submit = async (e) => {
        e.preventDefault();
        const pct = Number(percent);
        const next = {};
        if (percent === '' || !Number.isFinite(pct) || pct < 0 || pct > 100) next.percent = 'Enter a percentage from 0 to 100.';
        if (!quantities.length) next.quantities = 'Add at least one quantity.';
        setErrors(next);
        if (Object.keys(next).length) return;
        setSaving(true);
        const done = await onSave({ id: tier?.id, quantities, discount_percent: pct, is_active: active });
        setSaving(false);
        if (done) onClose();
    };

    return (
        <Modal
            title={tier ? 'Edit discount tier' : 'Add discount tier'}
            subtitle="A percentage off a line when its quantity is one of these."
            onClose={onClose}
            footer={(
                <>
                    <Button onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button variant="primary" icon={Check} type="submit" form="dc-tier-form" loading={saving}>{tier ? 'Save tier' : 'Add tier'}</Button>
                </>
            )}
        >
            <form id="dc-tier-form" onSubmit={submit}>
                <Field label="Discount (%)" error={errors.percent}>
                    <Input type="number" min="0" max="100" step="any" inputMode="decimal" value={percent} invalid={Boolean(errors.percent)} onChange={e => setPercent(e.target.value)} placeholder="e.g. 10" />
                </Field>

                <Field as="div" label="Quantities" error={errors.quantities} hint={`${quantities.length} ${quantities.length === 1 ? 'quantity' : 'quantities'}: ${rangesText(quantities)}`}>
                    <div className="dc-ranges" aria-live="polite">
                        {ranges.length ? ranges.map(r => (
                            <span key={r[0]} className="dc-range">
                                {rangeLabel(r)}
                                <button type="button" onClick={() => removeRange(r)} aria-label={`Remove ${rangeLabel(r)}`} disabled={saving}><X size={12} aria-hidden="true" /></button>
                            </span>
                        )) : <span className="ak-hint">No quantities yet.</span>}
                    </div>
                </Field>
                <Field label="Add quantities" error={errors.typed} hint='Type 50, a range like 10-25, or 500+ for "500 and up". Separate several with commas.'>
                    <div className="dc-add-row">
                        <Input
                            value={typed}
                            invalid={Boolean(errors.typed)}
                            onChange={e => { setTyped(e.target.value); setErrors(x => ({ ...x, typed: undefined })); }}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTyped(); } }}
                            placeholder="e.g. 10-25"
                            disabled={saving}
                        />
                        <Button icon={Plus} onClick={addTyped} disabled={saving || !typed.trim()}>Add</Button>
                    </div>
                </Field>

                {clashes.length > 0 && (
                    <Banner tone="warn">
                        Also in another tier: {clashes.map(c => `${rangesText(c.shared)} (${Number(c.tier.discount_percent)}% tier)`).join('; ')}.
                        Keep each quantity in one tier so the discount is clear.
                    </Banner>
                )}

                <Switch checked={active} onChange={setActive} label="Active" description="An inactive tier is kept but never applied." disabled={saving} />
            </form>
        </Modal>
    );
}
