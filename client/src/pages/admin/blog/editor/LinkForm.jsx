import { useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, Unlink } from 'lucide-react';
import { safeHref } from '../../../../components/blog/blogDoc';
import { applyLink, normalizeHref } from './links';

/**
 * The link box: paste or type an address (a page on this site like
 * /get-instant-pricing, a web address, an email or a phone number).
 * onDone() closes it.
 */
export default function LinkForm({ editor, onDone }) {
    const current = editor.getAttributes('link').href || '';
    const [value, setValue] = useState(current);
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    // After the box is placed and shown (a hidden field cannot take focus).
    useEffect(() => {
        const t = setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
        return () => clearTimeout(t);
    }, []);

    const submit = (e) => {
        e.preventDefault();
        const href = normalizeHref(value);
        if (!href) {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            onDone();
            return;
        }
        if (!safeHref(href)) {
            setError('Use a web address (https://…), a page on this site (/…), an email or a phone number.');
            return;
        }
        applyLink(editor, href);
        onDone();
    };

    const remove = () => {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        onDone();
    };

    const normalized = normalizeHref(value);
    return (
        <form className="be-link-form" onSubmit={submit}>
            <label className="be-link-field">
                <span className="ak-sr">Link address</span>
                <input
                    ref={inputRef}
                    className="ak-input"
                    value={value}
                    onChange={e => { setValue(e.target.value); setError(''); }}
                    onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onDone(true); } }}
                    placeholder="Paste a link or type /page"
                    spellCheck={false}
                />
            </label>
            <div className="be-link-actions">
                <button type="submit" className="ak-btn is-primary is-sm"><Check size={14} aria-hidden="true" /> {current ? 'Update' : 'Add link'}</button>
                {current && <button type="button" className="ak-btn is-sm" onClick={remove}><Unlink size={14} aria-hidden="true" /> Remove</button>}
                {normalized && safeHref(normalized) && /^https?:/i.test(normalized) && (
                    <a className="ak-icon-btn is-xs" href={normalized} target="_blank" rel="noreferrer" aria-label="Open the link in a new tab" title="Open in a new tab"><ExternalLink size={13} aria-hidden="true" /></a>
                )}
            </div>
            {error && <p className="ak-error-text">{error}</p>}
        </form>
    );
}
