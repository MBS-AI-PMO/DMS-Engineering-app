import { useState } from 'react';
import { Code, Images, ListChecks, Ruler, SlidersHorizontal } from 'lucide-react';
import { Banner, Card, Field, Input, Segmented, Stack } from '../../../components/admin/ui';
import RawJsonEditor from '../catalog/RawJsonEditor';
import SpecSection from './SpecSection';
import ShowcaseImages from './ShowcaseImages';
import ThicknessPicker from './ThicknessPicker';
import { SPEC_SECTIONS } from './metalForm';

const MODES = [
    { value: 'form', label: 'Form', icon: ListChecks },
    { value: 'json', label: 'JSON', icon: Code },
];

/**
 * Specifications: the base spec tables for every thickness, then overrides
 * for one thickness (its showcase pictures and any tables that differ).
 * thickness_specs is keyed by the thickness value ('.063"').
 */
export default function MetalSpecifications({ metal, onChange, upload }) {
    const [mode, setMode] = useState('form');
    const [index, setIndex] = useState(0);
    const specs = metal.specifications || {};
    const thicknesses = metal.quick_look?.thicknesses || [];
    const current = Math.min(index, Math.max(0, thicknesses.length - 1));
    const key = thicknesses[current]?.value || '';
    const overrides = metal.thickness_specs?.[key] || {};
    const setOverrides = (next) => { if (key) onChange('thickness_specs', { ...metal.thickness_specs, [key]: next }); };

    return (
        <>
            <div>
                <Segmented label="Edit as" items={MODES} value={mode} onChange={setMode} />
            </div>

            {mode === 'json' ? (
                <Card title="Specifications as JSON" icon={Code}>
                    <RawJsonEditor label="Base specifications (specifications)" value={metal.specifications} onChange={v => onChange('specifications', v)} rows={12} />
                    <RawJsonEditor label="Per-thickness specs (thickness_specs)" value={metal.thickness_specs} onChange={v => onChange('thickness_specs', v)} rows={12} />
                </Card>
            ) : (
                <>
                    <Card title="Base specifications" icon={SlidersHorizontal} subtitle="Apply to every thickness unless a thickness overrides them below.">
                        <Field label="Available services" optional hint="Comma separated. Shown on older metal pages when no services are linked.">
                            <Input
                                value={(specs.availableServices || []).join(', ')}
                                onChange={e => onChange('specifications', { ...specs, availableServices: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                placeholder="Laser Cutting, Bending, Anodizing…"
                            />
                        </Field>
                        {SPEC_SECTIONS.map(section => (
                            <SpecSection
                                key={section.key}
                                section={section}
                                rows={specs[section.key] || []}
                                onChange={rows => onChange('specifications', { ...specs, [section.key]: rows })}
                            />
                        ))}
                    </Card>

                    <Card title="Per-thickness overrides" icon={Ruler} subtitle="Only add what differs from the base specifications.">
                        {thicknesses.length === 0 ? (
                            <Banner>Add thicknesses under Quick look first.</Banner>
                        ) : (
                            <Stack>
                                <ThicknessPicker thicknesses={thicknesses} index={current} onChange={setIndex} />
                                {!key ? (
                                    <Banner tone="warn">This thickness has no value yet. Give it one under Quick look.</Banner>
                                ) : (
                                    <>
                                        <div>
                                            <h3 className="cat-section-title"><Images size={15} aria-hidden="true" /> Showcase pictures for {key}</h3>
                                            <ShowcaseImages
                                                images={overrides.showcaseImages || []}
                                                onChange={imgs => setOverrides({ ...overrides, showcaseImages: imgs })}
                                                upload={upload}
                                                thickness={key}
                                            />
                                        </div>
                                        <div>
                                            <h3 className="cat-section-title">Spec overrides for {key}</h3>
                                            {SPEC_SECTIONS.map(section => (
                                                <SpecSection
                                                    key={`${key}-${section.key}`}
                                                    section={section}
                                                    rows={overrides[section.key] || []}
                                                    onChange={rows => setOverrides({ ...overrides, [section.key]: rows })}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </Stack>
                        )}
                    </Card>
                </>
            )}
        </>
    );
}
