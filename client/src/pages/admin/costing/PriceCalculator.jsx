import { useEffect, useRef, useState } from 'react';
import { Calculator, FileBox, Keyboard } from 'lucide-react';
import { Banner, Button, Card, Field, FieldRow, Input, Segmented, Select, Spinner } from '../../../components/admin/ui';
import { costingService } from '../../../services/admin/costing';
import ChoiceChips from './ChoiceChips';
import CadFilePicker from './CadFilePicker';
import MeasuredPart from './MeasuredPart';
import PriceBreakdown from './PriceBreakdown';

// Typed sizes (manual mode only; a file gives these itself).
const PART_FIELDS = [
    ['length_in', 'Flat length', 'in'],
    ['height_in', 'Flat width', 'in'],
    ['cut_length_in', 'Cut length', 'in', 'Blank = the outline only'],
    ['holes', 'Holes'],
    ['bends', 'Bends'],
];
const MODES = [
    { value: 'manual', label: 'Type the sizes', icon: Keyboard },
    { value: 'file', label: 'Use a file', icon: FileBox },
];

const isBend = (s) => /bend/i.test(s.title);
const isStep = (name) => /\.(step|stp)$/i.test(name || '');

/**
 * "Try a price": prices a part with the live rules and shows every step,
 * so a change can be checked right after it is made — either from typed
 * sizes or from a real CAD file, which the server measures itself (flat
 * size, cut length, holes, bends) exactly as it does for orders.
 */
