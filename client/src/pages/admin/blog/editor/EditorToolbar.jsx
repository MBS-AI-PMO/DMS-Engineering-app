import { useRef, useState } from 'react';
import { useEditorState } from '@tiptap/react';
import {
    AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, ChevronDown, Code, CodeXml, Eye, Heading2, Highlighter, ImagePlus,
    Info, Italic, Keyboard, Link2, List, ListOrdered, Maximize2, Minimize2, Minus, Redo2, Strikethrough, Table2, TextQuote,
    Underline, Undo2, Youtube,
} from 'lucide-react';
import { Popover } from '../../../../components/admin/ui';
import LinkForm from './LinkForm';
import TableBar from './TableBar';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
const MOD = isMac ? '⌘' : 'Ctrl';

const BLOCK_TYPES = [
    { value: 'paragraph', label: 'Text' },
    { value: 'h2', label: 'Heading' },
    { value: 'h3', label: 'Subheading' },
    { value: 'h4', label: 'Small heading' },
];
const ALIGNS = [
    { value: 'left', label: 'Align left', icon: AlignLeft },
    { value: 'center', label: 'Center', icon: AlignCenter },
    { value: 'right', label: 'Align right', icon: AlignRight },
    { value: 'justify', label: 'Justify', icon: AlignJustify },
];
const SHORTCUTS = [
    ['Bold, italic, underline', `${MOD} B · I · U`],
    ['Strikethrough', `${MOD} Shift S`],
    ['Inline code', `${MOD} E`],
    ['Highlight', `${MOD} Shift H`],
    ['Link', `${MOD} K`],
    ['Heading, subheading, small', `${MOD} Alt 2 · 3 · 4`],
    ['Bulleted / numbered list', `${MOD} Shift 8 · 7`],
    ['Quote', `${MOD} Shift B`],
    ['Code block', `${MOD} Alt C`],
    ['Undo / redo', `${MOD} Z · ${MOD} Shift Z`],
    ['Save', `${MOD} S`],
    ['Insert a block', '/ at the start of a word'],
    ['Markdown', '## heading, - list, 1. list, > quote, ``` code, --- line'],
];

/* A toolbar button that keeps the editor's selection (mousedown does not take focus). */
function Tool({ icon, label, shortcut, active = false, disabled = false, onClick, toolRef, ...rest }) {
    const Icon = icon;
    return (
        <button
            ref={toolRef}
            type="button"
            className={`be-tool${active ? ' is-active' : ''}`}
            aria-label={label}
            aria-pressed={rest['aria-haspopup'] ? undefined : active}
            title={shortcut ? `${label} (${shortcut})` : label}
            disabled={disabled}
            onMouseDown={e => e.preventDefault()}
            onClick={onClick}
            {...rest}
        >
            <Icon size={16} aria-hidden="true" />
        </button>
    );
}

/**
 * The sticky bar over the text: undo/redo, block type, text styles, link,
 * lists and blocks, alignment, inserts (picture, table, video), focus mode,
 * preview and the shortcuts list. In a table, a second row edits the table.
 */
