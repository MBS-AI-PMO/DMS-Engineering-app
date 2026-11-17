import { Link } from 'react-router-dom';
import { GitBranch } from 'lucide-react';
import { Banner, Card, Field, Switch } from '../../../components/admin/ui';
import ChoiceChips from '../catalog/ChoiceChips';

/**
 * Main production service (customers start a quote with it, e.g. Laser
 * Cutting) or a sub-service of one or more of them (e.g. Bending).
 */
export default function ServiceHierarchyCard({ service, allServices, onChange }) {
    const parents = allServices
        .filter(s => s.is_production && Number(s.id) !== Number(service.id))
        .map(s => ({ value: Number(s.id), label: s.title }));

    const setProduction = (on) => onChange({ is_production: on, parent_ids: on ? [] : service.parent_ids });
    const toggleParent = (id, on) => {
        const ids = (service.parent_ids || []).map(Number).filter(p => p !== Number(id));
        onChange({ parent_ids: on ? [...ids, Number(id)] : ids });
    };

    return (
        <Card title="Type" icon={GitBranch}>
            <Switch
                label="Main production service"
                description="Customers start a quote with it and pick a metal for it, like Laser Cutting or CNC Machining."
                checked={service.is_production}
                onChange={setProduction}
            />
            {!service.is_production && (
                <>
                    <hr className="ak-divider" />
                    <Field as="div" label="Offered with" hint="Linking a main service makes this a sub-process of it (e.g. Bending after Laser Cutting).">
                        <ChoiceChips
                            label="Parent services"
                            options={parents}
                            selected={service.parent_ids || []}
                            onToggle={toggleParent}
                            empty="No main production services yet."
                        />
                    </Field>
                    <Banner>
                        To show it in the quote flow, also choose the metals and thicknesses that offer it
                        {service.id ? <> under <Link className="ak-link" to={`/admin/services/${service.id}/metals`}>Metals for this service</Link>.</> : ' once the service is saved.'}
                    </Banner>
                </>
            )}
        </Card>
    );
}
