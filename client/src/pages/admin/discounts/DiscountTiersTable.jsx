import { Hash, Pencil, Percent, Plus, ToggleRight, Trash2 } from 'lucide-react';
import { Button, CellText, DataTable, EmptyState, IconButton, Pill, RowActions } from '../../../components/admin/ui';
import { rangeLabel, toRanges } from './discountFormat';

const MAX_CHIPS = 24;

/** Ranges ("12–19", "832+") or, in the "each" view, every quantity (capped). */
function Quantities({ tier, view, top }) {
    const list = (tier.quantities || []).map(Number).sort((a, b) => a - b);
    if (!list.length) return <span className="ak-hint">No quantities</span>;
    if (view === 'ranges') {
        return (
            <CellText
                main={toRanges(list).map(r => rangeLabel(r, top)).join(', ')}
                sub={`${list.length} ${list.length === 1 ? 'quantity' : 'quantities'}`}
            />
        );
    }
    return (
        <span className="dc-chips">
            {list.slice(0, MAX_CHIPS).map(q => <span key={q} className="dc-chip">{q}</span>)}
            {list.length > MAX_CHIPS && <span className="ak-hint">+{list.length - MAX_CHIPS} more</span>}
        </span>
    );
}

/** The tiers as a table; a row opens the editor. */
export default function DiscountTiersTable({ tiers, loading, view, top, applied, onEdit, onDelete, onAdd, busyId }) {
    const columns = [
        { key: 'quantities', header: 'Quantities', icon: Hash, render: (t) => <Quantities tier={t} view={view} top={top} /> },
        {
            key: 'percent',
            header: 'Discount',
            icon: Percent,
            align: 'right',
            width: '130px',
            render: (t) => <span className={applied && t.is_active ? 'dc-percent' : 'dc-percent is-idle'}>{Number(t.discount_percent)}% off</span>,
        },
        {
            key: 'status',
            header: 'Status',
            icon: ToggleRight,
            width: '150px',
            render: (t) => (!t.is_active
                ? <Pill tone="gray">Inactive</Pill>
                : applied ? <Pill tone="green" dot>Applied</Pill> : <Pill tone="amber" dot title="Quantity discounts are off on the website">Active, not applied</Pill>),
        },
        {
            key: 'actions',
            header: 'Actions',
            actions: true,
            render: (t) => (
                <RowActions>
                    <IconButton icon={Pencil} label={`Edit the ${Number(t.discount_percent)}% tier`} onClick={() => onEdit(t)} />
                    <IconButton icon={Trash2} label={`Delete the ${Number(t.discount_percent)}% tier`} variant="danger" loading={busyId === t.id} onClick={() => onDelete(t)} />
                </RowActions>
            ),
        },
    ];

    return (
        <DataTable
            caption="Discount tiers"
            columns={columns}
            rows={tiers}
            loading={loading}
            onRowClick={onEdit}
            empty={(
                <EmptyState
                    icon={Percent}
                    title="No discount tiers yet"
                    action={<Button variant="primary" icon={Plus} onClick={onAdd}>Add tier</Button>}
                >
                    A tier takes a percentage off when a line&apos;s quantity is one of its quantities.
                </EmptyState>
            )}
        />
    );
}
