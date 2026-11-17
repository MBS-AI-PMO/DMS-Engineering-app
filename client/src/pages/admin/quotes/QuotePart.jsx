import { Suspense, lazy, useMemo, useState } from 'react';
import { AlertTriangle, Box, Download, Eye, FileBox, FileWarning, MessageSquare } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { Banner, Button, Card, KeyValue, Modal } from '../../../components/admin/ui';
import { quotesService } from '../../../services/admin/quotes';
import { fileSize, outlinePath, partRows } from './quoteFormat';

// three.js is heavy: load the viewer only when a preview is opened.
const ProjectViewer = lazy(() => import('../../../components/viewer/ProjectViewer'));

const isStep = (file) => /^(STEP|STP)$/.test(file?.ext || '');

function Outline({ cutEdges, name }) {
    const outline = useMemo(() => outlinePath(cutEdges), [cutEdges]);
    if (!outline) return <div className="aq-thumb is-empty" aria-hidden="true"><Box size={26} /></div>;
    return (
        <div className="aq-thumb">
            <svg viewBox={outline.viewBox} role="img" aria-label={`Flat outline of ${name}`} preserveAspectRatio="xMidYMid meet">
                <path d={outline.d} fill="none" stroke="currentColor" strokeWidth={outline.stroke} strokeLinecap="round" />
            </svg>
        </div>
    );
}

/**
 * The part the customer asked about: outline, file (download and 3D
 * preview), what they chose, why the site could not price it, and their
 * notes.
 */
export default function QuotePart({ quote, file }) {
    const toast = useToast();
    const [previewing, setPreviewing] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const cfg = quote.configuration || {};
    const reasons = quote.reasons || [];

    const download = async () => {
        setDownloading(true);
        try { await quotesService.downloadFile(quote.id, file?.name || quote.file_name); } catch (err) { toast(err.message, 'error'); } finally { setDownloading(false); }
    };

    return (
        <Card title="Part" icon={FileBox} subtitle={`${quote.quantity} pcs requested`}>
            <div className="aq-part">
                <Outline cutEdges={quote.pricing_input?.technical_data?.cutEdges} name={quote.file_name} />
                <div className="aq-part-main">
                    <div className={`aq-file${file?.exists ? '' : ' is-missing'}`}>
                        <span className="aq-file-ext">{file?.ext || 'FILE'}</span>
                        <span className="aq-file-text">
                            <span className="aq-file-name" title={quote.file_name}>{quote.file_name || 'No file'}</span>
                            <span className="ak-hint">{file?.exists ? `${fileSize(file.size)} · customer's file` : 'Missing on the server'}</span>
                        </span>
                        {file?.exists ? (
                            <span className="ak-row-actions">
                                {isStep(file) && <Button size="sm" icon={Eye} onClick={() => setPreviewing(true)}>Preview 3D</Button>}
                                <Button size="sm" icon={Download} loading={downloading} onClick={download}>Download</Button>
                            </span>
                        ) : <FileWarning size={16} className="aq-missing-icon" aria-hidden="true" />}
                    </div>
                    <KeyValue items={partRows(cfg)} />
                </div>
            </div>

            {reasons.length > 0 && (
                <div className="aq-reasons" role="note">
                    <p className="aq-reasons-title"><AlertTriangle size={14} aria-hidden="true" /> Why there was no instant price</p>
                    <ul>{reasons.map((r, i) => <li key={`${r.code}-${i}`}>{r.message} <span className="aq-code">{r.code}</span></li>)}</ul>
                </div>
            )}

            {quote.message && (
                <div className="aq-message">
                    <p className="aq-message-title"><MessageSquare size={14} aria-hidden="true" /> Notes from the customer</p>
                    <p className="aq-message-text">{quote.message}</p>
                </div>
            )}

            {!file?.exists && quote.file_name && (
                <Banner tone="warn">The customer's file is not on the server any more. Ask them to send it again.</Banner>
            )}

            {previewing && file?.exists && (
                <Modal
                    size="xl"
                    title={quote.file_name}
                    subtitle="The customer's uploaded model"
                    onClose={() => setPreviewing(false)}
                    footer={<Button icon={Download} loading={downloading} onClick={download}>Download {file.ext}</Button>}
                >
                    <div className="aq-viewer">
                        <Suspense fallback={<div className="aq-viewer-loading">Loading the 3D viewer…</div>}>
                            <ProjectViewer file={{ name: quote.file_name, path: file.url }} tempPath={file.url} configuration={{}} />
                        </Suspense>
                    </div>
                </Modal>
            )}
        </Card>
    );
}
