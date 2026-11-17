import { Code, Ruler, Scissors } from 'lucide-react';
import { Card, Field, Input } from '../../../components/admin/ui';
import RowsEditor from '../catalog/RowsEditor';
import RawJsonEditor from '../catalog/RawJsonEditor';
import { EMPTY_QUICK_LOOK } from './metalForm';

const THICKNESS_COLUMNS = [
    { key: 'value', label: 'Thickness (inch)', placeholder: '.063"' },
    { key: 'metric', label: 'Metric (mm)', placeholder: '1.60mm' },
];

const CUT_SIZE_COLUMNS = [
    { key: 'label', label: 'Label', placeholder: 'A', width: 'minmax(0, 0.5fr)' },
    { key: 'size', label: 'Size', placeholder: '.25" x .375" min', width: 'minmax(0, 1.4fr)' },
    { key: 'action', label: 'Action', type: 'select', options: ['Instant Pricing', 'Custom Quote'] },
    { key: 'type', label: 'Style', type: 'select', options: [{ value: 'solid', label: 'Solid' }, { value: 'outline', label: 'Outline' }] },
];

/**
 * Quick look: tolerance, the thickness buttons of the quote page and metal
 * page (value + metric, in this order), and the cut size table.
 * Rows keep any other keys they have (e.g. a thickness's services).
 */
export default function MetalQuickLook({ quickLook, onChange }) {
    const ql = quickLook || EMPTY_QUICK_LOOK;
    const set = (key, value) => onChange({ ...ql, [key]: value });
    const thicknesses = ql.thicknesses || [];

    return (
        <>
            <Card title="Thicknesses" icon={Ruler} count={thicknesses.length} subtitle="The thickness buttons on the quote page and the metal page, in this order.">
                <RowsEditor
                    rows={thicknesses}
                    onChange={rows => set('thicknesses', rows)}
                    columns={THICKNESS_COLUMNS}
                    newRow={{ value: '', metric: '' }}
                    itemLabel="thickness"
                    reorder
                    emptyText="No thicknesses yet. Add the gauges this metal is stocked in."
                />
                <hr className="ak-divider" />
                <Field label="Tolerance" optional>
                    <Input value={ql.tolerance || ''} onChange={e => set('tolerance', e.target.value)} placeholder={'e.g. +/- .005"'} />
                </Field>
            </Card>

            <Card title="Cut sizes" icon={Scissors} count={(ql.cutSizes || []).length} subtitle="The smallest and largest parts, and which sizes are priced instantly.">
                <RowsEditor
                    rows={ql.cutSizes || []}
                    onChange={rows => set('cutSizes', rows)}
                    columns={CUT_SIZE_COLUMNS}
                    newRow={{ label: '', size: '', action: 'Instant Pricing', type: 'solid' }}
                    itemLabel="cut size"
                    reorder
                />
            </Card>

            <details className="cat-fold">
                <summary><Code size={15} aria-hidden="true" /> Quick look as JSON</summary>
                <div className="cat-fold-body">
                    <RawJsonEditor label="quick_look" value={quickLook} onChange={onChange} hint="For fields the form above does not show." />
                </div>
            </details>
        </>
    );
}
