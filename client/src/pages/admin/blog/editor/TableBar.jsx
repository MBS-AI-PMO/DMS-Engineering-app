import { useEditorState } from '@tiptap/react';
import {
    BetweenHorizontalEnd, BetweenHorizontalStart, BetweenVerticalEnd, BetweenVerticalStart, Columns3, PanelTop, Rows3,
    TableCellsMerge, TableCellsSplit, Trash2,
} from 'lucide-react';

/** The table row of the toolbar, shown while the cursor is in a table. */
export default function TableBar({ editor }) {
    const can = useEditorState({
        editor,
        selector: ({ editor: e }) => ({
            merge: e.can().mergeCells(),
            split: e.can().splitCell(),
            deleteRow: e.can().deleteRow(),
            deleteColumn: e.can().deleteColumn(),
        }),
    });
    const run = (fn) => () => fn(editor.chain().focus()).run();
    const item = (Icon, label, onClick, { disabled = false, danger = false } = {}) => (
        <button type="button" className={`be-chip${danger ? ' is-danger' : ''}`} onMouseDown={e => e.preventDefault()} onClick={onClick} disabled={disabled} title={label}>
            <Icon size={14} aria-hidden="true" /> <span>{label}</span>
        </button>
    );
    return (
        <div className="be-tablebar" role="toolbar" aria-label="Table">
            <span className="be-tablebar-label">Table</span>
            {item(BetweenHorizontalStart, 'Row above', run(c => c.addRowBefore()))}
            {item(BetweenHorizontalEnd, 'Row below', run(c => c.addRowAfter()))}
            {item(BetweenVerticalStart, 'Column left', run(c => c.addColumnBefore()))}
            {item(BetweenVerticalEnd, 'Column right', run(c => c.addColumnAfter()))}
            {item(PanelTop, 'Header row', run(c => c.toggleHeaderRow()))}
            {item(TableCellsMerge, 'Merge', run(c => c.mergeCells()), { disabled: !can.merge })}
            {item(TableCellsSplit, 'Split', run(c => c.splitCell()), { disabled: !can.split })}
            {item(Rows3, 'Delete row', run(c => c.deleteRow()), { disabled: !can.deleteRow, danger: true })}
            {item(Columns3, 'Delete column', run(c => c.deleteColumn()), { disabled: !can.deleteColumn, danger: true })}
            {item(Trash2, 'Delete table', run(c => c.deleteTable()), { danger: true })}
        </div>
    );
}
