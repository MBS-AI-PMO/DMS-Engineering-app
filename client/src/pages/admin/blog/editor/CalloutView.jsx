import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { AlertTriangle, Info, Lightbulb } from 'lucide-react';

const TONES = [
    { key: 'info', label: 'Note', icon: Info },
    { key: 'tip', label: 'Tip', icon: Lightbulb },
    { key: 'warning', label: 'Warning', icon: AlertTriangle },
];

/**
 * A callout box in the editor: its icon button switches the style
 * (note, tip, warning); the text inside is edited like the rest.
 */
export default function CalloutView({ node, updateAttributes }) {
    const index = Math.max(0, TONES.findIndex(t => t.key === node.attrs.tone));
    const tone = TONES[index];
    const next = TONES[(index + 1) % TONES.length];
    const Icon = tone.icon;
    return (
        <NodeViewWrapper as="aside" className={`be-callout is-${tone.key}`}>
            <button
                type="button"
                className="be-callout-icon"
                contentEditable={false}
                onClick={() => updateAttributes({ tone: next.key })}
                title={`${tone.label} box. Click for a ${next.label.toLowerCase()} box.`}
                aria-label={`${tone.label} box. Change to ${next.label.toLowerCase()}.`}
            >
                <Icon size={17} aria-hidden="true" />
            </button>
            <NodeViewContent className="be-callout-body" />
        </NodeViewWrapper>
    );
}
