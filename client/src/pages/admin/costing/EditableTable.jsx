import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Save, Trash2, Undo2 } from 'lucide-react';
import { Button, FormActions, IconButton, Input, Select, Switch } from '../../../components/admin/ui';

const cx = (...parts) => parts.filter(Boolean).join(' ');
const same = (a, b) => String(a ?? '') === String(b ?? '');

/**
 * A table edited in place, built from kit parts (kit table styles, Input,
 * Select, Switch, Button). Change cells, then save a row, or "Save all"
 * from the bar that appears while anything is unsaved. Edits to other rows
 * survive a save (the parent reloads; unsaved edits are kept on top).
 *
 * columns: [{ key, label, type: 'text' | 'number' | 'select' | 'switch' | 'readonly',
 *             options: [{ value, label }], width (min width), placeholder (text or fn(row)),
 *             list (datalist id),
 *             render(row, set, { dirty }) for a custom cell,
 *             inputClass(row) extra class for the input (e.g. highlight) }]
 * rows: saved rows (each with an id). newRow(): a blank row for "Add".
 * onSave(row, { batch }) -> Promise<boolean>: true when saved. With batch the
 *   parent should not reload; onBatchSaved(count) runs once after "Save all".
 * onDelete(row) -> Promise<boolean>. rowTone(row): 'warn' tints the row.
 * onDirtyChange(count) tells the parent how many rows are unsaved.
 * isVisible(savedRow): a filter; rows with unsaved edits always stay shown.
 * stickyFirst keeps the first column in view when a wide table scrolls sideways.
 */
