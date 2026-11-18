import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { exitSuggestion } from '@tiptap/suggestion';
import SlashMenu from './SlashMenu';
import { filterBlocks } from './blocks';

/*
 * "/" at the start of a word opens a menu of blocks to insert (blocks.js).
 * Built on TipTap's Suggestion plugin; the menu is a React component
 * placed under the caret. options.actions: { pickImage, openYoutube }.
 */

const slashKey = new PluginKey('blogSlash');

function place(el, clientRect) {
    const rect = clientRect?.();
    if (!el || !rect) return;
    const width = Math.min(300, window.innerWidth - 16);
    const below = window.innerHeight - rect.bottom;
    const height = Math.min(el.offsetHeight || 320, 340);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    el.style.left = `${left}px`;
    el.style.width = `${width}px`;
    if (below < height + 16 && rect.top > below) {
        el.style.top = 'auto';
        el.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    } else {
        el.style.bottom = 'auto';
        el.style.top = `${rect.bottom + 6}px`;
    }
}

export const SlashCommand = Extension.create({
    name: 'slashCommand',

    addOptions() {
        return { actions: { pickImage: () => {}, openYoutube: () => {} } };
    },

    addProseMirrorPlugins() {
        const extension = this;
        return [
            Suggestion({
                editor: this.editor,
                pluginKey: slashKey,
                char: '/',
                allowSpaces: false,
                startOfLine: false,
                // Not inside code, where "/" is just a character.
                allow: ({ state, range }) => {
                    const $from = state.doc.resolve(range.from);
                    return $from.parent.type.name !== 'codeBlock' && !$from.parent.type.spec.code;
                },
                items: ({ query }) => filterBlocks(query),
                command: ({ editor, range, props }) => props.run(editor, range, extension.options.actions),
                render: () => {
                    let renderer = null;
                    return {
                        onStart: (props) => {
                            renderer = new ReactRenderer(SlashMenu, { props, editor: props.editor });
                            renderer.element.className = 'be-slash-host';
                            document.body.appendChild(renderer.element);
                            requestAnimationFrame(() => place(renderer?.element, props.clientRect));
                        },
                        onUpdate: (props) => {
                            renderer?.updateProps(props);
                            requestAnimationFrame(() => place(renderer?.element, props.clientRect));
                        },
                        onKeyDown: (props) => {
                            if (props.event.key === 'Escape') {
                                exitSuggestion(props.view, slashKey);
                                return true;
                            }
                            return renderer?.ref?.onKeyDown(props.event) ?? false;
                        },
                        onExit: () => {
                            renderer?.element.remove();
                            renderer?.destroy();
                            renderer = null;
                        },
                    };
                },
            }),
        ];
    },
});
