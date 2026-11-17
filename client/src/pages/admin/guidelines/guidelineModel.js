import { normalizeGuideline } from '../../../utils/guidelineUtils';
import { newKey } from '../content/list';

/*
 * The guidelines editor works on its own shape so columns can be renamed
 * without moving cell values around (rows are keyed by column key, not by
 * header text):
 *
 *   { title, content, requirements: [{ key, text }],
 *     tables: [{ key, material, extra, columns: [{ key, name }], rows: [{ key, cells: { [columnKey]: text } }] }] }
 *
 * fromEditor() turns it back into what POST /api/guidelines/admin stores:
 *   { service_id, title, content, requirements: [text], tables: [{ material, headers, rows: [{ header: text }] }] }
 * Older rows saved with short keys ("t", "minF") are mapped to their headers
 * by normalizeGuideline() on the way in, and saved under the headers.
 */

export const DEFAULT_HEADERS = ['Thickness', 'Min size', 'Max size'];

const cell = (value) => (value === null || value === undefined ? '' : String(value));

export function emptyRow(columns) {
    return { key: newKey('row'), cells: Object.fromEntries(columns.map(c => [c.key, ''])) };
}

export function newTable(material = '') {
    const columns = DEFAULT_HEADERS.map(name => ({ key: newKey('col'), name }));
    return { key: newKey('tbl'), material, extra: {}, columns, rows: [emptyRow(columns)] };
}

/* A copy with fresh keys (for "Duplicate"). */
export function copyTable(table) {
    const keyMap = new Map(table.columns.map(c => [c.key, newKey('col')]));
    return {
        ...table,
        key: newKey('tbl'),
        material: table.material ? `${table.material} (copy)` : '',
        columns: table.columns.map(c => ({ ...c, key: keyMap.get(c.key) })),
        rows: table.rows.map(r => ({ key: newKey('row'), cells: Object.fromEntries(table.columns.map(c => [keyMap.get(c.key), r.cells[c.key] ?? ''])) })),
    };
}

function tableToEditor(table) {
    const { material, headers = [], rows = [], ...extra } = table;
    const columns = headers.map(name => ({ key: newKey('col'), name: cell(name) }));
    return {
        key: newKey('tbl'),
        material: cell(material),
        extra,
        columns,
        rows: rows.map(row => ({ key: newKey('row'), cells: Object.fromEntries(columns.map(c => [c.key, cell(row?.[c.name])])) })),
    };
}

/* raw: the stored guidelines (or null for a service without any yet). */
export function toEditor(raw, fallbackTitle = '') {
    const g = raw ? normalizeGuideline(raw) : null;
    return {
        title: g?.title || fallbackTitle,
        content: g?.content || '',
        requirements: (g?.requirements || []).map(text => ({ key: newKey('req'), text: cell(text) })),
        tables: (g?.tables || []).map(tableToEditor),
    };
}

export function fromEditor(serviceId, editor) {
    return {
        service_id: Number(serviceId),
        title: editor.title.trim(),
        content: editor.content,
        requirements: editor.requirements.map(r => r.text.trim()).filter(Boolean),
        tables: editor.tables.map(t => ({
            ...t.extra,
            material: t.material.trim(),
            headers: t.columns.map(c => c.name.trim()),
            rows: t.rows.map(r => Object.fromEntries(t.columns.map(c => [c.name.trim(), r.cells[c.key] ?? '']))),
        })),
    };
}

/* What must be fixed before saving: [{ message, tableKey? }]. */
export function problems(editor) {
    const found = [];
    if (!editor.title.trim()) found.push({ message: 'Add a title (the service name shown on the page).', field: 'title' });
    editor.tables.forEach((t, i) => {
        const label = t.material.trim() || `Material ${i + 1}`;
        if (!t.material.trim()) found.push({ message: `Material ${i + 1} needs a name.`, tableKey: t.key });
        if (!t.columns.length) found.push({ message: `${label} needs at least one column.`, tableKey: t.key });
        const names = t.columns.map(c => c.name.trim());
        if (names.some(n => !n)) found.push({ message: `${label}: every column needs a heading.`, tableKey: t.key });
        const dupes = names.filter((n, j) => n && names.findIndex(m => m.toLowerCase() === n.toLowerCase()) !== j);
        if (dupes.length) found.push({ message: `${label}: two columns are called “${dupes[0]}”. Give each column its own heading.`, tableKey: t.key });
    });
    return found;
}

/* Tab-separated text copied from a spreadsheet -> rows of cells. */
export function parseClipboard(text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n');
    return lines.map(line => line.split('\t').map(s => s.trim()));
}
