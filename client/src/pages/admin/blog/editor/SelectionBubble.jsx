import { useMemo, useState } from 'react';
import { useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Bold, Code, Heading2, Heading3, Highlighter, Italic, Link2, Pencil, Strikethrough, TextQuote, Underline, Unlink } from 'lucide-react';
import LinkForm from './LinkForm';

/*
 * The small bar that floats over selected text (styles, link, headings,
 * quote), and over a link the cursor is in (its address, edit, remove).
 * The link box opens inside it.
 */

function shouldShow({ editor, state }) {
    if (!editor.isEditable) return false;
    const { selection } = state;
    if (selection.node) return false; // a picture, video or divider is selected
    if (editor.isActive('codeBlock')) return false;
    if (selection.empty) return editor.isActive('link');
    return state.doc.textBetween(selection.from, selection.to, ' ').trim().length > 0;
}

function B({ icon, label, active, onClick }) {
    const Icon = icon;
    return (
        <button type="button" className={`be-tool${active ? ' is-active' : ''}`} aria-label={label} title={label} aria-pressed={active} onMouseDown={e => e.preventDefault()} onClick={onClick}>
            <Icon size={15} aria-hidden="true" />
        </button>
    );
}

export default function SelectionBubble({ editor, scrollTarget }) {
    const [editing, setEditing] = useState(false);
    const options = useMemo(() => ({
        placement: 'top-start', offset: 8, flip: true, shift: { padding: 8 }, onHide: () => setEditing(false),
        ...(scrollTarget ? { scrollTarget } : {}),
    }), [scrollTarget]);
    const s = useEditorState({
        editor,
        selector: ({ editor: e }) => ({
            empty: e.state.selection.empty,
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            underline: e.isActive('underline'),
            strike: e.isActive('strike'),
            code: e.isActive('code'),
            highlight: e.isActive('highlight'),
            link: e.isActive('link'),
            href: e.getAttributes('link').href || '',
            h2: e.isActive('heading', { level: 2 }),
            h3: e.isActive('heading', { level: 3 }),
            quote: e.isActive('blockquote'),
        }),
    });
    const chain = () => editor.chain().focus();

    let body;
    if (editing) {
        body = <LinkForm editor={editor} onDone={() => setEditing(false)} />;
    } else if (s.empty && s.link) {
        body = (
            <div className="be-bubble-row">
                <a className="be-bubble-href" href={s.href} target="_blank" rel="noreferrer" title={s.href}>{s.href}</a>
                <B icon={Pencil} label="Edit link" onClick={() => setEditing(true)} />
                <B icon={Unlink} label="Remove link" onClick={() => chain().extendMarkRange('link').unsetLink().run()} />
            </div>
        );
    } else {
        body = (
            <div className="be-bubble-row">
                <B icon={Bold} label="Bold" active={s.bold} onClick={() => chain().toggleBold().run()} />
                <B icon={Italic} label="Italic" active={s.italic} onClick={() => chain().toggleItalic().run()} />
                <B icon={Underline} label="Underline" active={s.underline} onClick={() => chain().toggleUnderline().run()} />
                <B icon={Strikethrough} label="Strikethrough" active={s.strike} onClick={() => chain().toggleStrike().run()} />
                <B icon={Code} label="Inline code" active={s.code} onClick={() => chain().toggleCode().run()} />
                <B icon={Highlighter} label="Highlight" active={s.highlight} onClick={() => chain().toggleHighlight().run()} />
                <span className="be-bubble-rule" aria-hidden="true" />
                <B icon={Link2} label={s.link ? 'Edit link' : 'Link'} active={s.link} onClick={() => setEditing(true)} />
                <span className="be-bubble-rule" aria-hidden="true" />
                <B icon={Heading2} label="Heading" active={s.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()} />
                <B icon={Heading3} label="Subheading" active={s.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()} />
                <B icon={TextQuote} label="Quote" active={s.quote} onClick={() => chain().toggleBlockquote().run()} />
            </div>
        );
    }

    return (
        <BubbleMenu
            editor={editor}
            pluginKey="blogSelectionBubble"
            shouldShow={shouldShow}
            options={options}
            className="be-bubble"
        >
            {body}
        </BubbleMenu>
    );
}
