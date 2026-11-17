import { useCallback, useMemo, useState } from 'react';

/**
 * A form's working copy next to the last saved one.
 *   const { draft, setDraft, dirty, load, discard, saved } = useDraft(EMPTY);
 * load(value) sets both (after loading or saving); discard() goes back.
 */
export function useDraft(initial) {
    const [saved, setSaved] = useState(initial);
    const [draft, setDraft] = useState(initial);
    const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
    const load = useCallback((value) => { setSaved(value); setDraft(value); }, []);
    const discard = useCallback(() => setDraft(saved), [saved]);
    return { draft, setDraft, dirty, load, discard, saved };
}

/** Counts uploads in flight: wrap(fn) returns fn tracked; busy while any runs. */
export function useUploads() {
    const [count, setCount] = useState(0);
    const wrap = useCallback((fn) => async (...args) => {
        setCount(c => c + 1);
        try { return await fn(...args); } finally { setCount(c => Math.max(0, c - 1)); }
    }, []);
    return { busy: count > 0, wrap };
}
