import { useEffect, useState } from 'react';
import { Percent, Ruler, Settings2, TriangleAlert } from 'lucide-react';
import { StatCard, StatGrid, Stack } from '../../../components/admin/ui';
import { discountsService } from '../../../services/admin/discounts';
import PriceCalculator from './PriceCalculator';

/**
 * Overview: the numbers worth a look (rows still without a price, the
 * default sheet, whether quantity discounts apply) and the price calculator.
 */
export default function OverviewTab({ config, toast }) {
    const [discountsOn, setDiscountsOn] = useState(null);
    useEffect(() => {
        let cancelled = false;
        discountsService.isEnabled()
            .then(on => { if (!cancelled) setDiscountsOn(on); })
            .catch(() => { if (!cancelled) setDiscountsOn(undefined); });
        return () => { cancelled = true; };
    }, []);

    const defaultSize = config.sheetSizes.find(s => s.is_default);
    const missing = defaultSize ? config.sheetCosts.filter(r => !(Number(r.prices?.[defaultSize.id]) > 0)).length : 0;
    const activeOps = config.operations.filter(o => o.is_active).length;

    return (
        <Stack>
            <StatGrid label="Costing at a glance">
                <StatCard icon={Settings2} value={`${activeOps} / ${config.operations.length}`} label="Operations" to="/admin/costing/operations" title={`${activeOps} of ${config.operations.length} operations are on`} />
                <StatCard
                    icon={Ruler}
                    value={defaultSize ? defaultSize.name.replace(/\s*sheet$/i, '') : 'None'}
                    label="Sheet size"
                    to="/admin/costing/sheet-sizes"
                    tone={defaultSize ? undefined : 'amber'}
                    title={defaultSize ? `Parts are priced on the ${defaultSize.name}` : 'No default sheet'}
                />
                <StatCard
                    icon={TriangleAlert}
                    tone={missing ? 'amber' : 'green'}
                    value={missing}
                    label={missing ? 'Unpriced' : 'All priced'}
                    to={missing ? '/admin/costing/sheet-costs?show=missing' : '/admin/costing/sheet-costs'}
                    title={defaultSize ? `${missing} of ${config.sheetCosts.length} sheet cost rows have no ${defaultSize.name} price, so customers are asked for a quote` : undefined}
                />
                <StatCard
                    icon={Percent}
                    loading={discountsOn === null}
                    value={discountsOn === undefined ? '—' : discountsOn ? 'On' : 'Off'}
                    label="Discounts"
                    to="/admin/pricing"
                    title="Quantity discounts on the website"
                />
            </StatGrid>

            <PriceCalculator config={config} toast={toast} />
        </Stack>
    );
}
