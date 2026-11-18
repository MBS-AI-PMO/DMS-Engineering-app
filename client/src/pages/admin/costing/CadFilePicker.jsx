import { useRef, useState } from 'react';
import { CheckCircle2, FileBox, Loader2, Upload, X } from 'lucide-react';
import { Button, IconButton } from '../../../components/admin/ui';

const cx = (...parts) => parts.filter(Boolean).join(' ');
const CAD_ACCEPT = '.step,.stp,.dxf';
const sizeText = (bytes) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * Drop or choose one CAD file (STEP, STP or DXF). file: { name, size,
 * status: 'uploading' | 'ready' | 'error', error } or null. onPick(File),
 * onClear(). Candidate for the kit as a general file drop.
 */
export default function CadFilePicker({ file, onPick, onClear, disabled }) {
    const inputRef = useRef(null);
    const [over, setOver] = useState(false);
    const choose = () => inputRef.current?.click();
    const take = (files) => { const f = files?.[0]; if (f) onPick(f); };

    return (
        <div
            onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) take(e.dataTransfer.files); }}
        >
            <input ref={inputRef} type="file" accept={CAD_ACCEPT} hidden onChange={e => { take(e.target.files); e.target.value = ''; }} />
            {file ? (
                <div className={cx('ck-file', file.status === 'error' && 'is-error')}>
                    <span className="ck-file-icon" aria-hidden="true">
                        {file.status === 'uploading' ? <Loader2 size={20} className="ak-spin" /> : file.status === 'ready' ? <CheckCircle2 size={20} /> : <FileBox size={20} />}
                    </span>
                    <span className="ck-file-text">
                        <span className="ak-cell-main">{file.name}</span>
                        <span className="ak-cell-sub">
                            {file.status === 'uploading' ? 'Uploading…' : file.status === 'error' ? file.error : `${sizeText(file.size)} · uploaded`}
                        </span>
                    </span>
                    <Button size="sm" icon={Upload} onClick={choose} disabled={disabled}>Replace</Button>
                    <IconButton icon={X} label="Remove the file" size="xs" onClick={onClear} disabled={disabled} />
                </div>
            ) : (
                <button type="button" className={cx('ak-dropzone', over && 'is-over')} onClick={choose} disabled={disabled}>
                    <FileBox size={24} aria-hidden="true" />
                    <span className="ak-cell-main">Drop a CAD file or click to choose</span>
                    <span className="ak-hint">STEP, STP or DXF. The server measures it the same way it does for orders.</span>
                </button>
            )}
        </div>
    );
}
