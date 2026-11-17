/* A stable id for list rows typed in the browser (React keys). */
let seq = 0;
export const newKey = (prefix = 'k') => `${prefix}${Date.now().toString(36)}${(seq += 1)}`;

/* Moves item `from` to `to` in a copy of the list. */
export function move(list, from, to) {
    if (to < 0 || to >= list.length || from === to) return list;
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
}
