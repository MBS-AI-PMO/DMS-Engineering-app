import {
    AlertTriangle, CodeXml, Heading2, Heading3, Heading4, ImagePlus, Info, Lightbulb, List, ListOrdered, Minus, Pilcrow,
    Table2, TextQuote, Youtube,
} from 'lucide-react';

/*
 * The blocks the "/" menu inserts. run(editor, range, actions) replaces
 * the typed "/query" (range) with the block; actions open the picture
 * picker and the YouTube dialog, which need the page.
 */

const at = (editor, range) => {
    const chain = editor.chain().focus();
    return range ? chain.deleteRange(range) : chain;
};

export const BLOCKS = [
    { key: 'text', title: 'Text', hint: 'A plain paragraph', icon: Pilcrow, words: 'paragraph p normal', run: (e, r) => at(e, r).setParagraph().run() },
    { key: 'h2', title: 'Heading', hint: 'A section of the post', icon: Heading2, words: 'h2 title section large', run: (e, r) => at(e, r).setNode('heading', { level: 2 }).run() },
    { key: 'h3', title: 'Subheading', hint: 'A part of a section', icon: Heading3, words: 'h3 medium', run: (e, r) => at(e, r).setNode('heading', { level: 3 }).run() },
    { key: 'h4', title: 'Small heading', hint: 'A label over a few lines', icon: Heading4, words: 'h4 small', run: (e, r) => at(e, r).setNode('heading', { level: 4 }).run() },
    { key: 'bullet', title: 'Bulleted list', hint: 'Points in any order', icon: List, words: 'ul unordered bullets', run: (e, r) => at(e, r).toggleBulletList().run() },
    { key: 'ordered', title: 'Numbered list', hint: 'Steps in order', icon: ListOrdered, words: 'ol ordered steps numbers 1.', run: (e, r) => at(e, r).toggleOrderedList().run() },
    { key: 'quote', title: 'Quote', hint: 'Words from someone', icon: TextQuote, words: 'blockquote citation', run: (e, r) => at(e, r).toggleBlockquote().run() },
    { key: 'note', title: 'Note box', hint: 'A grey box for a side note', icon: Info, words: 'callout info aside box', run: (e, r) => at(e, r).setCallout('info').run() },
    { key: 'tip', title: 'Tip box', hint: 'A green box for advice', icon: Lightbulb, words: 'callout tip hint advice', run: (e, r) => at(e, r).setCallout('tip').run() },
    { key: 'warning', title: 'Warning box', hint: 'An amber box for a caution', icon: AlertTriangle, words: 'callout warning caution important', run: (e, r) => at(e, r).setCallout('warning').run() },
    { key: 'code', title: 'Code block', hint: 'G-code, settings, file text', icon: CodeXml, words: 'pre monospace snippet', run: (e, r) => at(e, r).toggleCodeBlock().run() },
    { key: 'divider', title: 'Divider', hint: 'A line between parts', icon: Minus, words: 'hr horizontal rule line separator', run: (e, r) => at(e, r).setHorizontalRule().run() },
    { key: 'image', title: 'Picture', hint: 'Upload from your computer', icon: ImagePlus, words: 'image photo upload img', run: (e, r, actions) => { at(e, r).run(); actions.pickImage(); } },
    { key: 'table', title: 'Table', hint: 'Rows and columns', icon: Table2, words: 'grid sizes spec', run: (e, r) => at(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { key: 'youtube', title: 'YouTube video', hint: 'Paste a video link', icon: Youtube, words: 'video embed movie', run: (e, r, actions) => { at(e, r).run(); actions.openYoutube(); } },
];

/* The blocks whose name or keywords start with the query (then contain it). */
export function filterBlocks(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return BLOCKS;
    const starts = [];
    const contains = [];
    BLOCKS.forEach(b => {
        const hay = `${b.title} ${b.words}`.toLowerCase();
        if (hay.split(/\s+/).some(w => w.startsWith(q))) starts.push(b);
        else if (hay.includes(q)) contains.push(b);
    });
    return [...starts, ...contains];
}
