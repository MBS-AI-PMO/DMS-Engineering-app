import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button, IconButton, Input, Select, Textarea } from '../../../components/admin/ui';

/**
 * An editable list of rows: thicknesses, cut sizes, spec rows, FAQs…
 * (candidate for the admin kit).
 *
 * columns: [{ key, label, placeholder?, type?: 'text' | 'number' | 'select' | 'textarea',
 *             options? (for select), width? (CSS grid width, default 1fr), step? }]
 * rows: objects keyed by column key; with `scalar`, plain strings edited by the one column.
 * newRow: the object (or string) a new row starts with.
 * itemLabel: what one row is ("thickness"), for button labels.
 * reorder: show move up / down buttons.
 * Rows stack into small cards on phones, each field labelled.
 */
export default function RowsEditor({
    rows = [], onChange, columns, newRow, itemLabel = 'row', addLabel, emptyText, reorder = false, scalar = false, footer,
}) {
    const template = `${columns.map(c => c.width || 'minmax(0, 1fr)').join(' ')} auto`;
    const valueOf = (row, c) => (scalar ? row : row?.[c.key]) ?? '';

    const update = (index, key, value) => onChange(rows.map((row, i) => {
        if (i !== index) return row;
        return scalar ? value : { ...row, [key]: value };
    }));
    const remove = (index) => onChange(rows.filter((_, i) => i !== index));
    const move = (index, by) => {
        const next = [...rows];
        const [row] = next.splice(index, 1);
        next.splice(index + by, 0, row);
        onChange(next);
    };
    const add = () => onChange([...rows, typeof newRow === 'function' ? newRow() : (scalar ? (newRow ?? '') : { ...newRow })]);

    const control = (row, c, index) => {
        const common = {
            value: valueOf(row, c),
            placeholder: c.placeholder,
            onChange: (e) => update(index, c.key, c.parse ? c.parse(e.target.value) : e.target.value),
        };
        if (c.type === 'select') return <Select size="sm" options={c.options} {...common} />;
        if (c.type === 'textarea') return <Textarea rows={c.rows || 3} {...common} />;
        return <Input size="sm" type={c.type === 'number' ? 'number' : 'text'} step={c.step} {...common} />;
    };

    return (
        <div className="cat-rows">
            {rows.length > 0 ? (
                <>
                    <div className="cat-rows-head" style={{ gridTemplateColumns: template }} aria-hidden="true">
                        {columns.map(c => <span key={c.key || 'value'}>{c.label}</span>)}
                        <span />
                    </div>
                    {rows.map((row, index) => (
                        <div key={index} className="cat-rows-row" style={{ gridTemplateColumns: template }}>
                            {columns.map(c => (
                                <label key={c.key || 'value'} className="cat-rows-cell">
                                    <span className="cat-rows-label">{c.label}</span>
                                    {control(row, c, index)}
                                </label>
                            ))}
                            <div className="cat-rows-tools">
                                {reorder && (
                                    <>
                                        <IconButton icon={ArrowUp} size="xs" label={`Move ${itemLabel} ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)} />
                                        <IconButton icon={ArrowDown} size="xs" label={`Move ${itemLabel} ${index + 1} down`} disabled={index === rows.length - 1} onClick={() => move(index, 1)} />
                                    </>
                                )}
                                <IconButton icon={Trash2} size="xs" variant="danger" label={`Remove ${itemLabel} ${index + 1}`} onClick={() => remove(index)} />
                            </div>
                        </div>
                    ))}
                </>
            ) : (
                emptyText !== null && <p className="cat-rows-empty">{emptyText || `No ${itemLabel}s yet.`}</p>
            )}
            <div className="cat-rows-foot">
                <Button size="sm" icon={Plus} onClick={add}>{addLabel || `Add ${itemLabel}`}</Button>
                {footer}
            </div>
        </div>
    );
}
