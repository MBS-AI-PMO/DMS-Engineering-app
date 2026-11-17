import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

/** True while the media query matches (re-renders when it changes). */
export function useMediaQuery(query) {
    const subscribe = useCallback((notify) => {
        const list = window.matchMedia(query);
        list.addEventListener('change', notify);
        return () => list.removeEventListener('change', notify);
    }, [query]);
    return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

const readFlag = (key) => {
    try { return localStorage.getItem(key) === '1'; } catch { return false; }
};

/**
 * A yes/no remembered in this browser (e.g. the collapsed sidebar). Works
 * without storage too; it just isn't remembered then.
 */
export function useStoredFlag(key) {
    const [value, setValue] = useState(() => readFlag(key));
    useEffect(() => {
        try { localStorage.setItem(key, value ? '1' : '0'); } catch { /* storage blocked */ }
    }, [key, value]);
    return [value, setValue];
}
