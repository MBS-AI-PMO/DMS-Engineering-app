import { useCallback, useEffect, useState } from 'react';
import { Banner, Stack } from '../../../components/admin/ui';
import { costingService } from '../../../services/admin/costing';
import ServiceLinksCard from './ServiceLinksCard';

/**
 * Services: which operations each service runs, and for production methods
 * (Laser Cutting, CNC …) which markups and add-ons the whole line gets.
 * A finishing service with no
 * operation is charged its own catalog price per part.
 */
export default function ServicesTab({ config, reload, toast, onDirtyChange }) {
    const { services, operations, markups, addOns, links } = config;
    const [dirtyIds, setDirtyIds] = useState({});

    const markDirty = useCallback((id, dirty) => setDirtyIds(d => (Boolean(d[id]) === dirty ? d : { ...d, [id]: dirty })), []);
    const dirtyCount = Object.values(dirtyIds).filter(Boolean).length;
    useEffect(() => { onDirtyChange(dirtyCount); }, [dirtyCount, onDirtyChange]);

    const savedOf = (id) => ({
        operations: links.operations?.[id] || [],
        markups: links.markups?.[id] || [],
        addOns: links.addOns?.[id] || [],
    });

    const save = (service) => async (next) => {
        try {
            await costingService.saveLinks(service.id, next);
            await reload();
            toast(`${service.title} saved`, 'success');
            return true;
        } catch (err) {
            toast(err.message, 'error');
            return false;
        }
    };

    return (
        <Stack>
            <Banner>
                Markups and add-ons count only on the production method a customer picks; finishing services just add their
                operations. Greyed chips are switched off.
            </Banner>
            {services.map(service => {
                const saved = savedOf(service.id);
                return (
                    <ServiceLinksCard
                        key={`${service.id}-${JSON.stringify(saved)}`}
                        service={service}
                        saved={saved}
                        operations={operations}
                        markups={markups}
                        addOns={addOns}
                        onSave={save(service)}
                        onDirtyChange={markDirty}
                    />
                );
            })}
        </Stack>
    );
}
