import { useState } from 'react';
import { Field, ImageDrop, Input, Stack } from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';

/**
 * One picture: drop / choose a file (upload(file) -> stored path), replace,
 * remove, or type the path of one already uploaded.
 */
export default function ImageField({ value, onChange, upload, alt = '', aspect = '16 / 9', pathLabel = 'Picture path', placeholder = '/uploads/…', hint }) {
    const toast = useToast();
    const [busy, setBusy] = useState(false);

    const onFile = async (file) => {
        setBusy(true);
        try {
            onChange(await upload(file));
            toast('Picture uploaded. Save to keep it.', 'success');
        } catch (err) {
            toast(`Upload failed: ${err.message}`, 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Stack className="is-tight">
            <ImageDrop src={value || ''} alt={alt} onFile={onFile} onRemove={value ? () => onChange('') : undefined} busy={busy} aspect={aspect} hint={hint} />
            <Field label={pathLabel} optional>
                <Input className="cat-mono-path" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
            </Field>
        </Stack>
    );
}