export default function PriceCalculator({ config, toast }) {
    const production = config.services.filter(s => s.is_production && s.is_active !== false);
    const finishing = config.services.filter(s => !s.is_production && s.is_active !== false && !/tap|countersink|hardware/i.test(s.title));
    const [mode, setMode] = useState('manual');
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
    const [cad, setCad] = useState(null); // { name, size, status, tempPath, error }
    // With a file, its own thickness is used unless one is typed after choosing it.
    const [thicknessTyped, setThicknessTyped] = useState(false);
    const [answer, setAnswer] = useState(null); // { result, measured, mode, fileName, thickness }
    const [busy, setBusy] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const uploadSeq = useRef(0);

    // Seconds spent waiting, shown while a file is being measured.
    useEffect(() => {
        if (!busy) return undefined;
        const started = Date.now();
        const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
        return () => clearInterval(timer);
    }, [busy]);

    // Manual mode adds the bending service when bends > 0; with a file you pick it.
    const extras = mode === 'file' ? finishing : finishing.filter(s => !isBend(s));
    const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
    const toggleExtra = (id) => setForm(f => ({ ...f, extras: f.extras.includes(id) ? f.extras.filter(x => x !== id) : [...f.extras, id] }));

    const pickFile = async (file) => {
        if (!/\.(step|stp|dxf)$/i.test(file.name)) {
            setCad({ name: file.name, size: file.size, status: 'error', error: 'Use a STEP, STP or DXF file.' });
            return;
        }
        const seq = ++uploadSeq.current;
        setThicknessTyped(false);
        setCad({ name: file.name, size: file.size, status: 'uploading' });
        setAnswer(null);
        try {
            const res = await costingService.uploadCad(file);
            if (!res?.tempPath) throw new Error('The upload did not return a file.');
            if (seq === uploadSeq.current) setCad({ name: file.name, size: file.size, status: 'ready', tempPath: res.tempPath });
        } catch (err) {
            if (seq === uploadSeq.current) setCad({ name: file.name, size: file.size, status: 'error', error: `Upload failed: ${err.message}` });
        }
    };
    const clearFile = () => { uploadSeq.current += 1; setCad(null); setAnswer(null); };

    const run = async (e) => {
        e.preventDefault();
        if (mode === 'file' && cad?.status !== 'ready') {
            toast(cad?.status === 'uploading' ? 'Wait for the upload to finish' : 'Choose a CAD file first', 'warning');
            return;
        }
        setElapsed(0);
        setBusy(true);
        const common = {
            metal_id: Number(form.metal_id) || null,
            service_id: Number(form.service_id) || null,
            thickness_value: form.thickness_value,
            quantity: form.quantity,
        };
        try {
            let body;
            if (mode === 'file') {
                body = { ...common, file_ref: cad.tempPath, additional_services: form.extras.map(id => ({ id })) };
            } else {
                const cut = parseFloat(form.cut_length_in);
                const bendCount = Math.max(0, parseInt(form.bends, 10) || 0);
                const shortSide = Math.min(parseFloat(form.length_in) || 0, parseFloat(form.height_in) || 0);
                body = {
                    ...common,
                    length_in: form.length_in,
                    height_in: form.height_in,
                    additional_services: [
                        ...form.extras.map(id => ({ id })),
                        ...(bendCount ? config.services.filter(isBend).map(s => ({ id: s.id })) : []),
                    ],
                    technical_data: {
                        totalPerimeter: cut > 0 ? cut * 25.4 : undefined,
                        pierceCount: Math.max(0, parseInt(form.holes, 10) || 0),
                        bends: Array.from({ length: bendCount }, () => ({ length: shortSide * 25.4, radius: 1, angle: 90 })),
                    },
                };
            }
            let data = await costingService.preview(body);
            let thickness = form.thickness_value;
            // The file's thickness is known once the server has measured it: price
            // again with it (the measurement is saved, so this is quick).
            const fileThickness = Number(data.measured?.thicknessIn);
            if (mode === 'file' && !thicknessTyped && fileThickness > 0 && Math.abs(fileThickness - Number(form.thickness_value)) > 0.0005) {
                thickness = String(Math.round(fileThickness * 1000) / 1000);
                setForm(f => ({ ...f, thickness_value: thickness }));
                data = await costingService.preview({ ...body, thickness_value: thickness });
            }
            setAnswer({ result: data.result, measured: data.measured, mode, fileName: cad?.name, thickness });
        } catch (err) {
            toast(err.message, 'error');
            setAnswer(null);
        } finally {
            setBusy(false);
        }
    };

    const switchMode = (next) => { setMode(next); setAnswer(null); };
    const measuring = busy && mode === 'file';

    return (
        <Card
            title="Try a price"
            icon={Calculator}
            subtitle="Price a part with today's rules and see each step of the working."
            actions={<Segmented items={MODES} value={mode} onChange={switchMode} label="Price from" />}
        >
            <form onSubmit={run}>
                {mode === 'file' && (
                    <Field as="div" label="CAD file" hint="Its flat size, cut length, holes and bends are measured by the server and replace typed sizes.">
                        <CadFilePicker file={cad} onPick={pickFile} onClear={clearFile} disabled={busy} />
                    </Field>
                )}
                <FieldRow>
                    <Field label="Production method">
                        <Select value={form.service_id} onChange={set('service_id')} options={production.map(s => ({ value: String(s.id), label: s.title }))} />
                    </Field>
                    <Field label="Material">
                        <Select value={form.metal_id} onChange={set('metal_id')} options={config.metals.map(m => ({ value: String(m.id), label: m.name }))} />
                    </Field>
                </FieldRow>
                <div className="ck-number-grid">
                    <Field label="Thickness (in)" hint={mode === 'file' && !thicknessTyped ? "Taken from the file when it is priced. Type a value to price another thickness." : undefined}>
                        <Input type="number" step="any" min="0" inputMode="decimal" value={form.thickness_value} onChange={e => { setThicknessTyped(true); set('thickness_value')(e); }} />
                    </Field>
                    {mode === 'manual' && PART_FIELDS.map(([key, label, unit, hint]) => (
                        <Field key={key} label={unit ? `${label} (${unit})` : label} hint={hint}>
                            <Input type="number" step="any" min="0" inputMode="decimal" value={form[key]} onChange={set(key)} />
                        </Field>
                    ))}
                    <Field label="Quantity">
                        <Input type="number" step="1" min="1" inputMode="numeric" value={form.quantity} onChange={set('quantity')} />
                    </Field>
                </div>
                <Field as="div" label="Extra services" hint={mode === 'file' ? 'Pick Bending if the part is bent: its bends come from the file.' : 'Bending is added when Bends is above 0.'}>
                    <ChoiceChips
                        label="Extra services"
                        items={extras.map(s => ({ value: s.id, label: s.title }))}
                        selected={form.extras}
                        onToggle={toggleExtra}
                        empty="No extra services are switched on."
                    />
                </Field>
                <Button type="submit" variant="primary" icon={Calculator} loading={busy} disabled={mode === 'file' && cad?.status !== 'ready'}>
                    {busy ? (measuring ? 'Measuring and pricing…' : 'Pricing…') : 'Price it'}
                </Button>
            </form>

            {measuring && (
                <Banner>
                    <span className="ck-progress">
                        <Spinner size={15} label="Measuring" />
                        {isStep(cad?.name)
                            ? `Measuring ${cad.name} on the CAD service… ${elapsed}s. The first time a STEP file is measured this can take a minute or two.`
                            : `Reading ${cad?.name}… ${elapsed}s.`}
                    </span>
                </Banner>
            )}
            {answer && (
                <div className="ck-result">
                    {answer.mode === 'file' && <MeasuredPart measured={answer.measured} pricedThickness={answer.thickness} fileName={answer.fileName} />}
                    <PriceBreakdown result={answer.result} />
                </div>
            )}
        </Card>
    );
}
