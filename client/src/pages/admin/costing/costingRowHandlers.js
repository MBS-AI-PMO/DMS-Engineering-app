import { costingService } from '../../../services/admin/costing';

/**
 * Save / delete handlers for one costing collection, in the shape
 * EditableTable expects (each resolves true when it worked).
 *   const handlers = costingRowHandlers({ collection: 'markups', label: 'Markup', ctx });
 *   <EditableTable {...handlers} … />
 * ctx: { reload, toast, confirm } from CostingAdmin. toPayload maps a table
 * row to what the API takes; describe(row) names it in the delete question.
 */
export function costingRowHandlers({ collection, label, ctx, toPayload = (row) => row, describe, unit = 'row' }) {
    const { reload, toast, confirm } = ctx;
    return {
        onSave: async (row, { batch } = {}) => {
            try {
                await costingService.save(collection, toPayload(row));
                if (!batch) {
                    await reload();
                    toast(`${label} saved`, 'success');
                }
                return true;
            } catch (err) {
                toast(err.message, 'error');
                return false;
            }
        },
        onDelete: async (row) => {
            const yes = await confirm({
                title: `Delete ${describe ? describe(row) : `this ${label.toLowerCase()}`}?`,
                message: 'Prices use the change straight away. This cannot be undone.',
                confirmLabel: 'Delete',
                danger: true,
            });
            if (!yes) return false;
            try {
                await costingService.remove(collection, row.id);
                await reload();
                toast(`${label} deleted`, 'success');
                return true;
            } catch (err) {
                toast(err.message, 'error');
                return false;
            }
        },
        onBatchSaved: async (saved, failed) => {
            await reload();
            if (saved) toast(`Saved ${saved} ${saved === 1 ? unit : `${unit}s`}${failed ? `; ${failed} could not be saved` : ''}`, failed ? 'warning' : 'success');
        },
    };
}
