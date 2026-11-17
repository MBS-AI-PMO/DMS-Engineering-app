import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Calculator, RotateCcw } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { Banner, Button, Card, Page, PageHeader, Segmented, Skeleton, SkeletonRows, useConfirm } from '../../../components/admin/ui';
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
 * Admin > Costing (/admin/costing/:tab): the shop's costing rules, the same
 * ones Zamyr quotes with — sheet sizes and costs, laser rates, operations,
 * markups, add-ons and which service uses which — plus a calculator to try
 * a price. Every price on the website comes from these.
 *
 * The page loads everything once (costingService.config) and hands each tab
 * { config, reload, toast, confirm, onDirtyChange }. A tab with unsaved
 * edits reports them, and leaving it asks first.
 */

const TABS = [
    { value: 'overview', label: 'Overview', Tab: OverviewTab },
    { value: 'operations', label: 'Operations', Tab: OperationsTab },
    { value: 'services', label: 'Services', Tab: ServicesTab },
    { value: 'sheet-sizes', label: 'Sheet sizes', Tab: SheetSizesTab },
    { value: 'sheet-costs', label: 'Sheet costs', Tab: SheetCostsTab },
    { value: 'laser-rates', label: 'Laser rates', Tab: LaserRatesTab },
    { value: 'markups', label: 'Markups', Tab: MarkupsTab },
    { value: 'add-ons', label: 'Add-ons', Tab: AddOnsTab },
    { value: 'materials', label: 'Material families', Tab: MaterialFamiliesTab },
];

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
    const tabs = (
        <nav className="ck-tabs" aria-label="Costing sections">
            <Segmented items={TABS} value={active.value} onChange={goTo} label="Costing sections" />
        </nav>
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
