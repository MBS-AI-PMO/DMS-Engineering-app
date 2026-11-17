/*
 * Sheet costs as CSV: one row per family/thickness band, one price column
 * per sheet size (named after the size). Export writes what is saved;
 * import reads a file back into rows the API takes.
 */

// A small CSV reader: quoted cells, commas and line breaks inside quotes.
export function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i += 1;
            row.push(cell); rows.push(row); row = []; cell = '';
        } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim() !== ''));
}

const csvCell = (v) => (v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

/* The saved rows as CSV text. */
export function sheetCostsToCsv(sheetCosts, sheetSizes) {
    const header = ['family', 'metal', 'ga', 'min_thick', 'max_thick', 'thickness_in', ...sheetSizes.map(s => s.name)];
    const lines = sheetCosts.map(r => [
        r.family, r.metal_name || '', r.ga || '', r.min_thick ?? '', r.max_thick ?? '', r.thickness_in ?? '',
        ...sheetSizes.map(s => r.prices?.[s.id] ?? ''),
    ]);
    return `${[header, ...lines].map(l => l.map(csvCell).join(',')).join('\n')}\n`;
}

/* Offers text as a file download. */
export function downloadText(text, filename, type = 'text/csv') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/* CSV text -> rows for the import API. Throws an Error that says what to fix. */
export function sheetCostsFromCsv(text, { sheetSizes, metals }) {
    const table = parseCsv(text);
    if (table.length < 2) throw new Error('The file has no rows.');
    const header = table[0].map(h => h.trim().toLowerCase());
    const col = (name) => header.indexOf(name);
    if (col('family') < 0) throw new Error('The first row must include a "family" column.');
    const sizeCols = sheetSizes.map(s => ({ id: s.id, index: header.indexOf(s.name.trim().toLowerCase()) })).filter(s => s.index >= 0);
    if (!sizeCols.length) throw new Error(`Add a price column named after a sheet size, e.g. "${sheetSizes[0]?.name}".`);
    const metalByName = Object.fromEntries(metals.map(m => [m.name.trim().toLowerCase(), m.id]));
    return table.slice(1).map((cells, i) => {
        const get = (name) => (col(name) >= 0 ? (cells[col(name)] || '').trim() : '');
        const metalName = get('metal').toLowerCase();
        if (metalName && !metalByName[metalName]) throw new Error(`Row ${i + 2}: no metal called "${get('metal')}".`);
        return {
            family: get('family'),
            metal_id: metalName ? metalByName[metalName] : null,
            ga: get('ga'),
            min_thick: get('min_thick'),
            max_thick: get('max_thick'),
            thickness_in: get('thickness_in'),
            prices: Object.fromEntries(sizeCols.map(s => [s.id, (cells[s.index] || '').trim() === '' ? null : cells[s.index].trim()])),
        };
    });
}
