import { useCallback, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, Card, CellText, DataTable, EmptyState, IconButton, RowActions } from '../../../../components/admin/ui';

/**
 * A service_options list shown as a table with add / edit / remove in a
 * dialog (taps, countersink profiles). Changes are saved with the service.
 * columns: DataTable columns for the data; Dialog: ({ option, onSave, onClose }).
 */
export default function OptionsTableCard(props) {
    const { title, icon, subtitle, itemLabel, options, onChange, columns, Dialog, emptyText } = props;
    const [editing, setEditing] = useState(null); // null | 'new' | index
    const close = useCallback(() => setEditing(null), []);
    const save = (option) => {
        onChange(editing === 'new' ? [...options, option] : options.map((o, i) => (i === editing ? option : o)));
        setEditing(null);
    };
    const rows = options.map((o, index) => ({ ...o, _index: index }));

    const allColumns = [
        { key: 'name', header: 'Name', render: (o) => <CellText main={o.name || 'Unnamed'} sub={o.notes || undefined} /> },
        ...columns,
        {
            key: 'actions', actions: true,
            render: (o) => (
                <RowActions>
                    <IconButton icon={Pencil} label={`Edit ${o.name}`} onClick={() => setEditing(o._index)} />
                    <IconButton icon={Trash2} variant="danger" label={`Remove ${o.name}`} onClick={() => onChange(options.filter((_, i) => i !== o._index))} />
                </RowActions>
            ),
        },
    ];

    return (
        <Card
            title={title}
            icon={icon}
            count={options.length}
            subtitle={subtitle}
            actions={<Button size="sm" variant="dark" icon={Plus} onClick={() => setEditing('new')}>Add {itemLabel}</Button>}
        >
            <DataTable
                caption={title}
                columns={allColumns}
                rows={rows}
                rowKey="_index"
                onRowClick={(o) => setEditing(o._index)}
                empty={<EmptyState icon={icon} title={`No ${itemLabel}s yet`} action={<Button size="sm" icon={Plus} onClick={() => setEditing('new')}>Add {itemLabel}</Button>}>{emptyText}</EmptyState>}
            />
            {editing !== null && <Dialog option={editing === 'new' ? null : options[editing]} onSave={save} onClose={close} />}
        </Card>
    );
}
