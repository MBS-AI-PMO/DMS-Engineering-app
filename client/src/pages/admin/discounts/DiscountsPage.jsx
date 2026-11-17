import { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgePercent, Plus, RotateCcw } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { Banner, Button, Card, Page, PageHeader, Segmented, Stack, useConfirm } from '../../../components/admin/ui';
import { discountsService } from '../../../services/admin/discounts';
import DiscountsSwitch from './DiscountsSwitch';
import DiscountTiersTable from './DiscountTiersTable';
import DiscountTierDialog from './DiscountTierDialog';
import { topQuantity } from './discountFormat';
import './discounts.css';

const VIEWS = [{ value: 'ranges', label: 'Ranges' }, { value: 'each', label: 'Each quantity' }];

/**
 * Admin > Discounts (/admin/pricing): quantity discount tiers and the
 * site-wide switch that decides whether they apply. The switch is off by
 * the owner's decision; the page makes that state obvious and asks before
 * changing it.
 */
export default function DiscountsPage() {
    const toast = useToast();
    const [confirm, confirmDialog] = useConfirm();
    const [tiers, setTiers] = useState([]);
    const [enabled, setEnabled] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [view, setView] = useState('ranges');
    const [editing, setEditing] = useState(null); // null | 'new' | tier
    const [switching, setSwitching] = useState(false);
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(() => Promise.all([discountsService.list(), discountsService.isEnabled()])
        .then(([list, on]) => { setTiers(list || []); setEnabled(on); setError(''); })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false)), []);

    useEffect(() => { load(); }, [load]);

    const top = useMemo(() => topQuantity(tiers), [tiers]);
    const biggest = useMemo(() => Math.max(0, ...tiers.filter(t => t.is_active).map(t => Number(t.discount_percent))), [tiers]);

    const toggle = async (next) => {
        const yes = await confirm(next ? {
            title: 'Turn quantity discounts on?',
            message: `From the next price, customers get each active tier's percentage off${biggest ? ` (up to ${biggest}%)` : ''} on instant prices, the cart and checkout.`,
            confirmLabel: 'Turn on',
        } : {
            title: 'Turn quantity discounts off?',
            message: 'Customers pay the full price at every quantity. The tiers stay saved.',
            confirmLabel: 'Turn off',
            danger: true,
        });
        if (!yes) return;
        setSwitching(true);
        try {
            await discountsService.setEnabled(next);
            setEnabled(next);
            toast(next ? 'Quantity discounts are on' : 'Quantity discounts are off', 'success');
        } catch (err) {
            toast(`Could not change the switch: ${err.message}`, 'error');
        } finally {
            setSwitching(false);
        }
    };

    const save = async (tier) => {
        try {
            await discountsService.save(tier);
            await load();
            toast(tier.id ? 'Tier saved' : 'Tier added', 'success');
            return true;
        } catch (err) {
            toast(err.message, 'error');
            return false;
        }
    };

    const remove = async (tier) => {
        const yes = await confirm({
            title: `Delete the ${Number(tier.discount_percent)}% tier?`,
            message: 'Its quantities get no discount any more. This cannot be undone.',
            confirmLabel: 'Delete tier',
            danger: true,
        });
        if (!yes) return;
        setBusyId(tier.id);
        try {
            await discountsService.remove(tier.id);
            await load();
            toast('Tier deleted', 'success');
        } catch (err) {
            toast(`Could not delete the tier: ${err.message}`, 'error');
        } finally {
            setBusyId(null);
        }
    };

    const closeDialog = useCallback(() => setEditing(null), []);
    const addTier = () => setEditing('new');

    return (
        <Page>
            <PageHeader
                icon={BadgePercent}
                title="Discounts"
                subtitle="Percentage off for larger quantities. A tier applies when a line's quantity is one of its quantities."
                actions={<Button variant="primary" icon={Plus} onClick={addTier} disabled={loading}>Add tier</Button>}
            />
            <Stack>
                {error && (
                    <Banner tone="error" action={<Button size="sm" icon={RotateCcw} onClick={load}>Try again</Button>}>
                        Could not load the discounts: {error}
                    </Banner>
                )}
                {!error && <DiscountsSwitch enabled={enabled} busy={switching} onToggle={toggle} biggest={biggest} />}
                <Card
                    flush
                    title="Tiers"
                    count={loading ? undefined : tiers.length}
                    subtitle={enabled === false ? 'Saved, but not applied while quantity discounts are off.' : 'Applied on instant prices, the cart and checkout.'}
                    actions={<Segmented items={VIEWS} value={view} onChange={setView} label="Show quantities as" />}
                >
                    <DiscountTiersTable
                        tiers={tiers}
                        loading={loading}
                        view={view}
                        top={top}
                        applied={enabled === true}
                        busyId={busyId}
                        onEdit={setEditing}
                        onDelete={remove}
                        onAdd={addTier}
                    />
                </Card>
            </Stack>
            {editing && (
                <DiscountTierDialog
                    tier={editing === 'new' ? null : editing}
                    otherTiers={tiers.filter(t => editing === 'new' || t.id !== editing.id)}
                    onSave={save}
                    onClose={closeDialog}
                />
            )}
            {confirmDialog}
        </Page>
    );
}
