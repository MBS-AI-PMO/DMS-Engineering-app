import { Extension, Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import Youtube from '@tiptap/extension-youtube';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import { safeHref } from '../../../../components/blog/blogDoc';
import ImageView from './ImageView';
import CalloutView from './CalloutView';
import { SlashCommand } from './slashCommand';

/*
 * The editor's blocks and marks. They match the list the server accepts
 * (backend/blog/content.js) and the site draws (components/blog/BlogContent):
 * headings 2-4, lists, quote, code block, divider, text alignment,
 * highlight, links, tables, pictures with caption and description,
 * YouTube videos and callout boxes (note, tip, warning).
 *
 * Markdown shortcuts come with the blocks: "## " heading, "- " or "1. " list,
 * "> " quote, "```" code, "---" divider, **bold**, *italic*, `code`, ==highlight==.
 */

/* A picture as a block, with a caption; edited through ImageView. */
const BlogImage = Image.extend({
    draggable: true,
    addOptions() {
        return { ...this.parent?.(), upload: null };
    },
    addAttributes() {
        return {
            ...this.parent?.(),
            caption: {
                default: null,
                parseHTML: (el) => el.getAttribute('data-caption'),
                renderHTML: (attrs) => (attrs.caption ? { 'data-caption': attrs.caption } : {}),
            },
        };
    },
    addNodeView() {
        return ReactNodeViewRenderer(ImageView);
    },
});

/* A coloured box around a few blocks: info | tip | warning. */
const Callout = Node.create({
    name: 'callout',
    group: 'block',
    content: 'block+',
    defining: true,
    addAttributes() {
        return {
            tone: {
                default: 'info',
                parseHTML: (el) => el.getAttribute('data-tone') || 'info',
                renderHTML: (attrs) => ({ 'data-tone': attrs.tone }),
            },
        };
    },
    parseHTML() {
        return [{ tag: 'aside[data-callout]' }];
    },
    renderHTML({ HTMLAttributes }) {
        return ['aside', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0];
    },
    addNodeView() {
        return ReactNodeViewRenderer(CalloutView);
    },
    addCommands() {
        return {
            setCallout: (tone = 'info') => ({ commands }) => commands.wrapIn(this.name, { tone }),
            toggleCallout: (tone = 'info') => ({ editor, commands }) => (editor.isActive(this.name) ? commands.lift(this.name) : commands.wrapIn(this.name, { tone })),
        };
    },
});

/* Ctrl/⌘ K opens the link box. */
const LinkShortcut = Extension.create({
    name: 'blogLinkShortcut',
    addOptions() {
        return { onLink: null };
    },
    addKeyboardShortcuts() {
        return {
            'Mod-k': () => {
                this.options.onLink?.();
                return true;
            },
        };
    },
});

/**
 * hooks: { upload(file) -> Promise<{ url, width, height }>, pickImage(),
 * openYoutube(), openLink() } (the editor component supplies them).
 */
export function blogExtensions(hooks) {
    return [
        StarterKit.configure({
            heading: { levels: [2, 3, 4] },
            link: {
                openOnClick: false,
                autolink: true,
                linkOnPaste: true,
                defaultProtocol: 'https',
                protocols: ['mailto', 'tel'],
                isAllowedUri: (url) => Boolean(safeHref(url)),
                HTMLAttributes: { rel: 'noopener noreferrer', target: null, class: null },
            },
            dropcursor: { color: '#e31b23', width: 2 },
        }),
        TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
        Highlight,
        BlogImage.configure({ inline: false, allowBase64: false, upload: hooks.upload }),
        TableKit.configure({ table: { resizable: false } }),
        Youtube.configure({ nocookie: true, modestBranding: true, rel: 0, width: 640, height: 360, HTMLAttributes: { class: 'be-youtube' } }),
        Callout,
        Placeholder.configure({
            placeholder: ({ node }) => (node.type.name === 'heading' ? 'Heading' : 'Write, or type “/” for headings, pictures, tables and more…'),
            includeChildren: false,
        }),
        CharacterCount,
        SlashCommand.configure({ actions: { pickImage: hooks.pickImage, openYoutube: hooks.openYoutube } }),
        LinkShortcut.configure({ onLink: hooks.openLink }),
    ];
}
