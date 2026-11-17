import { RotateCcw, Save } from 'lucide-react';
import { Button, FormActions } from '../../../components/admin/ui';

/**
 * The sticky bar at the bottom of a long form: whether there are unsaved
 * changes, Discard and Save. (Candidate for the admin kit.)
 */
export default function SaveBar({ dirty, saving, busy, busyText = 'Uploading…', onSave, onDiscard, saveLabel = 'Save changes', isNew = false }) {
    const note = busy ? busyText : isNew ? 'Not saved yet' : dirty ? 'Unsaved changes' : 'All changes saved';
    return (
        <FormActions sticky>
            <span className={`cat-save-note${dirty || isNew ? ' is-dirty' : ''}`} role="status">
                <span className="ak-dot" aria-hidden="true" />{note}
            </span>
            {onDiscard && <Button icon={RotateCcw} onClick={onDiscard} disabled={!dirty || saving}>Discard</Button>}
            <Button variant="primary" icon={Save} onClick={onSave} loading={saving} disabled={busy || (!dirty && !isNew)}>{saveLabel}</Button>
        </FormActions>
    );
}
