import { RotateCcw, Save } from 'lucide-react';
import { Button, FormActions } from '../../../components/admin/ui';

/**
 * The sticky bar at the end of a long form: says whether there are unsaved
 * changes, with Discard and Save. note: shown when nothing is pending.
 * canSave: Save is enabled (default: only with changes).
 */
export default function SaveBar({ dirty, canSave = dirty, saving = false, disabled = false, onSave, onDiscard, saveLabel = 'Save changes', note = 'All changes saved' }) {
    return (
        <FormActions sticky>
            <span className={`ac-savebar-status${dirty || canSave ? ' is-dirty' : ''}`} role="status">
                <span className="ak-dot" aria-hidden="true" />
                {dirty ? 'Unsaved changes' : note}
            </span>
            {onDiscard && (
                <Button variant="ghost" icon={RotateCcw} onClick={onDiscard} disabled={!dirty || saving}>Discard</Button>
            )}
            <Button variant="primary" icon={Save} onClick={onSave} loading={saving} disabled={disabled || (!canSave && !saving)}>
                {saving ? 'Saving…' : saveLabel}
            </Button>
        </FormActions>
    );
}
