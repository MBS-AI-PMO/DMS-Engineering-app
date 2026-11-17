/*
 * Services as a tree: main production services (and services without a
 * parent) at the top, sub-services under each parent. A sub-service with
 * two parents appears under both, so each row gets a key from its path.
 */

const parentsOf = (s) => (s.parent_ids || []).map(Number);
const byOrder = (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.id - b.id;

export function flattenTree(items, parentId = null, depth = 0, path = 'root', seen = new Set()) {
    const level = items
        .filter(s => (parentId === null ? parentsOf(s).length === 0 || s.is_production : parentsOf(s).includes(Number(parentId))))
        .sort(byOrder);
    const rows = [];
    level.forEach(s => {
        const key = `${path}/${s.id}`;
        if (seen.has(`${s.id}-${parentId}`)) return; // a loop in the data
        seen.add(`${s.id}-${parentId}`);
        rows.push({ ...s, depth, rowKey: key });
        if (depth < 5) rows.push(...flattenTree(items, s.id, depth + 1, key, seen));
    });
    return rows;
}

/** The tree limited to services matching `needle`, with their parents for context. */
export function searchTree(items, needle) {
    const q = needle.trim().toLowerCase();
    if (!q) return flattenTree(items);
    const keep = new Set();
    const stack = items.filter(s => [s.title, s.description, s.slug].some(v => v && v.toLowerCase().includes(q)));
    while (stack.length) {
        const s = stack.pop();
        if (keep.has(s.id)) continue;
        keep.add(s.id);
        stack.push(...items.filter(p => parentsOf(s).includes(Number(p.id))));
    }
    return flattenTree(items.filter(s => keep.has(s.id)));
}

export const serviceType = (s) => (s.is_production ? 'main' : parentsOf(s).length ? 'sub' : 'standard');
