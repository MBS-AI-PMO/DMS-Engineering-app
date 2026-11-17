import { Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { Button, Field, IconButton, Input } from '../../../components/admin/ui';
import { isSafeImageUrl } from '../../../utils/seo';

/**
 * A share image: a URL (or /uploads/… path) with a thumbnail, an Upload
 * button and a clear button. onUpload starts the page's file picker.
 */
export default function ImageUrlField({ label, hint, value, onChange, onUpload, uploading, error, placeholder }) {
    const preview = isSafeImageUrl(value) ? value : '';
    return (
        <Field as="div" label={label} hint={hint} error={error}>
            <span className="ac-seo-image">
                <span className="ac-seo-thumb" aria-hidden="true">
                    {preview ? <img src={preview} alt="" /> : <ImageIcon size={18} />}
                </span>
                <Input
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder || 'https://… or upload one'}
                    invalid={!!error}
                    aria-label={`${label} URL`}
                    spellCheck={false}
                />
                <Button icon={Upload} onClick={onUpload} loading={uploading} className="ac-seo-upload">Upload</Button>
                {value && <IconButton icon={Trash2} label={`Clear ${label.toLowerCase()}`} onClick={() => onChange('')} />}
            </span>
        </Field>
    );
}
