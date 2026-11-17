import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, FileCheck2, Filter, Upload } from 'lucide-react';
import { Banner, Button, Checkbox, SearchInput, Select, Toolbar } from '../../../components/admin/ui';
import { costingService } from '../../../services/admin/costing';
import EditableTable from './EditableTable';
import TabIntro from './TabIntro';
import { costingRowHandlers } from './costingRowHandlers';
import { metalOptions, plural, trimNumber } from './costingFormat';
import { downloadText, sheetCostsFromCsv, sheetCostsToCsv } from './sheetCostsCsv';

const priceKey = (sizeId) => `price_${sizeId}`;

/**
 * Sheet costs: what a full sheet costs, by material family and thickness
 * band, with one price per sheet size. A blank price means "not stocked in
 * that size"; a part matched to a row with no price on the default (★)
 * sheet goes to "request a quote" — those rows are tinted and counted, and
 * "Show only these" lists just them. The whole table can be exported to CSV
 * and replaced from a CSV (checked first with a dry run).
 */
export default function SheetCostsTab(ctx) {
    const { config, reload, toast, onDirtyChange } = ctx;
    const { sheetSizes, sheetCosts, metals } = config;
    const [params, setParams] = useSearchParams();
    const onlyMissing = params.get('show') === 'missing';
    const [query, setQuery] = useState('');
    const [family, setFamily] = useState('');
    const [pending, setPending] = useState(null);
    const [importing, setImporting] = useState(false);
    const [showOffSizes, setShowOffSizes] = useState(false);
    const fileRef = useRef(null);

    const defaultSize = sheetSizes.find(s => s.is_default);
    // No price (or $0) on the default sheet: parts matched to it ask for a quote.
    const needsPrice = (r) => Boolean(defaultSize) && !(Number(r.prices?.[defaultSize.id]) > 0);
    const missingIds = new Set(sheetCosts.filter(needsPrice).map(r => r.id));
    const missingCount = missingIds.size;

    const families = useMemo(() => [...new Set(sheetCosts.map(r => r.family)
        .concat(metals.map(m => m.costing_family || m.category)).filter(Boolean))].sort(), [sheetCosts, metals]);

    const rows = useMemo(() => sheetCosts.map(r => ({
        ...r,
        metal_id: r.metal_id ? String(r.metal_id) : '',
        min_thick: trimNumber(r.min_thick),
        max_thick: trimNumber(r.max_thick),
        thickness_in: trimNumber(r.thickness_in),
        ...Object.fromEntries(sheetSizes.map(s => [priceKey(s.id), r.prices?.[s.id] ?? ''])),
    })), [sheetCosts, sheetSizes]);

    const setOnlyMissing = (on) => setParams(p => {
        const next = new URLSearchParams(p);
        if (on) next.set('show', 'missing'); else next.delete('show');
        return next;
    }, { replace: true });

    const needle = query.trim().toLowerCase();
    const isVisible = (row) => (!onlyMissing || missingIds.has(row.id))
        && (!family || row.family === family)
        && (!needle || [row.family, row.ga, row.metal_name, trimNumber(row.min_thick), trimNumber(row.max_thick), trimNumber(row.thickness_in)]
            .some(v => v && String(v).toLowerCase().includes(needle)));

    const defaultKey = defaultSize ? priceKey(defaultSize.id) : null;
    // Switched-off sizes are not used for pricing; their prices stay saved and show on request.
    const offSizes = sheetSizes.filter(s => !s.is_active);
    const shownSizes = showOffSizes ? sheetSizes : sheetSizes.filter(s => s.is_active);
    const columns = [
        { key: 'family', label: 'Family', list: 'ck-families', width: 130 },
        { key: 'metal_id', label: 'Only for metal', type: 'select', options: metalOptions(metals, 'Any in family'), width: 140 },
        { key: 'ga', label: 'Gauge', width: 64 },
        { key: 'min_thick', label: 'Min (in)', type: 'number', width: 76 },
        { key: 'max_thick', label: 'Max (in)', type: 'number', width: 76 },
        { key: 'thickness_in', label: 'Exact (in)', type: 'number', width: 76, placeholder: 'or band' },
        ...shownSizes.map(s => ({
            key: priceKey(s.id),
            label: `${s.name}${s.is_default ? ' ★' : ''}${s.is_active ? '' : ' (off)'}`,
            type: 'number',
            width: 84,
            placeholder: s.is_default ? 'Add' : '—',
            inputClass: s.is_default ? (row) => (!(Number(row[defaultKey]) > 0) ? 'ck-needs-price' : undefined) : undefined,
        })),
    ];

    const toPayload = (row) => ({
        id: row.id,
        family: row.family,
        metal_id: row.metal_id || null,
        ga: row.ga,
        min_thick: row.min_thick,
        max_thick: row.max_thick,
        thickness_in: row.thickness_in,
        sort_order: row.sort_order ?? sheetCosts.length,
        prices: Object.fromEntries(sheetSizes.map(s => [s.id, row[priceKey(s.id)] === '' ? null : row[priceKey(s.id)]])),
    });

    const exportCsv = () => {
        downloadText(sheetCostsToCsv(sheetCosts, sheetSizes), `sheet-costs-${new Date().toISOString().slice(0, 10)}.csv`);
        toast(`Exported ${plural(sheetCosts.length, 'row')}`, 'success');
    };

    const readFile = async (file) => {
        try {
            const parsed = sheetCostsFromCsv(await file.text(), { sheetSizes, metals });
            const check = await costingService.importSheetCosts(parsed, true);
            setPending({ rows: parsed, count: check.rows, name: file.name });
        } catch (err) {
            toast(`Import not possible: ${err.message}`, 'error');
        } finally {
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const confirmImport = async () => {
        setImporting(true);
        try {
            await costingService.importSheetCosts(pending.rows, false);
            setPending(null);
            await reload();
            toast(`Imported ${plural(pending.count, 'sheet cost row')}`, 'success');
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            setImporting(false);
        }
    };

    return (
        <>
            <TabIntro
                title="Sheet costs"
                actions={(
                    <>
                        <Button icon={Download} onClick={exportCsv}>Export CSV</Button>
                        <Button icon={Upload} onClick={() => fileRef.current?.click()}>Import CSV</Button>
                        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={e => e.target.files?.[0] && readFile(e.target.files[0])} />
                    </>
                )}
            >
                A part&apos;s thickness matches a row when it is within the min–max band (or the exact thickness), give or take
                the tolerance set on the Material operation. ★ marks the default sheet, the one parts are priced on. If two
                rows match, the higher one in this list wins. A blank price means that size is not stocked.
            </TabIntro>

            {pending && (
                <Banner
                    action={(
                        <div className="ak-row-actions">
                            <Button size="sm" variant="primary" icon={FileCheck2} loading={importing} onClick={confirmImport}>Replace all rows</Button>
                            <Button size="sm" onClick={() => setPending(null)} disabled={importing}>Cancel</Button>
                        </div>
                    )}
                >
                    <strong>{pending.name}</strong> checks out: {plural(pending.count, 'row')}. Importing replaces
                    all {plural(sheetCosts.length, 'current row')}.
                </Banner>
            )}

            {defaultSize && (missingCount > 0 || onlyMissing) && (
                <Banner
                    tone="warn"
                    action={(
                        <Button size="sm" icon={Filter} onClick={() => setOnlyMissing(!onlyMissing)}>
                            {onlyMissing ? 'Show all rows' : 'Show only these'}
                        </Button>
                    )}
                >
                    {missingCount > 0
                        ? <><strong>{missingCount} {missingCount === 1 ? 'row has' : 'rows have'} no {defaultSize.name} price.</strong> Customers who pick these thicknesses are asked to request a quote until you enter a price and save the row.</>
                        : <>Every row has a {defaultSize.name} price.</>}
                </Banner>
            )}
            {!defaultSize && <Banner tone="warn">No default sheet is set. Make one the default on the Sheet sizes tab.</Banner>}

            <Toolbar
                left={(
                    <>
                        <Select
                            size="sm"
                            aria-label="Family"
                            value={family}
                            onChange={e => setFamily(e.target.value)}
                            options={[{ value: '', label: 'All families' }, ...families.map(f => ({ value: f, label: f }))]}
                        />
                        {offSizes.length > 0 && (
                            <Checkbox
                                checked={showOffSizes}
                                onChange={setShowOffSizes}
                                label={`Show switched-off sizes (${offSizes.map(s => s.name).join(', ')})`}
                            />
                        )}
                    </>
                )}
                right={<SearchInput value={query} onChange={setQuery} placeholder="Family, gauge, metal or thickness" label="Search sheet costs" />}
            />

            <datalist id="ck-families">{families.map(f => <option key={f} value={f} />)}</datalist>
            <EditableTable
                caption="Sheet costs"
                rows={rows}
                columns={columns}
                isVisible={isVisible}
                stickyFirst
                filteredText={onlyMissing && !missingCount ? 'Every row has a price.' : 'No rows match these filters.'}
                rowTone={(row) => (row.id && missingIds.has(row.id) ? 'warn' : undefined)}
                {...costingRowHandlers({
                    collection: 'sheet-costs',
                    label: 'Sheet cost',
                    ctx,
                    toPayload,
                    describe: (r) => ['the', r.family, r.ga, 'row'].filter(Boolean).join(' '),
                })}
                onDirtyChange={onDirtyChange}
                newRow={() => ({ family: family || '', metal_id: '', ga: '', min_thick: '', max_thick: '', thickness_in: '', ...Object.fromEntries(sheetSizes.map(s => [priceKey(s.id), ''])) })}
                addLabel="Add sheet cost"
                emptyText="No sheet costs yet. Add one, or import a CSV."
            />
        </>
    );
}
