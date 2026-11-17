import EditableTable from './EditableTable';
import TabIntro from './TabIntro';
import { costingRowHandlers } from './costingRowHandlers';
import { MARKUP_BASES, trimNumber } from './costingFormat';

const CALC_TYPES = [{ value: 'markup', label: 'Markup' }, { value: 'margin', label: 'Margin' }];

/** Markups and margins, each worked out on cost before markups. */
export default function MarkupsTab(ctx) {
    const { config, onDirtyChange } = ctx;
    const columns = [
        { key: 'name', label: 'Name', width: 200 },
        { key: 'calc_type', label: 'Type', type: 'select', options: CALC_TYPES, width: 110 },
        { key: 'base', label: 'Applies to', type: 'select', options: MARKUP_BASES, width: 190 },
        { key: 'percent', label: 'Percent', type: 'number', width: 100 },
        { key: 'sort_order', label: 'Order', type: 'number', width: 80 },
        { key: 'is_active', label: 'Active', type: 'switch', width: 80 },
    ];

    return (
        <>
            <TabIntro title="Markups">
                Markups don&apos;t stack: each is worked out on cost before markups. Material, labor, outside and purchased
                markups apply to their own costs; overhead and general apply to all cost. A margin can be at most 99.9%.
                Link them to a production method on the Services tab.
            </TabIntro>
            <EditableTable
                caption="Markups"
                unit="markup"
                rows={config.markups.map(m => ({ ...m, percent: trimNumber(m.percent) }))}
                columns={columns}
                {...costingRowHandlers({ collection: 'markups', label: 'Markup', unit: 'markup', ctx, describe: (r) => `"${r.name}"` })}
                onDirtyChange={onDirtyChange}
                newRow={() => ({ name: '', calc_type: 'markup', base: 'general', percent: '', sort_order: config.markups.length, is_active: true })}
                addLabel="Add markup"
            />
        </>
    );
}
