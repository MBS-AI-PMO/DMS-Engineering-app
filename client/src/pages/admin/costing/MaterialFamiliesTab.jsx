import { costingService } from '../../../services/admin/costing';
import EditableTable from './EditableTable';
import TabIntro from './TabIntro';

/** Which family each metal is priced from in Sheet costs and Laser rates. */
export default function MaterialFamiliesTab({ config, reload, toast, onDirtyChange }) {
    const rows = config.metals.map(m => ({ ...m, costing_family: m.costing_family || '' }));
    const families = [...new Set(config.sheetCosts.map(r => r.family).filter(Boolean))].sort();

    const columns = [
        { key: 'name', label: 'Metal', type: 'readonly', width: 200 },
        { key: 'category', label: 'Category', render: (row) => row.category || '—', width: 160 },
        {
            key: 'costing_family',
            label: 'Priced as family',
            width: 220,
            list: 'ck-material-families',
            placeholder: (row) => (row.category ? `${row.category} (its category)` : 'Its category'),
        },
    ];

    const save = async (row, { batch } = {}) => {
        try {
            await costingService.setMetalFamily(row.id, row.costing_family);
            if (!batch) {
                await reload();
                toast(`${row.name} saved`, 'success');
            }
            return true;
        } catch (err) {
            toast(err.message, 'error');
            return false;
        }
    };

    return (
        <>
            <TabIntro title="Material families">
                The family a metal is priced from in Sheet costs and Laser rates. Leave it blank to use the metal&apos;s category.
            </TabIntro>
            <datalist id="ck-material-families">{families.map(f => <option key={f} value={f} />)}</datalist>
            <EditableTable
                caption="Material families"
                unit="metal"
                rows={rows}
                columns={columns}
                onSave={save}
                onBatchSaved={async (saved) => { await reload(); if (saved) toast(`Saved ${saved} ${saved === 1 ? 'metal' : 'metals'}`, 'success'); }}
                onDirtyChange={onDirtyChange}
                emptyText="No metals in the catalog yet."
            />
        </>
    );
}
