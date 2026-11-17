import { useState } from 'react';
import { ArrowUpRight, Copy, Pencil, Plus, Trash2, Truck } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { Button, Card, Checkbox, Field, FieldRow, FormActions, IconButton, Input, Select, Stack, useConfirm } from '../../../components/admin/ui';
import { ordersApi } from './ordersApi';
import { dayText, emailToast, todayDay } from './orderFormat';

const blank = (status) => ({
    carrier: 'ups', carrier_name: '', service: '', tracking_number: '', tracking_url: '',
    shipped_at: todayDay(), packages: '', notes: '',
    mark_shipped: !['shipping', 'completed'].includes(status), notify: true,
});

function ShipmentForm({ carriers, initial, isEdit, status, busy, onSubmit, onCancel }) {
    const [form, setForm] = useState(initial);
    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
    const carrier = carriers.find(c => c.key === form.carrier) || {};
    const groups = [
        ['Parcel', carriers.filter(c => !c.freight && !c.noTracking && c.key !== 'other')],
        ['Freight (LTL)', carriers.filter(c => c.freight)],
        ['Other', carriers.filter(c => c.noTracking || c.key === 'other')],
    ];
    return (
        <form className="ao-ship-form" onSubmit={e => { e.preventDefault(); onSubmit(form); }}>
            <FieldRow>
                <Field label="Carrier">
                    <Select value={form.carrier} onChange={e => set('carrier', e.target.value)}>
                        {groups.map(([label, list]) => (
                            <optgroup key={label} label={label}>
                                {list.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
                            </optgroup>
                        ))}
                    </Select>
                </Field>
                {form.carrier === 'other' ? (
                    <Field label="Carrier name">
                        <Input value={form.carrier_name} onChange={e => set('carrier_name', e.target.value)} maxLength={120} required />
                    </Field>
                ) : !carrier.noTracking && (
                    <Field label="Service" optional>
                        <Input value={form.service} onChange={e => set('service', e.target.value)} maxLength={120} placeholder={carrier.freight ? 'Standard LTL' : 'Ground, 2nd Day Air…'} />
                    </Field>
                )}
            </FieldRow>
            {!carrier.noTracking && (
                <Field label={carrier.freight ? 'PRO / tracking number' : 'Tracking number'}>
                    <Input className="ak-mono" value={form.tracking_number} onChange={e => set('tracking_number', e.target.value)} maxLength={120} required autoComplete="off" spellCheck={false} />
                </Field>
            )}
            {!carrier.noTracking && (
                <Field label="Tracking link" hint={carrier.autoLink ? 'Optional: made from the number.' : "Paste the carrier's tracking page so the customer can follow it."}>
                    <Input type="url" value={form.tracking_url} onChange={e => set('tracking_url', e.target.value)} placeholder="https://" maxLength={1000} />
                </Field>
            )}
            <FieldRow>
                <Field label={carrier.noTracking ? 'Date' : 'Ship date'}>
                    <Input type="date" value={form.shipped_at || ''} onChange={e => set('shipped_at', e.target.value)} />
                </Field>
                <Field label="Packages" optional>
                    <Input type="number" min="1" max="999" step="1" value={form.packages ?? ''} onChange={e => set('packages', e.target.value)} />
                </Field>
            </FieldRow>
            <Field label="Internal note" hint="Staff only.">
                <Input value={form.notes || ''} onChange={e => set('notes', e.target.value)} maxLength={2000} placeholder="Weight, dimensions, pallet count…" />
            </Field>
            {!isEdit && (
                <Stack className="is-tight ao-checks">
                    {!['shipping', 'completed'].includes(status) && (
                        <Checkbox label="Mark the order as Shipped" checked={form.mark_shipped} onChange={v => set('mark_shipped', v)} />
                    )}
                    <Checkbox label="Email the customer the tracking details" checked={form.notify} onChange={v => set('notify', v)} />
                </Stack>
            )}
            <FormActions>
                <Button onClick={onCancel} disabled={busy}>Cancel</Button>
                <Button type="submit" variant="primary" loading={busy}>{isEdit ? 'Save' : form.notify ? 'Add and email' : 'Add shipment'}</Button>
            </FormActions>
        </form>
    );
}

export default function OrderShipping({ orderId, status, shipments, carriers, onChanged }) {
    const toast = useToast();
    const [confirm, confirmDialog] = useConfirm();
    const [mode, setMode] = useState(null); // 'add' | shipment id
    const [busy, setBusy] = useState(false);

    const copy = (value) => {
        navigator.clipboard?.writeText(value).then(() => toast('Tracking number copied', 'success'), () => toast('Could not copy', 'error'));
    };

    const add = async (form) => {
        setBusy(true);
        try {
            const result = await ordersApi.addShipment(orderId, form);
            emailToast(toast, result.email, 'Shipment added');
            setMode(null);
            await onChanged();
        } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
    };
    const save = async (id, form) => {
        setBusy(true);
        try {
            await ordersApi.saveShipment(orderId, id, form);
            toast('Shipment saved', 'success');
            setMode(null);
            await onChanged();
        } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
    };
    const remove = async (s) => {
        if (!(await confirm({ title: `Remove the ${s.carrier_label} shipment?`, message: `${s.tracking_number ? `${s.tracking_number}. ` : ''}The customer will no longer see it.`, confirmLabel: 'Remove', danger: true }))) return;
        try {
            await ordersApi.deleteShipment(orderId, s.id);
            await onChanged();
        } catch (err) { toast(err.message, 'error'); }
    };

    return (
        <Card
            id="ao-ship"
            title="Shipping & tracking"
            icon={Truck}
            actions={mode !== 'add' ? <Button size="sm" icon={Plus} onClick={() => setMode('add')}>Add tracking</Button> : null}
        >
            {shipments.length === 0 && mode !== 'add' && (
                <p className="ak-hint">No shipment yet. Add the carrier and tracking number when the parts leave the shop; the customer gets a tracking link by email and on their order page.</p>
            )}

            <ul className="ao-shipments">
                {shipments.map(s => (
                    <li key={s.id} className="ao-shipment">
                        {mode === s.id ? (
                            <ShipmentForm
                                carriers={carriers}
                                isEdit
                                status={status}
                                busy={busy}
                                initial={{ ...s, packages: s.packages ?? '', tracking_url: s.tracking_url || '', service: s.service || '', carrier_name: s.carrier_name || '', notes: s.notes || '' }}
                                onSubmit={form => save(s.id, form)}
                                onCancel={() => setMode(null)}
                            />
                        ) : (
                            <>
                                <div className="ao-shipment-top">
                                    <span className="ao-carrier">{s.carrier_label}{s.service ? <span className="ao-dim"> · {s.service}</span> : null}</span>
                                    <span className="ak-row-actions">
                                        <IconButton icon={Pencil} label="Edit shipment" size="xs" onClick={() => setMode(s.id)} />
                                        <IconButton icon={Trash2} label="Remove shipment" size="xs" variant="danger" onClick={() => remove(s)} />
                                    </span>
                                </div>
                                {s.tracking_number && (
                                    <div className="ao-tracking">
                                        <code>{s.tracking_number}</code>
                                        <IconButton icon={Copy} label="Copy tracking number" size="xs" onClick={() => copy(s.tracking_number)} />
                                        {s.tracking_link && <a className="ak-link ao-track-link" href={s.tracking_link} target="_blank" rel="noreferrer">Track <ArrowUpRight size={13} aria-hidden="true" /></a>}
                                    </div>
                                )}
                                <p className="ak-hint">
                                    {[s.shipped_at ? `${s.no_tracking ? '' : 'Shipped '}${dayText(s.shipped_at)}` : '', s.packages ? `${s.packages} package${s.packages > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')}
                                </p>
                                {s.notes && <p className="ao-note-text">{s.notes}</p>}
                            </>
                        )}
                    </li>
                ))}
            </ul>

            {mode === 'add' && (
                <ShipmentForm carriers={carriers} initial={blank(status)} status={status} busy={busy} onSubmit={add} onCancel={() => setMode(null)} />
            )}
            {confirmDialog}
        </Card>
    );
}
