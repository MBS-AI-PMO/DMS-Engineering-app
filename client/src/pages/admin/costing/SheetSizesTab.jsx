import { useState } from 'react';
import { Star } from 'lucide-react';
import { Button, Pill } from '../../../components/admin/ui';
import { costingService } from '../../../services/admin/costing';
import EditableTable from './EditableTable';
import TabIntro from './TabIntro';
import { costingRowHandlers } from './costingRowHandlers';
import { trimNumber } from './costingFormat';

/** Sheet sizes the shop buys; parts are priced on the default one. */
export default function SheetSizesTab(ctx) {
    const { config, reload, toast, confirm, onDirtyChange } = ctx;
    const [making, setMaking] = useState(null);

    const makeDefault = async (row) => {
        const current = config.sheetSizes.find(s => s.is_default);
        const yes = await confirm({
            title: `Price parts on ${row.name}?`,
            message: `Every part is priced on the default sheet: sheet cost ÷ parts that fit on it.${current ? ` ${current.name} stops being the default.` : ''} Prices change straight away.`,
            confirmLabel: 'Make default',
        });
        if (!yes) return;
        setMaking(row.id);
        try {
            await costingService.setDefaultSize(row.id);
            await reload();
            toast(`${row.name} is now the default sheet`, 'success');
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            setMaking(null);
        }
    };

    const columns = [
        { key: 'name', label: 'Name', width: 180 },
        { key: 'length_in', label: 'Length (in)', type: 'number', width: 110 },
        { key: 'width_in', label: 'Width (in)', type: 'number', width: 110 },
        { key: 'is_active', label: 'Active', type: 'switch', width: 80 },
        {
            key: 'is_default',
            label: 'Default',
            width: 140,
            render: (row, set, { dirty }) => {
                if (row.is_default) return <Pill tone="green" dot>Default ★</Pill>;
                if (!row.id) return <span className="ak-hint">Save first</span>;
                const saved = config.sheetSizes.find(s => s.id === row.id);
                return (
                    <Button
                        size="sm"
                        icon={Star}
                        loading={making === row.id}
                        disabled={!saved?.is_active || dirty}
                        title={!saved?.is_active ? 'Switch it on and save first' : dirty ? 'Save your changes first' : undefined}
                        onClick={() => makeDefault(row)}
                    >
                        Make default
                    </Button>
                );
            },
        },
    ];

    return (
        <>
            <TabIntro title="Sheet sizes">
                Sheets the shop buys. Parts are priced on the default sheet: sheet cost ÷ parts that fit on it.
                The default sheet cannot be switched off or deleted.
            </TabIntro>
            <EditableTable
                caption="Sheet sizes"
                unit="sheet size"
                rows={config.sheetSizes.map(s => ({ ...s, length_in: trimNumber(s.length_in), width_in: trimNumber(s.width_in) }))}
                columns={columns}
                {...costingRowHandlers({ collection: 'sheet-sizes', label: 'Sheet size', unit: 'sheet size', ctx, describe: (r) => `the ${r.name} sheet` })}
                onDirtyChange={onDirtyChange}
                newRow={() => ({ name: '', length_in: '', width_in: '', is_active: true, sort_order: config.sheetSizes.length })}
                addLabel="Add sheet size"
            />
        </>
    );
}