export default function EditableTable({
    columns, rows, onSave, onDelete, onBatchSaved, newRow, addLabel = 'Add row', emptyText = 'Nothing here yet.',
    rowTone, onDirtyChange, caption, unit = 'row', isVisible, filteredText = 'No rows match.', stickyFirst = false,
}) {
    const [edits, setEdits] = useState({});      // saved row id -> changed fields
    const [added, setAdded] = useState([]);      // new rows, each with a _key
    const [busy, setBusy] = useState(null);      // row key | 'all'
    const nextKey = useRef(1);

    const savedById = useMemo(() => Object.fromEntries(rows.map(r => [r.id, r])), [rows]);
    const keyOf = (row) => row._key || row.id;

    // Edits for rows that no longer exist (deleted elsewhere) are dropped.
    const liveEdits = useMemo(() => Object.fromEntries(Object.entries(edits).filter(([id]) => savedById[id])), [edits, savedById]);

    const isDirty = (row) => {
        if (row._key) return true;
        const changes = liveEdits[row.id];
        return Boolean(changes) && Object.entries(changes).some(([k, v]) => !same(v, savedById[row.id]?.[k]));
    };

    const current = [...rows.map(r => (liveEdits[r.id] ? { ...r, ...liveEdits[r.id] } : r)), ...added];
    const dirtyRows = current.filter(isDirty);
    const dirtyCount = dirtyRows.length;
    // A filter looks at the saved row, so a row being edited never vanishes mid-edit.
    const shown = isVisible ? current.filter(r => r._key || isDirty(r) || isVisible(savedById[r.id])) : current;
    const hiddenCount = current.length - shown.length;

    useEffect(() => { onDirtyChange?.(dirtyCount); }, [dirtyCount, onDirtyChange]);
    useEffect(() => () => onDirtyChange?.(0), [onDirtyChange]);
    useEffect(() => {
        if (!dirtyCount) return undefined;
        const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirtyCount]);

    const setField = (row) => (key, value) => {
        if (row._key) setAdded(list => list.map(r => (r._key === row._key ? { ...r, [key]: value } : r)));
        else setEdits(all => ({ ...all, [row.id]: { ...all[row.id], [key]: value } }));
    };
    const clear = (list) => {
        const ids = new Set(list.filter(r => !r._key).map(r => String(r.id)));
        const keys = new Set(list.filter(r => r._key).map(r => r._key));
        setEdits(all => Object.fromEntries(Object.entries(all).filter(([id]) => !ids.has(String(id)))));
        setAdded(all => all.filter(r => !keys.has(r._key)));
    };
    const strip = (row) => { const { _key, ...rest } = row; return rest; };

    const save = async (row) => {
        setBusy(keyOf(row));
        try { if (await onSave(strip(row), { batch: false })) clear([row]); } finally { setBusy(null); }
    };
    const saveAll = async () => {
        setBusy('all');
        const done = [];
        try {
            for (const row of dirtyRows) if (await onSave(strip(row), { batch: true })) done.push(row);
            await onBatchSaved?.(done.length, dirtyRows.length - done.length);
            clear(done);
        } finally { setBusy(null); }
    };
    const remove = async (row) => {
        if (row._key) { clear([row]); return; }
        setBusy(keyOf(row));
        try { if (await onDelete(row)) clear([row]); } finally { setBusy(null); }
    };
    const add = () => setAdded(list => [...list, { ...newRow(), _key: `new-${nextKey.current++}` }]);

    const cell = (column, row, dirty) => {
        const set = setField(row);
        if (column.render) return column.render(row, set, { dirty });
        const value = row[column.key];
        const common = { 'aria-label': column.label, disabled: busy === 'all', className: column.inputClass?.(row) };
        if (column.type === 'readonly') return <span className="ak-cell-main">{value ?? '—'}</span>;
        if (column.type === 'switch') {
            return <Switch checked={Boolean(value)} onChange={v => set(column.key, v)} label={<span className="ak-sr">{column.label}</span>} disabled={busy === 'all'} />;
        }
        if (column.type === 'select') {
            return <Select size="sm" value={value ?? ''} options={column.options} onChange={e => set(column.key, e.target.value)} {...common} />;
        }
        return (
            <Input
                size="sm"
                type={column.type === 'number' ? 'number' : 'text'}
                inputMode={column.type === 'number' ? 'decimal' : undefined}
                step={column.type === 'number' ? 'any' : undefined}
                list={column.list}
                value={value ?? ''}
                placeholder={typeof column.placeholder === 'function' ? column.placeholder(row) : column.placeholder}
                onChange={e => set(column.key, e.target.value)}
                {...common}
            />
        );
    };

    return (
        <>
            <div className="ak-table-card ck-edit-card">
                <table className={cx('ak-table is-stackable ck-edit-table', stickyFirst && 'is-sticky-first')}>
                    {caption && <caption className="ak-sr">{caption}</caption>}
                    <thead>
                        <tr>
                            {columns.map(c => <th key={c.key} scope="col" style={c.width ? { minWidth: c.width } : undefined}>{c.label}</th>)}
                            <th scope="col" className="is-actions ck-actions"><span className="ak-sr">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {shown.length === 0 && (
                            <tr><td colSpan={columns.length + 1} className="ck-empty">{hiddenCount ? filteredText : emptyText}</td></tr>
                        )}
                        {shown.map(row => {
                            const dirty = isDirty(row);
                            const rowBusy = busy === keyOf(row) || busy === 'all';
                            const tone = rowTone?.(row);
                            return (
                                <tr key={keyOf(row)} className={cx(dirty && 'is-dirty', tone && `is-${tone}`)}>
                                    {columns.map(c => <td key={c.key} data-label={c.label}>{cell(c, row, dirty)}</td>)}
                                    <td className="is-actions ck-actions">
                                        <div className="ak-row-actions">
                                            {dirty && (
                                                <Button size="sm" variant="primary" icon={Save} loading={busy === keyOf(row)} disabled={rowBusy} onClick={() => save(row)}>
                                                    {row._key ? 'Add' : 'Save'}
                                                </Button>
                                            )}
                                            {(onDelete || row._key) && (
                                                <IconButton
                                                    icon={row._key ? Undo2 : Trash2}
                                                    label={row._key ? 'Remove this new row' : `Delete this ${unit}`}
                                                    variant="danger"
                                                    disabled={rowBusy}
                                                    onClick={() => remove(row)}
                                                />
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {newRow && (
                    <div className="ck-table-foot">
                        <Button size="sm" icon={Plus} onClick={add} disabled={busy === 'all'}>{addLabel}</Button>
                    </div>
                )}
            </div>
            {dirtyCount > 0 && (
                <FormActions sticky>
                    <span className="ck-unsaved">{dirtyCount} unsaved {dirtyCount === 1 ? unit : `${unit}s`}</span>
                    <Button icon={Undo2} onClick={() => { setEdits({}); setAdded([]); }} disabled={busy === 'all'}>Discard</Button>
                    <Button variant="primary" icon={Save} loading={busy === 'all'} onClick={saveAll}>
                        {dirtyCount === 1 ? 'Save' : `Save all ${dirtyCount}`}
                    </Button>
                </FormActions>
            )}
        </>
    );
}
