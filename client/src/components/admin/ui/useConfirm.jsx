import { useCallback, useState } from 'react';
import { ConfirmDialog } from './Modal';

/**
 * A promise-based confirm dialog (instead of window.confirm).
 *   const [confirm, confirmDialog] = useConfirm();
 *   const yes = await confirm({ title, message, confirmLabel, danger });
 * Render {confirmDialog} once in the component.
 */
export function useConfirm() {
    const [state, setState] = useState(null);
    const confirm = useCallback((options) => new Promise(resolve => setState({ ...options, resolve })), []);
    const close = (answer) => {
        state?.resolve(answer);
        setState(null);
    };
    const dialog = state ? (
        <ConfirmDialog
            title={state.title}
            message={state.message}
            confirmLabel={state.confirmLabel}
            cancelLabel={state.cancelLabel}
            danger={state.danger}
            onConfirm={() => close(true)}
            onCancel={() => close(false)}
        />
    ) : null;
    return [confirm, dialog];
}
