import { useState } from 'react';
import { Copy, Plus, Table as TableIcon, Trash2 } from 'lucide-react';
import { Button, Card, EmptyState, Field, Input, Tabs } from '../../../components/admin/ui';
import { plural } from '../content/format';
import { copyTable, newTable } from './guidelineModel';
import SizeTableGrid from './SizeTableGrid';

/**
 * "Size limits by material": one table per material, picked with tabs (as
 * on the public page). The picked one can be renamed, copied, removed and
 * edited in the grid. selected / onSelect: the key of the open table.
 */
export default function SizeTablesCard({ tables, onChange, selected, onSelect, confirm }) {
    const [fresh, setFresh] = useState(null); // the table just added, to focus its name
    const current = tables.find(t => t.key === selected) || tables[0];

    const update = (table) => onChange(tables.map(t => (t.key === table.key ? table : t)));
    const add = () => {
        const table = newTable();
        onChange([...tables, table]);
        onSelect(table.key);
        setFresh(table.key);
    };
    const duplicate = () => {
        const table = copyTable(current);
        const at = tables.indexOf(current) + 1;
        onChange([...tables.slice(0, at), table, ...tables.slice(at)]);
        onSelect(table.key);
    };
    const remove = async () => {
        const name = current.material.trim() || 'this material';
        const yes = await confirm({
            title: `Remove ${name}?`,
            message: `Its table (${plural(current.rows.length, 'row')}) is removed when you save. Discard changes to get it back before then.`,
            confirmLabel: 'Remove material',
            danger: true,
        });
        if (!yes) return;
        const at = tables.indexOf(current);
        const next = tables.filter(t => t.key !== current.key);
        onChange(next);
        onSelect(next[Math.min(at, next.length - 1)]?.key || null);
    };
    const confirmRemoveColumn = (column) => confirm({
        title: `Remove the “${column.name || 'untitled'}” column?`,
        message: 'Its values in every row go with it.',
        confirmLabel: 'Remove column',
        danger: true,
    });

    return (
        <Card
            title="Size limits by material"
            subtitle="One table per material. Customers pick the material with tabs on the guidelines page."
            icon={TableIcon}
            count={tables.length || undefined}
            actions={<Button size="sm" variant="primary" icon={Plus} onClick={add}>Add material</Button>}
        >
            {!current ? (
                <EmptyState icon={TableIcon} title="No size tables yet" action={<Button icon={Plus} onClick={add}>Add a material</Button>}>
                    Add a material to list its thicknesses and the smallest and largest part sizes.
                </EmptyState>
            ) : (
                <div className="ak-stack is-tight">
                    {tables.length > 1 && (
                        <Tabs
                            label="Materials"
                            value={current.key}
                            onChange={onSelect}
                            items={tables.map((t, i) => ({ value: t.key, label: t.material.trim() || `Material ${i + 1}`, count: t.rows.length }))}
                        />
                    )}
                    <div className="ac-gd-table-head">
                        <Field label="Material" className="ac-gd-material">
                            <Input
                                value={current.material}
                                onChange={e => update({ ...current, material: e.target.value })}
                                placeholder="e.g. 5052 aluminum"
                                maxLength={200}
                                autoFocus={fresh === current.key}
                                invalid={!current.material.trim()}
                            />
                        </Field>
                        <div className="ak-row-actions">
                            <Button size="sm" icon={Copy} onClick={duplicate}>Duplicate</Button>
                            <Button size="sm" variant="danger" icon={Trash2} onClick={remove}>Remove</Button>
                        </div>
                    </div>
                    <SizeTableGrid table={current} onChange={update} confirmRemoveColumn={confirmRemoveColumn} />
                </div>
            )}
        </Card>
    );
}
