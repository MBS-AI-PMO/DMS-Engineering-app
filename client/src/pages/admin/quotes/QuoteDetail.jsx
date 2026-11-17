import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Download, FileQuestion, Mail, Trash2 } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import {
    Banner, Button, Card, EmptyState, IconButton, Page, PageHeader, Pill, SideLayout, Skeleton, useConfirm,
} from '../../../components/admin/ui';
import { quotesService } from '../../../services/admin/quotes';
import QuotePart from './QuotePart';
import QuoteReply from './QuoteReply';
import QuoteStatus from './QuoteStatus';
import QuoteCustomer from './QuoteCustomer';
import QuoteActivity from './QuoteActivity';
import { ago, dateText, statusMeta, statusTone } from './quoteFormat';
import './adminQuotes.css';

/**
 * One quote request: the part (specs, why it had no instant price, the
 * customer's file with download and 3D preview), the reply form (price,
 * quantity, lead time, message, emailed to the customer), status, the
 * customer, and the activity log (emails included, sent or not).
 */

const BACK = { to: '/admin/quotes', label: 'All quote requests' };

function LoadingView() {
    return (
        <Page busy>
            <PageHeader back={BACK} icon={FileQuestion} title={<Skeleton width={220} size="lg" />} subtitle={<Skeleton width={320} />} />
            <SideLayout
                main={<><Card><Skeleton size="block" /></Card><Card><Skeleton size="block" /></Card></>}
                side={<><Card><Skeleton size="block" /></Card><Card><Skeleton size="block" /></Card></>}
            />
        </Page>
    );
}

export default function QuoteDetail() {
    const { id } = useParams();
    const toast = useToast();
    const navigate = useNavigate();
    const [confirm, confirmDialog] = useConfirm();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null); // { message, status }
    const [working, setWorking] = useState('');

    const load = useCallback(() => quotesService.detail(id)
        .then(d => { setData(d); setError(null); })
        .catch(err => setError({ message: err.message, status: err.status })), [id]);

    useEffect(() => { load(); }, [load]);

    if (error && !data) {
        return (
            <Page>
                <PageHeader back={BACK} icon={FileQuestion} title="Quote request" />
                {error.status === 404 ? (
                    <Card><EmptyState icon={FileQuestion} title="This quote request does not exist" action={<Button to="/admin/quotes">All quote requests</Button>}>It may have been deleted.</EmptyState></Card>
                ) : (
                    <Banner tone="error" action={<Button size="sm" onClick={load}>Try again</Button>}>{error.message}</Banner>
                )}
            </Page>
        );
    }
    if (!data) return <LoadingView />;

    const { quote, file, account, events } = data;

    const download = async () => {
        setWorking('download');
        try { await quotesService.downloadFile(quote.id, file?.name || quote.file_name); } catch (err) { toast(err.message, 'error'); } finally { setWorking(''); }
    };
    const remove = async () => {
        if (!(await confirm({
            title: `Delete quote request ${quote.reference}?`,
            message: 'The request, its file and its activity are removed for good. The customer is not told.',
            confirmLabel: 'Delete',
            danger: true,
        }))) return;
        setWorking('delete');
        try {
            await quotesService.remove(quote.id);
            toast(`${quote.reference} deleted`, 'success');
            navigate('/admin/quotes');
        } catch (err) { toast(err.message, 'error'); setWorking(''); }
    };

    return (
        <Page>
            <PageHeader
                back={BACK}
                icon={FileQuestion}
                eyebrow={`Requested ${dateText(quote.created_at, true)} · ${ago(quote.created_at)}`}
                title={<>Quote {quote.reference} <Pill tone={statusTone(quote.status)} dot>{statusMeta(quote.status).label}</Pill></>}
                subtitle={<>{quote.file_name} · {quote.quantity} pcs · {quote.name || quote.email}{quote.company ? `, ${quote.company}` : ''}</>}
                actions={(
                    <>
                        <Button icon={Mail} href={`mailto:${quote.email}?subject=${encodeURIComponent(`Your quote request ${quote.reference}`)}`}>Email customer</Button>
                        {file?.exists && <Button icon={Download} loading={working === 'download'} onClick={download}>Download file</Button>}
                        <IconButton icon={Trash2} label="Delete quote request" variant="danger" loading={working === 'delete'} onClick={remove} />
                    </>
                )}
            />

            {error && <Banner tone="error" action={<Button size="sm" onClick={load}>Try again</Button>}>{error.message}</Banner>}

            <SideLayout
                main={(
                    <>
                        <QuotePart quote={quote} file={file} />
                        <QuoteReply key={quote.answer?.quoted_at || 'new'} quote={quote} onSent={load} />
                        <QuoteActivity quoteId={quote.id} events={events} onChanged={load} />
                    </>
                )}
                side={(
                    <>
                        <QuoteStatus key={quote.status} quote={quote} onSaved={load} />
                        <QuoteCustomer quote={quote} account={account} />
                    </>
                )}
            />
            {confirmDialog}
        </Page>
    );
}
