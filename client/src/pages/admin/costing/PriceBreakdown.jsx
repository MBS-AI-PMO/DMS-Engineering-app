import { AlertTriangle } from 'lucide-react';
import { Banner, DataTable, KeyValue } from '../../../components/admin/ui';
import { bucketLabel, money } from './costingFormat';

const working = (details) => Object.entries(details || {})
    .map(([k, v]) => `${k}: ${typeof v === 'number' ? Math.round(v * 10000) / 10000 : v}`)
    .join(' · ');

const OP_COLUMNS = [
    { key: 'name', header: 'Operation', render: (op) => <span className="ak-cell-main">{op.name}</span> },
    { key: 'bucket', header: 'Cost goes to', render: (op) => bucketLabel(op.bucket) },
    { key: 'totalCost', header: 'Cost', align: 'right', render: (op) => money(op.totalCost) },
    { key: 'priceAfterMarkups', header: 'With markups', align: 'right', render: (op) => money(op.priceAfterMarkups) },
    { key: 'details', header: 'Working', hideBelow: 1100, render: (op) => <span className="ck-working">{working(op.details)}</span> },
];

/**
 * The calculator's answer: the price (or why it needs a quote), each
 * operation's cost and the totals with every markup and add-on.
 */
export default function PriceBreakdown({ result: r }) {
    const totals = r.totals;
    return (
        <div className="ck-breakdown" aria-live="polite">
            {r.status !== 'priced' ? (
                <Banner tone="warn">
                    <strong><AlertTriangle size={15} aria-hidden="true" className="ck-inline-icon" /> Customers would be asked to request a quote.</strong>
                    <ul className="ck-reasons">{r.reasons.map((x, i) => <li key={i}>{x.message}</li>)}</ul>
                </Banner>
            ) : (
                <p className="ck-total">
                    {money(totals.finalTotal)} <span>for {r.qty} ({money(totals.finalUnitPrice)} each)</span>
                </p>
            )}

            <DataTable
                caption="Operations"
                columns={OP_COLUMNS}
                rows={r.operations}
                rowKey={(op) => `${op.id}-${op.serviceId}`}
                empty={<p className="ck-empty">No operations ran.</p>}
            />

            <div className="ck-totals">
                <KeyValue
                    items={[
                        ['Material', money(totals.materialCost)],
                        ['Operations', money(totals.operationCost)],
                        ['Cost before markups', <strong key="c">{money(totals.totalEstimatedCost)}</strong>],
                        ...r.markups.map(m => [`${m.name} (${m.percent}% ${m.calcType} on ${money(m.baseCost)})`, money(m.totalCost)]),
                        ...r.addOns.map(a => [a.name, money(a.totalCost)]),
                        ['Line total', <strong key="t">{money(totals.subtotal)}</strong>],
                        ...(totals.discountAmount > 0 ? [[`Quantity discount ${totals.discountPercent}%`, `−${money(totals.discountAmount)}`]] : []),
                    ]}
                />
            </div>
            {r.warnings.length > 0 && <p className="ak-hint">Notes: {r.warnings.join(' ')}</p>}
        </div>
    );
}
