import { useCallback, useEffect, useRef, useState } from 'react';
import { blogService } from '../../../services/admin/blog';
import { useUnsavedChanges } from '../content/useUnsavedChanges';
import { isBlank, payloadOf, serialize } from './blogModel';

/*
 * Saving a post from the editor, so no work is lost:
 *
 *  - drafts (and scheduled posts, not on the site yet) save themselves 1.5 s
 *    after the last change; a post that is live waits for "Update";
 *  - one save at a time; changes made while one runs are saved right after;
 *  - every save sends the version it started from, so a newer save made in
 *    another tab is never overwritten (status 'conflict' instead);
 *  - while there are unsaved changes a copy is kept in this browser
 *    (readBackup) and the tab asks before closing; leaving the page saves a
 *    draft one last time;
 *  - a failed save is retried after a short wait.
 *
 *   const saver = usePostSaver(form, { onCreated, onServerFields });
 *   saver.post     the post as last saved (no content), or null for a new one
 *   saver.status   'idle' | 'saving' | 'saved' | 'error' | 'conflict'
 *   saver.dirty    the form differs from what is saved
 *   saver.reset(post, savedForm)   after loading (or reloading) a post
 *   saver.save()   save now (creates the post the first time)
 *   saver.act('publish' | 'unpublish' | 'schedule', when?)   save and change status
 */

const AUTOSAVE_MS = 1500;
const RETRY_MS = 12000;
const backupKey = (id) => `dms_blog_backup_${id || 'new'}`;

export function readBackup(id) {
    try {
        const raw = localStorage.getItem(backupKey(id));
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}
export function dropBackup(id) {
    try { localStorage.removeItem(backupKey(id)); } catch { /* storage blocked */ }
}
function writeBackup(id, form, version) {
    try { localStorage.setItem(backupKey(id), JSON.stringify({ at: Date.now(), version, form: payloadOf(form) })); } catch { /* storage full or blocked */ }
}

const stripContent = (row) => {
    if (!row) return row;
    const { content: _content, ...rest } = row;
    return rest;
};

export function usePostSaver(form, { onCreated, onServerFields } = {}) {
    const [post, setPost] = useState(null);
    const [snapshot, setSnapshot] = useState(() => serialize(form));
    // The same, updated the moment a save answers (a queued save must send the new version).
    const postRef = useRef(null);
    const snapRef = useRef(snapshot);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState('');
    const [lastSaved, setLastSaved] = useState(null);

    const current = serialize(form);
    const dirty = current !== snapshot;
    const live = post?.state === 'published';
    const autosave = !live && status !== 'conflict';

    // Latest values for timers and async code.
    const latest = useRef({});
    latest.current = { form, autosave, dirty, onCreated, onServerFields };
    const inFlight = useRef(null);
    const again = useRef(false);

    const adopt = useCallback((row, sent) => {
        const meta = stripContent(row);
        // The server may settle the address (made unique) and the author (the admin, when empty).
        const settled = { slug: row.slug, author_name: sent.author_name || row.author_name || '' };
        const saved = { ...sent, ...settled };
        postRef.current = meta;
        snapRef.current = serialize(saved);
        setPost(meta);
        setSnapshot(snapRef.current);
        setLastSaved(new Date());
        setStatus('saved');
        setError('');
        if (settled.slug !== sent.slug || settled.author_name !== sent.author_name) latest.current.onServerFields?.(settled);
        if (serialize(latest.current.form) === snapRef.current) dropBackup(meta.id);
        return meta;
    }, []);

    const fail = useCallback((err) => {
        if (err?.status === 409 && err.body?.code === 'version_conflict') {
            setStatus('conflict');
            setError(err.message);
        } else {
            setStatus('error');
            setError(err?.message || 'Could not save.');
        }
        throw err;
    }, []);

    /* Save the form as it is now. Resolves to the saved post (or null when there was nothing to save). */
    const save = useCallback(async () => {
        if (inFlight.current) {
            again.current = true;
            return inFlight.current;
        }
        const run = async () => {
            const f = latest.current.form;
            const p = postRef.current;
            const sent = payloadOf(f);
            if (!p?.id) {
                if (isBlank(f)) return null;
                setStatus('saving');
                const row = await blogService.create(sent).catch(fail);
                const meta = adopt(row, sent);
                dropBackup(null);
                latest.current.onCreated?.(meta.id);
                return meta;
            }
            if (serialize(f) === snapRef.current) return p;
            setStatus('saving');
            const body = await blogService.save(p.id, { ...sent, version: p.version }).catch(fail);
            return adopt(body.data, sent);
        };
        inFlight.current = run().finally(() => { inFlight.current = null; });
        const result = await inFlight.current;
        if (again.current) {
            again.current = false;
            if (serialize(latest.current.form) !== snapRef.current) return save();
        }
        return result;
    }, [adopt, fail]);

    /* Save and change status in one request. kind: publish | unpublish | schedule (when: Date). */
    const act = useCallback(async (kind, when) => {
        if (inFlight.current) await inFlight.current.catch(() => null);
        let p = postRef.current;
        if (!p?.id) p = await save();
        if (!p?.id) throw new Error('Write something first.');
        const f = latest.current.form;
        const sent = payloadOf(f);
        const fields = { ...sent, version: p.version };
        setStatus('saving');
        const request = kind === 'publish' ? blogService.publish(p.id, fields)
            : kind === 'schedule' ? blogService.schedule(p.id, when.toISOString(), fields)
                : blogService.unpublish(p.id, fields);
        const body = await request.catch(fail);
        return adopt(body.data, sent);
    }, [adopt, fail, save]);

    /* After loading a post: what is saved is what the form shows. */
    const reset = useCallback((row, savedForm) => {
        postRef.current = row ? stripContent(row) : null;
        snapRef.current = serialize(savedForm);
        setPost(postRef.current);
        setSnapshot(snapRef.current);
        setStatus('idle');
        setError('');
        setLastSaved(row?.updated_at ? new Date(row.updated_at) : null);
    }, []);

    // Autosave a little after the last change.
    useEffect(() => {
        if (!dirty || !autosave) return undefined;
        const t = setTimeout(() => { save().catch(() => {}); }, status === 'error' ? RETRY_MS : AUTOSAVE_MS);
        return () => clearTimeout(t);
    }, [current, dirty, autosave, status, save]);

    // A copy in this browser while anything is unsaved.
    useEffect(() => {
        if (!dirty) return undefined;
        const t = setTimeout(() => writeBackup(post?.id, form, post?.version), 600);
        return () => clearTimeout(t);
        // form is covered by `current`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [current, dirty, post?.id, post?.version]);

    useUnsavedChanges(dirty || status === 'saving');

    // Leaving the page: one last save of a draft.
    useEffect(() => () => {
        if (latest.current.dirty && latest.current.autosave) save().catch(() => {});
    }, [save]);

    return { post, status, error, dirty, live, autosave, lastSaved, save, act, reset };
}
