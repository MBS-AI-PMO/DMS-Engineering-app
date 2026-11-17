import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { Button, Card, Field, FieldRow, Input, Select } from '../../../components/admin/ui';
import { costingService } from '../../../services/admin/costing';
import ChoiceChips from './ChoiceChips';
import PriceBreakdown from './PriceBreakdown';

const NUMBER_FIELDS = [
    ['thickness_value', 'Thickness', 'in'],
    ['length_in', 'Flat length', 'in'],
    ['height_in', 'Flat width', 'in'],
    ['cut_length_in', 'Cut length', 'in', 'Blank = the outline only'],
    ['holes', 'Holes'],
    ['bends', 'Bends'],
    ['quantity', 'Quantity'],
];

const isBend = (s) => /bend/i.test(s.title);

/**
 * "Try a price": prices a made-up part with the live rules and shows every
 * step, so a change can be checked right after it is made.
 */
export default function PriceCalculator({ config, toast }) {
    const production = config.services.filter(s => s.is_production && s.is_active !== false);
    const extras = config.services.filter(s => !s.is_production && s.is_active !== false
        && !/tap|countersink|hardware/i.test(s.title) && !isBend(s));
    const [form, setForm] = useState({
        metal_id: String(config.metals[0]?.id || ''),
        service_id: String(production[0]?.id || ''),
        thickness_value: '0.063',
        length_in: '10',
        height_in: '5',
        cut_length_in: '',
        holes: '2',
        bends: '0',
        quantity: '10',
        extras: [],
    });
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);

    const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
    const toggleExtra = (id) => setForm(f => ({ ...f, extras: f.extras.includes(id) ? f.extras.filter(x => x !== id) : [...f.extras, id] }));

    const run = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            const cut = parseFloat(form.cut_length_in);
            const bendCount = Math.max(0, parseInt(form.bends, 10) || 0);
            const shortSide = Math.min(parseFloat(form.length_in) || 0, parseFloat(form.height_in) || 0);
            const data = await costingService.preview({
                metal_id: Number(form.metal_id) || null,
                service_id: Number(form.service_id) || null,
                thickness_value: form.thickness_value,
                length_in: form.length_in,
                height_in: form.height_in,
                quantity: form.quantity,
                additional_services: [
                    ...form.extras.map(id => ({ id })),
                    ...(bendCount ? config.services.filter(isBend).map(s => ({ id: s.id })) : []),
                ],
                technical_data: {
                    totalPerimeter: cut > 0 ? cut * 25.4 : undefined,
                    pierceCount: Math.max(0, parseInt(form.holes, 10) || 0),
                    bends: Array.from({ length: bendCount }, () => ({ length: shortSide * 25.4, radius: 1, angle: 90 })),
                },
            });
            setResult(data.result);
        } catch (err) {
            toast(err.message, 'error');
            setResult(null);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card title="Try a price" icon={Calculator} subtitle="Price a part with today's rules and see each step of the working.">
            <form onSubmit={run}>
                <FieldRow>
                    <Field label="Production method">
                        <Select value={form.service_id} onChange={set('service_id')} options={production.map(s => ({ value: String(s.id), label: s.title }))} />
                    </Field>
                    <Field label="Material">
                        <Select value={form.metal_id} onChange={set('metal_id')} options={config.metals.map(m => ({ value: String(m.id), label: m.name }))} />
                    </Field>
                </FieldRow>
                <div className="ck-number-grid">
                    {NUMBER_FIELDS.map(([key, label, unit, hint]) => (
                        <Field key={key} label={unit ? `${label} (${unit})` : label} hint={hint}>
                            <Input type="number" step="any" min="0" inputMode="decimal" value={form[key]} onChange={set(key)} />
                        </Field>
                    ))}
                </div>
                <Field as="div" label="Extra services">
                    <ChoiceChips
                        label="Extra services"
                        items={extras.map(s => ({ value: s.id, label: s.title }))}
                        selected={form.extras}
                        onToggle={toggleExtra}
                        empty="No extra services are switched on."
                    />
                </Field>
                <Button type="submit" variant="primary" icon={Calculator} loading={busy}>{busy ? 'Pricing…' : 'Price it'}</Button>
            </form>
            {result && <PriceBreakdown result={result} />}
        </Card>
    );
}
