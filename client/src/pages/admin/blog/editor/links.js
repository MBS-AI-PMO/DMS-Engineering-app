/* Link helpers for the editor's link box and bubble. */

/* "example.com" -> "https://example.com", "a@b.com" -> "mailto:a@b.com". */
export function normalizeHref(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    if (/^(https?:|mailto:|tel:|\/|#)/i.test(s)) return s;
    if (/^[^\s@/]+@[^\s@/]+\.[a-z]{2,}$/i.test(s)) return `mailto:${s}`;
    if (/^\+?[0-9][0-9 ().-]{5,}$/.test(s)) return `tel:${s.replace(/[^\d+]/g, '')}`;
    if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(s)) return `https://${s}`;
    return s;
}

/* Adds, changes or removes the link at the selection. */
export function applyLink(editor, href) {
    const { empty } = editor.state.selection;
    if (empty && !editor.isActive('link')) {
        editor.chain().focus().insertContent({ type: 'text', text: href.replace(/^mailto:|^tel:/, ''), marks: [{ type: 'link', attrs: { href } }] }).run();
    } else {
        editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
}
