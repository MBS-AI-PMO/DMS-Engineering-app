import EditableTable from './EditableTable';
import TabIntro from './TabIntro';
import { costingRowHandlers } from './costingRowHandlers';
import { metalOptions, trimNumber } from './costingFormat';

/** Laser cut rates by material family and thickness. */
export default function LaserRatesTab(ctx) {
    const { config, onDirtyChange } = ctx;
    const rows = config.laserRates.map(r => ({
        ...r,
        metal_id: r.metal_id ? String(r.metal_id) : '',
        thickness: trimNumber(r.thickness),
        cut_rate: trimNumber(r.cut_rate),
        pierce_time: trimNumber(r.pierce_time),
    }));
    const families = [...new Set(config.laserRates.map(r => r.material_family).filter(Boolean))].sort();

    const columns = [
        { key: 'material_family', label: 'Family', placeholder: 'generic', list: 'ck-laser-families', width: 150 },
        { key: 'metal_id', label: 'Only for metal', type: 'select', options: metalOptions(config.metals), width: 170 },
        { key: 'thickness', label: 'Up to thickness (in)', type: 'number', width: 120 },
        { key: 'cut_rate', label: 'Cut rate (mm/s)', type: 'number', width: 110 },
        { key: 'pierce_time', label: 'Pierce time (s)', type: 'number', width: 110 },
        { key: 'sort_order', label: 'Order', type: 'number', width: 80 },
    ];

    return (
        <>
            <TabIntro title="Laser rates">
                A part uses the first row at or above its thickness (a family or metal match beats &quot;generic&quot;).
                Cut time = cut length ÷ cut rate; each hole plus the outline adds one pierce.
            </TabIntro>
            <datalist id="ck-laser-families">{families.map(f => <option key={f} value={f} />)}</datalist>
            <EditableTable
                caption="Laser rates"
                unit="laser rate"
                rows={rows}
                columns={columns}
                {...costingRowHandlers({
                    collection: 'laser-rates',
                    label: 'Laser rate',
                    unit: 'laser rate',
                    ctx,
                    describe: (r) => `the ${r.material_family || 'generic'} rate up to ${trimNumber(r.thickness)} in`,
                })}
                onDirtyChange={onDirtyChange}
                newRow={() => ({ material_family: 'generic', metal_id: '', thickness: '', cut_rate: '', pierce_time: '', sort_order: config.laserRates.length })}
                addLabel="Add laser rate"
            />
        </>
    );
}
