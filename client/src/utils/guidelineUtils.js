/**
 * Normalizes guideline data to ensure consistency between stored JSONB and UI expectations.
 * Infers headers if missing and ensures arrays exist.
 */
export const normalizeGuideline = (data) => {
    if (!data) return null;

    const requirements = Array.isArray(data.requirements) ? data.requirements : [];

    const tables = (data.tables || []).map(table => {
        let headers = Array.isArray(table.headers) ? [...table.headers] : [];
        const rows = Array.isArray(table.rows) ? table.rows : [];

        // Infer headers if missing but rows exist
        if (headers.length === 0 && rows.length > 0) {
            headers = Object.keys(rows[0]);
        }

        // Standard fallback for completely empty tables
        if (headers.length === 0) {
            headers = ['Thickness', 'Min size', 'Max size'];
        }

        // --- Data Mapping Fix ---
        // Ensure every row has the same keys as the headers
        const normalizedRows = rows.map(row => {
            if (typeof row !== 'object' || row === null) return {};

            const nr = {};
            const rowKeys = Object.keys(row);

            // If the row doesn't have the header keys, it might be using legacy keys in the same order
            const needsMapping = headers.some(h => row[h] === undefined);

            if (needsMapping && rowKeys.length === headers.length) {
                // Map by index
                headers.forEach((h, i) => {
                    nr[h] = row[rowKeys[i]];
                });
            } else {
                // Standard mapping: ensure every header has a corresponding key (even if empty)
                headers.forEach(h => {
                    nr[h] = row[h] !== undefined ? row[h] : '';
                });

                // Keep any extra data that might be there (just in case)
                Object.keys(row).forEach(k => {
                    if (!headers.includes(k)) {
                        // We actually skip extra data to keep the spreadsheet clean
                        // but you could add it to a hidden field if needed.
                    }
                });
            }
            return nr;
        });

        return {
            ...table,
            headers,
            rows: normalizedRows
        };
    });

    return {
        ...data,
        requirements,
        tables
    };
};
