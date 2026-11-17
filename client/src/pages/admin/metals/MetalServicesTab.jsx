import { useState } from 'react';
import { Code, Layers, Zap } from 'lucide-react';
import { Banner, Card, Stack } from '../../../components/admin/ui';
import ChoiceChips from '../catalog/ChoiceChips';
import RawJsonEditor from '../catalog/RawJsonEditor';
import ThicknessPicker from './ThicknessPicker';
import { toIds } from './metalForm';

const toggleId = (list, id, on) => {
    const ids = toIds(list).filter(x => x !== Number(id));
    return on ? [...ids, Number(id)] : ids;
};

/**
 * Which services this metal offers: main production methods for the whole
 * metal (metals.services), and finishing / secondary services per
 * thickness (quick_look.thicknesses[n].services; the server mirrors them
 * into thickness_specs[value].available_services on save).
 */
export default function MetalServicesTab({ metal, services, onChange }) {
    const [index, setIndex] = useState(0);
    const thicknesses = metal.quick_look?.thicknesses || [];
    const current = Math.min(index, Math.max(0, thicknesses.length - 1));
    const production = services.filter(s => s.is_production).map(s => ({ value: s.id, label: s.title, sub: s.is_active === false ? 'Hidden' : undefined }));
    const secondary = services.filter(s => !s.is_production).map(s => ({ value: s.id, label: s.title, sub: s.is_active === false ? 'Hidden' : undefined }));
    const thicknessServices = toIds(thicknesses[current]?.services);

    const setThicknessServices = (ids) => onChange('quick_look', {
        ...metal.quick_look,
        thicknesses: thicknesses.map((t, i) => (i === current ? { ...t, services: ids } : t)),
    });

    return (
        <>
            <Card title="Production methods" icon={Zap} subtitle="The metal shows up in the quote flow of each method ticked here.">
                <ChoiceChips
                    label="Production methods"
                    options={production}
                    selected={toIds(metal.services)}
                    onToggle={(id, on) => onChange('services', toggleId(metal.services, id, on))}
                    empty="No production methods yet. Mark a service as a main production service first."
                />
            </Card>

            <Card title="Services per thickness" icon={Layers} subtitle="Finishing and secondary services (tapping, anodizing…) offered for each thickness.">
                {thicknesses.length === 0 ? (
                    <Banner>Add thicknesses under Quick look first.</Banner>
                ) : (
                    <Stack>
                        <ThicknessPicker
                            thicknesses={thicknesses}
                            index={current}
                            onChange={setIndex}
                            counts={thicknesses.map(t => toIds(t.services).filter(id => secondary.some(s => Number(s.value) === id)).length)}
                        />
                        <ChoiceChips
                            label={`Services for ${thicknesses[current]?.value || 'this thickness'}`}
                            options={secondary}
                            selected={thicknessServices}
                            onToggle={(id, on) => setThicknessServices(toggleId(thicknessServices, id, on))}
                            empty="No secondary services yet. Create services first."
                        />
                    </Stack>
                )}
            </Card>

            <details className="cat-fold">
                <summary><Code size={15} aria-hidden="true" /> Per-thickness specs as JSON</summary>
                <div className="cat-fold-body">
                    <RawJsonEditor label="thickness_specs" value={metal.thickness_specs} onChange={v => onChange('thickness_specs', v)} rows={8} hint="available_services here is rewritten from the ticks above when you save." />
                </div>
            </details>
        </>
    );
}
