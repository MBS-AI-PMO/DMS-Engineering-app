import { useMemo, useState } from 'react';
import { Field, Textarea } from '../../../components/admin/ui';

/**
 * The value as editable JSON, for fields the structured editor does not
 * cover. A change is applied only once the text is valid JSON; until then
 * an error says so. (Candidate for the admin kit.)
 */
export default function RawJsonEditor({ label, value, onChange, rows = 10, hint }) {
    const serialized = useMemo(() => JSON.stringify(value ?? null, null, 2), [value]);
    const [draft, setDraft] = useState(null);
    const [error, setError] = useState('');

    const change = (text) => {
        setDraft(text);
        try {
            const parsed = JSON.parse(text);
            setError('');
            onChange(parsed);
        } catch {
            setError('This is not valid JSON yet. Nothing changes until it is.');
        }
    };

    return (
        <Field label={label} hint={hint} error={error}>
            <Textarea
                rows={rows}
                className="ak-mono"
                spellCheck={false}
                value={draft ?? serialized}
                invalid={Boolean(error)}
                onChange={e => change(e.target.value)}
                onBlur={() => { if (!error) setDraft(null); }}
            />
        </Field>
    );
}
