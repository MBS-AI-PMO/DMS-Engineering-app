/*
 * Saves a list as a .csv file the browser downloads (opens in Excel / Sheets).
 *
 *   downloadCsv('customers.csv', [{ header: 'Email', value: c => c.email }, …], rows);
 *
 * Cells that start with = + - @ are prefixed with ' so a spreadsheet does
 * not run them as formulas.
 */
const cell = (value) => {
    let s = value === undefined || value === null ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(columns, rows) {
    const lines = [columns.map(c => cell(c.header))];
    rows.forEach(row => lines.push(columns.map(c => cell(c.value(row)))));
    return lines.map(l => l.join(',')).join('\r\n');
}

export function downloadCsv(filename, columns, rows) {
    // The byte-order mark makes Excel read the file as UTF-8.
    const blob = new Blob(['﻿', toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** "customers-2026-11-17.csv" */
export const datedName = (base) => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${base}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.csv`;
};
