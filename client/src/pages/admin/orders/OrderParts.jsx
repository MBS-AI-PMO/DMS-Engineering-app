import { Suspense, lazy, useMemo, useState } from 'react';
import { Box, ChevronDown, Download, Eye, FileWarning, Layers } from 'lucide-react';
import { Button, Card, IconButton, Modal } from '../../../components/admin/ui';
import { BUCKET_LABEL, costView, dateText, fileSize, money, outlinePath, partDetails, percent } from './orderFormat';

// three.js is heavy: load the viewer only when a preview is opened.
const ProjectViewer = lazy(() => import('../../../components/viewer/ProjectViewer'));

function Outline({ cfg, name }) {
    const outline = useMemo(() => outlinePath(cfg?.pricingTechnicalData?.cutEdges), [cfg]);
    if (!outline) {
        return (
            <div className="ao-part-thumb is-empty" aria-hidden="true">
                <Box size={28} />
            </div>
        );
    }
    return (
        <div className="ao-part-thumb">
            <svg viewBox={outline.viewBox} role="img" aria-label={`Flat outline of ${name}`} preserveAspectRatio="xMidYMid meet">
                <path d={outline.d} fill="none" stroke="currentColor" strokeWidth={outline.stroke} strokeLinecap="round" />
            </svg>
        </div>
    );
}

function Spec({ label, children }) {
    if (children === null || children === undefined || children === '' || (Array.isArray(children) && !children.length)) return null;
    return (
        <div className="ao-spec">
            <dt>{label}</dt>
            <dd>{children}</dd>
        </div>
    );
}

const counted = (list) => list.map(x => `${x.name}${x.count > 1 ? ` ×${x.count}` : ''}`).join(', ');

/* What the part cost the shop and what it earned: always shown as a strip,
 * with every operation's cost, markup and price one click away. */
function CostProfit({ item }) {
    const [open, setOpen] = useState(false);
    const v = costView(item);
    if (!v.known) {
        return (
            <div className="ao-profit is-unknown">
                <span className="ao-profit-note">
                    Cost not available{v.reasons.length ? `: ${v.reasons.map(r => r.message).join(' ')}` : '.'}
                </span>
            </div>
        );
    }
    const loss = v.profit < 0;
    return (
        <div className={`ao-profit${open ? ' is-open' : ''}`}>
            <dl className="ao-profit-strip">
                <div><dt>Customer paid</dt><dd>{money(v.paid)}</dd></div>
                <div><dt>Cost</dt><dd>{money(v.cost)}</dd></div>
                <div className={loss ? 'is-loss' : 'is-gain'}><dt>Profit</dt><dd>{money(v.profit)}</dd></div>
                <div className={loss ? 'is-loss' : 'is-gain'}><dt>Margin</dt><dd>{percent(v.margin)}</dd></div>
            </dl>
            {v.source === 'estimate' && (
                <p className="ao-fine">Estimate: this order was placed before costs were saved, so the cost is worked out with today&apos;s rules from the part details saved with it.</p>
            )}
            <button type="button" className="ao-breakdown-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
                <Layers size={14} aria-hidden="true" /> {open ? 'Hide' : 'Show'} the cost of each step
                <ChevronDown size={14} aria-hidden="true" className="ao-chev" />
            </button>
            {open && (
                <div className="ao-breakdown-body">
                    <div className="ao-mini-scroll">
                        <table className="ao-mini-table ao-cost-table">
                            <thead>
                                <tr><th scope="col">Step</th><th scope="col">Cost</th><th scope="col">Markup</th><th scope="col">Price</th></tr>
                            </thead>
                            <tbody>
                                {v.ops.map((op, i) => (
                                    <tr key={i}>
                                        <th scope="row">{op.name}<span className="ao-bucket">{BUCKET_LABEL[op.bucket] || op.bucket}</span></th>
                                        <td>{money(op.cost)}</td>
                                        <td className="is-gain">{money(op.markup)}</td>
                                        <td>{money(op.price)}</td>
                                    </tr>
                                ))}
                                <tr className="is-total">
                                    <th scope="row">Total ({Number(item.quantity) || 1} pcs)</th>
                                    <td>{money(v.cost)}</td>
                                    <td className="is-gain">{money(v.ops.reduce((s, o) => s + o.markup, 0))}</td>
                                    <td>{money(v.ops.reduce((s, o) => s + o.price, 0))}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <table className="ao-mini-table ao-markup-table">
                        <tbody>
                            {v.markups.map((m, i) => (
                                <tr key={i}>
                                    <th scope="row">{m.name} <span className="ao-bucket">{m.percent}% of {money(m.baseCost)}</span></th>
                                    <td className="is-gain">{money(m.totalCost)}</td>
                                </tr>
                            ))}
                            {v.addOns > 0 && <tr><th scope="row">Add-ons</th><td className="is-gain">{money(v.addOns)}</td></tr>}
                            {v.discount > 0 && <tr><th scope="row">Quantity discount</th><td className="is-loss">−{money(v.discount)}</td></tr>}
                            {v.source === 'estimate' && Math.abs(v.rulePrice - v.paid) >= 0.01 && (
                                <tr><th scope="row">Today&apos;s rules would charge</th><td>{money(v.rulePrice)}</td></tr>
                            )}
                        </tbody>
                    </table>
                    <p className="ao-fine">
                        {v.source === 'checkout' ? `Costs saved by the server at checkout${v.pricedAt ? ` on ${dateText(v.pricedAt, true)}` : ''}.` : "Worked out just now with today's rules."}
                        {' '}Markups on a cost group are shared over its steps; overhead and general markups over all steps.
                    </p>
                </div>
            )}
        </div>
    );
}

