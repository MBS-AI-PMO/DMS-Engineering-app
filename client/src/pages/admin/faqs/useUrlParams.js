import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Screen state kept in the address (so "back" and links return to it).
 * setParam({ q: 'x', page: 1 }): empty values and page 1 are dropped.
 */
export function useUrlParams() {
    const [params, setParams] = useSearchParams();
    const setParam = useCallback((changes) => {
        setParams(prev => {
            const next = new URLSearchParams(prev);
            Object.entries(changes).forEach(([k, v]) => {
                if (v === null || v === undefined || v === '' || (k === 'page' && v === 1)) next.delete(k); else next.set(k, String(v));
            });
            return next;
        }, { replace: true });
    }, [setParams]);
    return [params, setParam];
}
