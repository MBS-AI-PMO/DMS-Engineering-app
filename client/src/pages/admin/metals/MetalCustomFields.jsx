import { ListPlus } from 'lucide-react';
import { Card } from '../../../components/admin/ui';
import RowsEditor from '../catalog/RowsEditor';
import { CUSTOM_FIELD_TABS } from './metalForm';

const COLUMNS = [
    { key: 'label', label: 'Label', placeholder: 'e.g. Finish' },
    { key: 'value', label: 'Value', placeholder: 'e.g. Mill finish', width: 'minmax(0, 1.4fr)' },
    { key: 'tab', label: 'Shown under', type: 'select', options: CUSTOM_FIELD_TABS },
];

/** Extra label / value pairs, each placed under one section of the metal page. Stored keyed by id. */
export default function MetalCustomFields({ fields, onChange }) {
    const rows = Object.entries(fields || {}).map(([key, f]) => ({ ...f, _key: key }));
    const save = (next) => onChange(Object.fromEntries(next.map(({ _key, ...f }) => [_key, f])));
    return (
        <Card title="Custom fields" icon={ListPlus} count={rows.length} subtitle="Extra facts for the metal page, e.g. a finish or a standard.">
            <RowsEditor
                rows={rows}
                onChange={save}
                columns={COLUMNS}
                newRow={() => ({ _key: `field_${Date.now()}`, label: '', value: '', tab: 'Quick Look' })}
                itemLabel="custom field"
                emptyText="No custom fields yet."
            />
        </Card>
    );
}
