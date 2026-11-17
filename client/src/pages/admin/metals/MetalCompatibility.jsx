import { Grid3x3, Ruler, Wrench } from 'lucide-react';
import { Banner, Card, DataTable, Pill } from '../../../components/admin/ui';
import { toIds, thicknessLabel } from './metalForm';

/**
 * Read-only: which secondary services each thickness offers (edited under
 * Services). Prices are not set here: they live in Admin > Costing.
 */
export default function MetalCompatibility({ metal, services }) {
    const thicknesses = metal.quick_look?.thicknesses || [];
    const secondary = services.filter(s => !s.is_production);
    // The ticks under Services (quick_look) are the source; thickness_specs mirrors them after a save.
    const offered = (t) => toIds(t.services ?? metal.thickness_specs?.[t.value]?.available_services);

    const columns = [
        { key: 'thickness', header: 'Thickness', icon: Ruler, width: 140, render: (t) => <strong>{thicknessLabel(t, thicknesses.indexOf(t))}</strong> },
        {
            key: 'services', header: 'Services offered', icon: Wrench,
            render: (t) => {
                const ids = offered(t);
                const on = secondary.filter(s => ids.includes(Number(s.id)));
                return on.length ? <span className="cat-inline">{on.map(s => <Pill key={s.id} tone="green">{s.title}</Pill>)}</span> : <span className="cat-muted">None</span>;
            },
        },
    ];

    return (
        <Card title="Thickness compatibility" icon={Grid3x3} subtitle="Which services each thickness offers. Change them under Services.">
            <Banner>
                Prices for this metal (sheet costs, cut rates, markups) are set in <a className="ak-link" href="/admin/costing">Admin › Costing</a>.
            </Banner>
            <DataTable
                caption="Services offered per thickness"
                columns={columns}
                rows={thicknesses}
                rowKey={(t, i) => `${t.value}-${i}`}
                empty={<p className="cat-rows-empty">Add thicknesses under Quick look first.</p>}
            />
        </Card>
    );
}
