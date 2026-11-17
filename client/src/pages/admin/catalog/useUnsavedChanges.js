import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfirm } from '../../../components/admin/ui';

/**
 * Care for unsaved edits on a long form. While `dirty`:
 *  - closing or reloading the tab asks the browser's "leave site?" question;
 *  - clicking any link inside the app (sidebar, back link…) asks first.
 * Returns { dialog, confirmLeave }: render `dialog` once; await
 * confirmLeave() before leaving from a button. (Candidate for the kit.)
 * The browser's own back button is not intercepted (BrowserRouter has no
 * blocker); the tab-close prompt still covers reloads.
 */
export function useUnsavedChanges(dirty) {
    const navigate = useNavigate();
    const [confirm, dialog] = useConfirm();

    const ask = useCallback(() => confirm({
        title: 'Leave without saving?',
        message: 'Your changes on this page have not been saved and will be lost.',
        confirmLabel: 'Leave without saving',
        cancelLabel: 'Stay',
        danger: true,
    }), [confirm]);

    useEffect(() => {
        if (!dirty) return undefined;
        const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
        const onClick = (e) => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const link = e.target.closest?.('a[href]');
            if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
            const url = new URL(link.href, window.location.href);
            if (url.origin !== window.location.origin) return;
            if (url.pathname === window.location.pathname && url.search === window.location.search) return;
            e.preventDefault();
            e.stopPropagation();
            ask().then(yes => { if (yes) navigate(`${url.pathname}${url.search}${url.hash}`); });
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        document.addEventListener('click', onClick, true);
        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            document.removeEventListener('click', onClick, true);
        };
    }, [dirty, ask, navigate]);

    const confirmLeave = useCallback(() => (dirty ? ask() : Promise.resolve(true)), [dirty, ask]);
    return { dialog, confirmLeave };
}
