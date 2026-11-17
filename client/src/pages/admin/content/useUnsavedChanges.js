import { useEffect } from 'react';

/**
 * While `dirty` is true the browser asks before the tab is closed or
 * reloaded. (In-app links are not blocked: the router is not a data router.)
 */
export function useUnsavedChanges(dirty) {
    useEffect(() => {
        if (!dirty) return undefined;
        const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);
}