function PartCard({ item, index, total, onPreview }) {
    const cfg = item.configuration || {};
    const d = partDetails(cfg);
    const qty = Number(item.quantity) || 1;
    const line = item.line_total !== null && item.line_total !== undefined ? Number(item.line_total) : Number(item.unit_price) * qty;
    const stepFiles = item.files.filter(f => f.exists && /^(STEP|STP|IGES|IGS)$/.test(f.ext));

    return (
        <article className="ao-part">
            <div className="ao-part-visual">
                <Outline cfg={cfg} name={item.file_name} />
                {stepFiles.length > 0 && (
                    <div className="ao-part-views">
                        {stepFiles.map(f => (
                            <Button key={f.kind} size="sm" icon={Eye} onClick={() => onPreview(item, f)}>
                                {f.kind === 'original' ? 'Customer model' : '3D finished'}
                            </Button>
                        ))}
                    </div>
                )}
            </div>

            <div className="ao-part-body">
                <header className="ao-part-head">
                    <div className="ao-part-title">
                        <span className="ao-part-index">Part {index + 1}{total > 1 ? ` of ${total}` : ''}</span>
                        <h3 title={item.file_name}>{item.file_name}</h3>
                        <p className="ao-part-line">{[d.material, d.thickness, d.process].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div className="ao-part-money">
                        <span className="ao-qty">{qty} pcs</span>
                        <span className="ao-each">× {money(item.unit_price)}</span>
                        <strong>{money(line)}</strong>
                    </div>
                </header>

                <dl className="ao-specs">
                    <Spec label="Material">{d.material}</Spec>
                    <Spec label="Thickness">{d.thickness}</Spec>
                    <Spec label="Process">{d.process}</Spec>
                    <Spec label="Flat size">{d.size ? <>{d.size}<span className="ao-dim">{d.sizeMm}</span></> : null}</Spec>
                    <Spec label="Flat area">{d.flatArea}</Spec>
                    <Spec label="Cut length">{d.cutLength}</Spec>
                    <Spec label="Holes / pierces">{d.holes !== null || d.pierces !== null ? `${d.holes ?? '—'} holes · ${d.pierces ?? '—'} pierces` : null}</Spec>
                    <Spec label="Bends">{d.bends ? String(d.bends) : 'None (flat part)'}</Spec>
                    <Spec label="Finishing">
                        {d.finishes.length ? d.finishes.map((f, i) => (
                            <span key={i} className="ao-finish">
                                {f.swatch && <span className="ao-swatch" style={{ background: f.swatch }} aria-hidden="true" />}
                                {f.title}{f.color ? ` (${f.color})` : ''}
                            </span>
                        )) : null}
                    </Spec>
                    <Spec label="Anodizing">{d.anodize}</Spec>
                    <Spec label="Tapped holes">{d.taps.length ? counted(d.taps) : null}</Spec>
                    <Spec label="Countersinks">{d.countersinks.length ? counted(d.countersinks) : null}</Spec>
                    <Spec label="Hardware">{d.hardware.length ? counted(d.hardware) : null}</Spec>
                </dl>

                <div className="ao-files">
                    {item.files.map(f => (
                        <div key={f.kind} className={`ao-file${f.exists ? '' : ' is-missing'}`}>
                            <span className="ao-file-ext">{f.ext || 'FILE'}</span>
                            <span className="ao-file-text">
                                <span className="ao-file-label">{f.label}</span>
                                <span className="ao-file-meta">{f.exists ? fileSize(f.size) : 'Missing on the server'}</span>
                            </span>
                            {f.exists ? (
                                <span className="ak-row-actions">
                                    {/^(STEP|STP|IGES|IGS)$/.test(f.ext) && (
                                        <IconButton icon={Eye} label={`Preview ${f.label} in 3D`} onClick={() => onPreview(item, f)} />
                                    )}
                                    <IconButton icon={Download} label={`Download ${f.label}`} href={f.url} download={f.kind === 'original' ? item.file_name : f.name} />
                                </span>
                            ) : <FileWarning size={16} className="ao-missing-icon" aria-hidden="true" />}
                        </div>
                    ))}
                    {!item.files.length && <p className="ao-fine">No files were saved with this part.</p>}
                </div>

                <CostProfit item={item} />
            </div>
        </article>
    );
}

export default function OrderParts({ items }) {
    const [preview, setPreview] = useState(null); // { item, file }
    const pieces = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);

    return (
        <Card id="ao-parts" title="Parts" count={`${items.length} ${items.length === 1 ? 'file' : 'files'} · ${pieces} pcs`}>
            <div className="ao-parts">
                {items.map((item, i) => <PartCard key={item.id} item={item} index={i} total={items.length} onPreview={(it, file) => setPreview({ item: it, file })} />)}
                {!items.length && <p className="ao-fine">This order has no parts.</p>}
            </div>

            {preview && (
                <Modal
                    size="xl"
                    title={preview.item.file_name}
                    subtitle={preview.file.kind === 'original' ? "The customer's uploaded model" : 'Manufacturing model with the chosen options'}
                    onClose={() => setPreview(null)}
                    footer={<Button href={preview.file.url} download icon={Download}>Download {preview.file.ext}</Button>}
                >
                    <div className="ao-viewer">
                        <Suspense fallback={<div className="ao-viewer-loading">Loading the 3D viewer…</div>}>
                            <ProjectViewer
                                file={{ name: preview.item.file_name, path: preview.file.url }}
                                tempPath={preview.item.files.find(f => f.kind === 'original')?.url || null}
                                configuration={preview.file.kind === 'original' ? {} : (preview.item.configuration || {})}
                            />
                        </Suspense>
                    </div>
                </Modal>
            )}
        </Card>
    );
}