export default function EditorToolbar({ editor, linkOpen, setLinkOpen, onPickImage, onYoutube, focus, onToggleFocus, onPreview, uploading }) {
    const s = useEditorState({
        editor,
        selector: ({ editor: e }) => ({
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
            block: e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : e.isActive('heading', { level: 4 }) ? 'h4' : 'paragraph',
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            underline: e.isActive('underline'),
            strike: e.isActive('strike'),
            code: e.isActive('code'),
            highlight: e.isActive('highlight'),
            link: e.isActive('link'),
            bullet: e.isActive('bulletList'),
            ordered: e.isActive('orderedList'),
            quote: e.isActive('blockquote'),
            codeBlock: e.isActive('codeBlock'),
            callout: e.isActive('callout'),
            table: e.isActive('table'),
            align: ['center', 'right', 'justify'].find(a => e.isActive({ textAlign: a })) || 'left',
        }),
    });
    const linkRef = useRef(null);
    const alignRef = useRef(null);
    const blockRef = useRef(null);
    const keysRef = useRef(null);
    const [menu, setMenu] = useState(null); // 'align' | 'block' | 'keys'
    const chain = () => editor.chain().focus();

    const setBlock = (value) => {
        setMenu(null);
        if (value === 'paragraph') chain().setParagraph().run();
        else chain().setNode('heading', { level: Number(value.slice(1)) }).run();
    };
    const AlignIcon = ALIGNS.find(a => a.value === s.align)?.icon || AlignLeft;
    const blockLabel = BLOCK_TYPES.find(b => b.value === s.block)?.label || 'Text';

    return (
        <div className="be-toolbar-wrap">
            <div className="be-toolbar" role="toolbar" aria-label="Formatting">
                <div className="be-tool-group">
                    <Tool icon={Undo2} label="Undo" shortcut={`${MOD} Z`} disabled={!s.canUndo} onClick={() => chain().undo().run()} />
                    <Tool icon={Redo2} label="Redo" shortcut={`${MOD} Shift Z`} disabled={!s.canRedo} onClick={() => chain().redo().run()} />
                </div>
                <div className="be-tool-group">
                    <button
                        ref={blockRef}
                        type="button"
                        className="be-tool is-wide"
                        aria-haspopup="menu"
                        aria-expanded={menu === 'block'}
                        title="Text or heading"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => setMenu(m => (m === 'block' ? null : 'block'))}
                    >
                        <Heading2 size={16} aria-hidden="true" />
                        <span>{blockLabel}</span>
                        <ChevronDown size={14} aria-hidden="true" />
                    </button>
                    <Popover anchorRef={blockRef} open={menu === 'block'} onClose={() => setMenu(null)} role="menu" label="Text or heading" width={200}>
                        <div className="be-menu">
                            {BLOCK_TYPES.map(b => (
                                <button key={b.value} type="button" role="menuitemradio" aria-checked={s.block === b.value} className={`be-menu-item be-block-${b.value}${s.block === b.value ? ' is-current' : ''}`} onMouseDown={e => e.preventDefault()} onClick={() => setBlock(b.value)}>
                                    {b.label}
                                </button>
                            ))}
                        </div>
                    </Popover>
                </div>
                <div className="be-tool-group">
                    <Tool icon={Bold} label="Bold" shortcut={`${MOD} B`} active={s.bold} onClick={() => chain().toggleBold().run()} />
                    <Tool icon={Italic} label="Italic" shortcut={`${MOD} I`} active={s.italic} onClick={() => chain().toggleItalic().run()} />
                    <Tool icon={Underline} label="Underline" shortcut={`${MOD} U`} active={s.underline} onClick={() => chain().toggleUnderline().run()} />
                    <Tool icon={Strikethrough} label="Strikethrough" shortcut={`${MOD} Shift S`} active={s.strike} onClick={() => chain().toggleStrike().run()} />
                    <Tool icon={Code} label="Inline code" shortcut={`${MOD} E`} active={s.code} onClick={() => chain().toggleCode().run()} />
                    <Tool icon={Highlighter} label="Highlight" shortcut={`${MOD} Shift H`} active={s.highlight} onClick={() => chain().toggleHighlight().run()} />
                    <Tool icon={Link2} label="Link" shortcut={`${MOD} K`} active={s.link} toolRef={linkRef} aria-haspopup="dialog" aria-expanded={linkOpen} onClick={() => setLinkOpen(!linkOpen)} />
                    <Popover anchorRef={linkRef} open={linkOpen} onClose={() => setLinkOpen(false)} role="dialog" label="Link" width={340}>
                        <LinkForm editor={editor} onDone={() => setLinkOpen(false)} />
                    </Popover>
                </div>
                <div className="be-tool-group">
                    <Tool icon={List} label="Bulleted list" shortcut={`${MOD} Shift 8`} active={s.bullet} onClick={() => chain().toggleBulletList().run()} />
                    <Tool icon={ListOrdered} label="Numbered list" shortcut={`${MOD} Shift 7`} active={s.ordered} onClick={() => chain().toggleOrderedList().run()} />
                    <Tool icon={TextQuote} label="Quote" shortcut={`${MOD} Shift B`} active={s.quote} onClick={() => chain().toggleBlockquote().run()} />
                    <Tool icon={Info} label="Note box" active={s.callout} onClick={() => chain().toggleCallout('info').run()} />
                    <Tool icon={CodeXml} label="Code block" shortcut={`${MOD} Alt C`} active={s.codeBlock} onClick={() => chain().toggleCodeBlock().run()} />
                    <Tool icon={Minus} label="Divider" onClick={() => chain().setHorizontalRule().run()} />
                    <Tool icon={AlignIcon} label="Alignment" toolRef={alignRef} aria-haspopup="menu" aria-expanded={menu === 'align'} active={s.align !== 'left'} onClick={() => setMenu(m => (m === 'align' ? null : 'align'))} />
                    <Popover anchorRef={alignRef} open={menu === 'align'} onClose={() => setMenu(null)} role="menu" label="Alignment" width={180}>
                        <div className="be-menu">
                            {ALIGNS.map(a => {
                                const Icon = a.icon;
                                return (
                                    <button key={a.value} type="button" role="menuitemradio" aria-checked={s.align === a.value} className={`be-menu-item${s.align === a.value ? ' is-current' : ''}`} onMouseDown={e => e.preventDefault()} onClick={() => { setMenu(null); chain().setTextAlign(a.value).run(); }}>
                                        <Icon size={15} aria-hidden="true" /> {a.label}
                                    </button>
                                );
                            })}
                        </div>
                    </Popover>
                </div>
                <div className="be-tool-group">
                    <Tool icon={ImagePlus} label={uploading ? 'Uploading…' : 'Picture'} disabled={Boolean(uploading)} onClick={onPickImage} />
                    <Tool icon={Table2} label="Table" disabled={s.table} onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
                    <Tool icon={Youtube} label="YouTube video" onClick={onYoutube} />
                </div>
                <div className="be-tool-group is-end">
                    {uploading > 0 && <span className="be-uploading" role="status">Uploading {uploading === 1 ? 'picture' : `${uploading} pictures`}…</span>}
                    <Tool icon={Keyboard} label="Keyboard shortcuts" toolRef={keysRef} aria-haspopup="dialog" aria-expanded={menu === 'keys'} onClick={() => setMenu(m => (m === 'keys' ? null : 'keys'))} />
                    <Popover anchorRef={keysRef} open={menu === 'keys'} onClose={() => setMenu(null)} role="dialog" label="Keyboard shortcuts" align="end" width={340}>
                        <dl className="be-keys">
                            {SHORTCUTS.map(([what, keys]) => <div key={what}><dt>{what}</dt><dd>{keys}</dd></div>)}
                        </dl>
                    </Popover>
                    <Tool icon={Eye} label="Preview" onClick={onPreview} />
                    <Tool icon={focus ? Minimize2 : Maximize2} label={focus ? 'Leave focus mode (Esc)' : 'Focus mode'} active={focus} onClick={onToggleFocus} />
                </div>
            </div>
            {s.table && <TableBar editor={editor} />}
        </div>
    );
}
