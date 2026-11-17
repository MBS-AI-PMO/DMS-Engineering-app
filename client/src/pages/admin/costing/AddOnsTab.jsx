import EditableTable from './EditableTable';
import TabIntro from './TabIntro';
import { costingRowHandlers } from './costingRowHandlers';
import { trimNumber } from './costingFormat';

const MODES = [{ value: 'always', label: 'Always' }, { value: 'optional', label: 'Optional (off)' }];

/** Flat fees added to every line of a production method. */
export default function AddOnsTab(ctx) {
    const { config, onDirtyChange } = ctx;
    const columns = [
        { key: 'name', label: 'Name', width: 200 },
        { key: 'amount', label: 'Amount ($)', type: 'number', width: 110 },
        { key: 'apply_mode', label: 'Charge', type: 'select', options: MODES, width: 150 },
        { key: 'sort_order', label: 'Order', type: 'number', width: 80 },
        { key: 'is_active', label: 'Active', type: 'switch', width: 80 },
    ];

    return (
        <>
            <TabIntro title="Add-ons">
                A flat fee added to every line of a production method after markups. Only &quot;Always&quot; add-ons are
                charged on the website; link them on the Services tab.
            </TabIntro>
            <EditableTable
                caption="Add-ons"
                unit="add-on"
                rows={config.addOns.map(a => ({ ...a, amount: trimNumber(a.amount) }))}
                columns={columns}
                {...costingRowHandlers({ collection: 'add-ons', label: 'Add-on', unit: 'add-on', ctx, describe: (r) => `"${r.name}"` })}
                onDirtyChange={onDirtyChange}
                newRow={() => ({ name: '', amount: '', apply_mode: 'always', sort_order: config.addOns.length, is_active: true })}
                addLabel="Add add-on"
            />
        </>
    );
}
