import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Calculator, Cog, DollarSign, Layers, LayoutDashboard, Maximize2, PackagePlus, Percent, RotateCcw, Wrench, Zap } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { Banner, Button, Card, Page, PageHeader, PageTabs, Skeleton, SkeletonRows, useConfirm } from '../../../components/admin/ui';
import { costingService } from '../../../services/admin/costing';
import OverviewTab from './OverviewTab';
import OperationsTab from './OperationsTab';
import ServicesTab from './ServicesTab';
import SheetSizesTab from './SheetSizesTab';
import SheetCostsTab from './SheetCostsTab';
import LaserRatesTab from './LaserRatesTab';
import MarkupsTab from './MarkupsTab';
import AddOnsTab from './AddOnsTab';
import MaterialFamiliesTab from './MaterialFamiliesTab';
import './costing.css';

/**
 * Admin > Costing (/admin/costing/:tab): the shop's costing rules — sheet
 * sizes and costs, laser rates, operations, markups, add-ons and which
 * service uses which — plus a calculator to try a price (typed sizes or a
 * real CAD file). Every price on the website comes from these.
 *
 * The page loads everything once (costingService.config) and hands each tab
 * { config, reload, toast, confirm, onDirtyChange }. A tab with unsaved
 * edits reports them, and leaving it asks first.
 */

// count(config): the number shown on the tab once the set-up has loaded.
const TABS = [
    { value: 'overview', label: 'Overview', icon: LayoutDashboard, Tab: OverviewTab },
    { value: 'operations', label: 'Operations', icon: Cog, Tab: OperationsTab, count: c => c.operations?.length },
    { value: 'services', label: 'Services', icon: Wrench, Tab: ServicesTab, count: c => c.services?.length },
    { value: 'sheet-sizes', label: 'Sheet sizes', icon: Maximize2, Tab: SheetSizesTab, count: c => c.sheetSizes?.length },
    { value: 'sheet-costs', label: 'Sheet costs', icon: DollarSign, Tab: SheetCostsTab, count: c => c.sheetCosts?.length },
    { value: 'laser-rates', label: 'Laser rates', icon: Zap, Tab: LaserRatesTab, count: c => c.laserRates?.length },
    { value: 'markups', label: 'Markups', icon: Percent, Tab: MarkupsTab, count: c => c.markups?.length },
    { value: 'add-ons', label: 'Add-ons', icon: PackagePlus, Tab: AddOnsTab, count: c => c.addOns?.length },
    { value: 'materials', label: 'Material families', icon: Layers, Tab: MaterialFamiliesTab },
];

/* Sheet cost rows with no price for the default sheet size (they make parts ask for a quote). */
const unpricedSheetCosts = (config) => {
    const size = config.sheetSizes?.find(s => s.is_default) || config.sheetSizes?.[0];
    return size ? (config.sheetCosts || []).filter(r => !(Number(r.prices?.[size.id]) > 0)).length : 0;
};

const HEADER = {
    icon: Calculator,
    title: 'Costing',
    subtitle: 'The rates every price on the website is worked out from. A change applies to the next price.',
};

export default function CostingAdmin() {
    const { tab = 'overview' } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const [confirm, confirmDialog] = useConfirm();
    const [config, setConfig] = useState(null);
    const [error, setError] = useState('');
    const [dirty, setDirty] = useState(0);

    const load = useCallback(() => costingService.config()
        .then(data => { setConfig(data); setError(''); })
        .catch(err => setError(err.message)), []);

    useEffect(() => { load(); }, [load]);

    // After a save: fresh data; a failed reload keeps the page and says so.
    const reload = useCallback(async () => {
        try {
            setConfig(await costingService.config());
        } catch (err) {
            toast(`Saved, but the page could not refresh: ${err.message}`, 'warning');
        }
    }, [toast]);

    const active = TABS.find(t => t.value === tab) || TABS[0];

    const goTo = async (value) => {
        if (value === active.value) return;
        if (dirty) {
            const leave = await confirm({
                title: 'Leave without saving?',
                message: `${dirty === 1 ? 'One change' : `${dirty} changes`} on ${active.label} ${dirty === 1 ? 'is' : 'are'} not saved and will be lost.`,
                confirmLabel: 'Discard changes',
                danger: true,
            });
            if (!leave) return;
            setDirty(0);
        }
        navigate(`/admin/costing/${value}`);
    };

    const ctx = useMemo(() => ({ config, reload, toast, confirm, onDirtyChange: setDirty }), [config, reload, toast, confirm]);
    const tabItems = useMemo(() => TABS.map(({ value, label, icon, count }) => {
        if (!config) return { value, label, icon };
        const unpriced = value === 'sheet-costs' ? unpricedSheetCosts(config) : 0;
        return { value, label, icon, count: count?.(config), alert: unpriced ? `${unpriced} unpriced` : undefined };
    }), [config]);
    const tabs = (
        <div className="ck-tabs">
            <PageTabs items={tabItems} value={active.value} onChange={goTo} label="Costing sections" />
        </div>
    );

    if (error && !config) {
        return (
            <Page>
                <PageHeader {...HEADER} />
                <Banner tone="error" action={<Button size="sm" icon={RotateCcw} onClick={load}>Try again</Button>}>
                    Could not load the costing set-up: {error}
                </Banner>
            </Page>
        );
    }

    if (!config) {
        return (
            <Page busy>
                <PageHeader {...HEADER} />
                {tabs}
                <Card>
                    <Skeleton width="40%" size="lg" />
                    <table className="ak-table"><tbody><SkeletonRows rows={6} columns={5} /></tbody></table>
                </Card>
            </Page>
        );
    }

    const { Tab } = active;
    return (
        <Page className="ck-page">
            <PageHeader {...HEADER} />
            {tabs}
            <Tab key={active.value} {...ctx} />
            {confirmDialog}
        </Page>
    );
}
