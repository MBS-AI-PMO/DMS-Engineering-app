import { AlertTriangle, Check, CircleDot, Loader2 } from 'lucide-react';
import { clock } from './blogModel';

/**
 * "Saving…", "Saved 3:42 PM", "Unsaved changes", "Not saved": how the
 * post's saving stands. saver: from usePostSaver.
 */
export default function SaveState({ saver, className = '' }) {
    const { status, dirty, autosave, lastSaved, post } = saver;
    let tone = 'muted';
    let Icon = Check;
    let text;
    if (status === 'saving') {
        Icon = Loader2; text = 'Saving…';
    } else if (status === 'conflict') {
        tone = 'error'; Icon = AlertTriangle; text = 'Changed somewhere else';
    } else if (status === 'error') {
        tone = 'error'; Icon = AlertTriangle; text = autosave ? 'Not saved · trying again' : 'Not saved';
    } else if (dirty) {
        tone = 'warn'; Icon = CircleDot; text = autosave && post?.id ? 'Unsaved changes…' : 'Unsaved changes';
    } else if (lastSaved) {
        text = `Saved ${clock(lastSaved)}`;
    } else if (!post?.id) {
        Icon = CircleDot; text = 'Not saved yet';
    } else {
        text = 'Saved';
    }
    return (
        <span className={`be-save-state is-${tone} ${className}`.trim()} role="status" aria-live="polite">
            <Icon size={14} className={status === 'saving' ? 'ak-spin' : undefined} aria-hidden="true" />
            {text}
        </span>
    );
}
