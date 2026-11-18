import { useRef, useState } from 'react';
import { ExternalLink, ImagePlus, Monitor, Smartphone, Trash2, Upload } from 'lucide-react';
import { Button, Card, IconButton, Pill } from '../../../components/admin/ui';

const changedOn = (when) => (when ? new Date(when).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const px = ([w, h]) => `${w} × ${h} px`;

/**
 * One page's hero picture, drawn in the exact shape the page shows it
 * (desktop and phone, cropped the same way), with the exact size to make it.
 *
 * slot: { title, href, size: [w, h], phone: [w, h], position, note?, src, custom, updatedAt, defaultLabel }
 * Choosing or dropping a file calls onUpload(file); onRemove goes back to the built-in picture.
 */
export default function HeroCard({ slot, busy, onUpload, onRemove }) {
    const inputRef = useRef(null);
    const [over, setOver] = useState(false);
    const [natural, setNatural] = useState(null); // [w, h] of the picture shown
    const { size, phone, position, src } = slot;

    const pick = () => inputRef.current?.click();
    const take = (files) => { const file = files?.[0]; if (file) onUpload(file); };
    const small = natural && (natural[0] < size[0] || natural[1] < size[1]);
    const subtitle = slot.custom
        ? (slot.updatedAt ? `Changed ${changedOn(slot.updatedAt)}` : 'Your picture')
        : slot.defaultLabel;

    return (
        <Card
            className="ahs-card"
            title={slot.title}
            subtitle={subtitle}
            actions={(
                <>
                    {slot.custom ? <Pill tone="green" dot>Custom</Pill> : <Pill dot>Built-in</Pill>}
                    <IconButton icon={ExternalLink} size="xs" label={`Open ${slot.title}`} href={slot.href} target="_blank" rel="noreferrer" />
                </>
            )}
        >
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={e => { take(e.target.files); e.target.value = ''; }} />

            <div
                className={`ahs-previews${over ? ' is-over' : ''}${busy ? ' is-busy' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy) take(e.dataTransfer.files); }}
            >
                <figure className="ahs-shot">
                    <button type="button" className="ahs-frame" style={{ aspectRatio: `${size[0]} / ${size[1]}` }} onClick={pick} disabled={busy} aria-label={`Replace the ${slot.title} picture`}>
                        {src ? (
                            <img
                                src={src}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                style={{ objectPosition: position }}
                                onLoad={(e) => setNatural([e.currentTarget.naturalWidth, e.currentTarget.naturalHeight])}
                            />
                        ) : <ImagePlus size={22} aria-hidden="true" />}
                        <span className="ahs-drop" aria-hidden="true">{busy ? 'Uploading…' : 'Drop a picture to replace'}</span>
                    </button>
                    <figcaption><Monitor size={12} aria-hidden="true" /> Desktop</figcaption>
                </figure>
                <figure className="ahs-shot is-phone">
                    <div className="ahs-frame" style={{ aspectRatio: `${phone[0]} / ${phone[1]}` }}>
                        {src && <img src={src} alt="" loading="lazy" decoding="async" style={{ objectPosition: position }} />}
                    </div>
                    <figcaption><Smartphone size={12} aria-hidden="true" /> Phone</figcaption>
                </figure>
            </div>

            <dl className="ahs-specs">
                <div className="is-exact">
                    <dt>Exact size</dt>
                    <dd>{px(size)}</dd>
                </div>
                <div>
                    <dt>On phones</dt>
                    <dd>{px(phone)}</dd>
                </div>
                <div>
                    <dt>This picture</dt>
                    <dd>
                        {natural ? px(natural) : '…'}
                        {small && <Pill tone="amber">Smaller than exact size</Pill>}
                    </dd>
                </div>
            </dl>
            {slot.note && <p className="ahs-note">{slot.note}</p>}

            <div className="ak-row-actions">
                <Button size="sm" icon={Upload} onClick={pick} loading={busy}>Replace</Button>
                {slot.custom && onRemove && (
                    <IconButton icon={Trash2} label={`Remove the ${slot.title} picture`} variant="danger" size="xs" onClick={onRemove} disabled={busy} />
                )}
            </div>
        </Card>
    );
}
