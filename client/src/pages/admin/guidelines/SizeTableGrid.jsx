import { Plus, Trash2, X } from 'lucide-react';
import { Button, IconButton } from '../../../components/admin/ui';
import { newKey } from '../content/list';
import { emptyRow, parseClipboard } from './guidelineModel';

/**
 * One material's size table as an editable grid: column headings on top,
 * one input per cell, remove buttons per row and column. Cells copied from
 * a spreadsheet can be pasted into any cell; rows and columns are added
 * when the pasted block needs them.
 *
 * table: { columns: [{ key, name }], rows: [{ key, cells }] }. onChange(table).
 * confirmRemoveColumn(column) resolves true to go ahead (asked only when the column has values).
 */
export default function SizeTableGrid({ table, onChange, confirmRemoveColumn }) {
    const { columns, rows } = table;
    const set = (patch) => onChange({ ...table, ...patch });

    const renameColumn = (key, name) => set({ columns: columns.map(c => (c.key === key ? { ...c, name } : c)) });
    const addColumn = () => {
        const column = { key: newKey('col'), name: `Column ${columns.length + 1}` };
        set({ columns: [...columns, column], rows: rows.map(r => ({ ...r, cells: { ...r.cells, [column.key]: '' } })) });
    };
    const removeColumn = async (column) => {
        const used = rows.some(r => String(r.cells[column.key] || '').trim());
        if (used && !(await confirmRemoveColumn(column))) return;
        set({
            columns: columns.filter(c => c.key !== column.key),
            rows: rows.map(r => { const cells = { ...r.cells }; delete cells[column.key]; return { ...r, cells }; }),
        });
    };
    const setCell = (rowKey, colKey, value) => set({ rows: rows.map(r => (r.key === rowKey ? { ...r, cells: { ...r.cells, [colKey]: value } } : r)) });
    const addRow = () => set({ rows: [...rows, emptyRow(columns)] });
    const removeRow = (rowKey) => set({ rows: rows.filter(r => r.key !== rowKey) });

    const paste = (e, rowIndex, colIndex) => {
        const text = e.clipboardData?.getData('text/plain') || '';
        if (!/[\t\n]/.test(text.replace(/\n+$/, ''))) return; // one value: normal paste
        e.preventDefault();
        const block = parseClipboard(text);
        const width = Math.max(...block.map(line => line.length));
        const nextColumns = [...columns];
        while (nextColumns.length < colIndex + width) nextColumns.push({ key: newKey('col'), name: `Column ${nextColumns.length + 1}` });
        const nextRows = rows.map(r => ({ ...r, cells: { ...r.cells } }));
        while (nextRows.length < rowIndex + block.length) nextRows.push(emptyRow(nextColumns));
        block.forEach((line, r) => line.forEach((value, c) => { nextRows[rowIndex + r].cells[nextColumns[colIndex + c].key] = value; }));
        set({ columns: nextColumns, rows: nextRows });
    };

    return (
        <div className="ac-gd-grid-block">
            <div className="ac-gd-grid-wrap">
                <table className="ac-gd-grid">
                    <thead>
                        <tr>
                            <th scope="col" className="ac-gd-rownum"><span className="ak-sr">Row</span></th>
                            {columns.map((c, ci) => (
                                <th key={c.key} scope="col">
                                    <span className="ac-gd-colhead">
                                        <input
                                            className="ac-gd-head-input"
                                            value={c.name}
                                            onChange={e => renameColumn(c.key, e.target.value)}
                                            aria-label={`Column ${ci + 1} heading`}
                                            placeholder="Heading"
                                            maxLength={200}
                                        />
                                        <IconButton icon={X} size="xs" label={`Remove column ${c.name || ci + 1}`} onClick={() => removeColumn(c)} />
                                    </span>
                                </th>
                            ))}
                            <th scope="col" className="ac-gd-tools"><span className="ak-sr">Row actions</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r, ri) => (
                            <tr key={r.key}>
                                <td className="ac-gd-rownum">{ri + 1}</td>
                                {columns.map((c, ci) => (
                                    <td key={c.key}>
                                        <input
                                            className="ac-gd-cell"
                                            value={r.cells[c.key] ?? ''}
                                            onChange={e => setCell(r.key, c.key, e.target.value)}
                                            onPaste={e => paste(e, ri, ci)}
                                            aria-label={`${c.name || `Column ${ci + 1}`}, row ${ri + 1}`}
                                            maxLength={500}
                                        />
                                    </td>
                                ))}
                                <td className="ac-gd-tools">
                                    <IconButton icon={Trash2} size="xs" variant="danger" label={`Remove row ${ri + 1}`} onClick={() => removeRow(r.key)} />
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr><td className="ac-gd-norows" colSpan={columns.length + 2}>No rows yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="ac-gd-grid-actions">
                <Button size="sm" icon={Plus} onClick={addRow}>Add row</Button>
                <Button size="sm" icon={Plus} onClick={addColumn}>Add column</Button>
                <span className="ak-hint">Tip: copy cells from a spreadsheet and paste them into any cell.</span>
            </div>
        </div>
    );
}
