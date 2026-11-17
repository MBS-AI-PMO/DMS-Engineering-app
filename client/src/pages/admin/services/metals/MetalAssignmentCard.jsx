import { Card, Button, Field, Switch } from '../../../../components/admin/ui';
import ChoiceChips from '../../catalog/ChoiceChips';

/**
 * One metal: offer the service for the whole metal, and/or for some of
 * its thicknesses. assignment: { id, assigned, thicknesses: [value…] }.
 */
export default function MetalAssignmentCard({ metal, assignment, serviceTitle, onChange }) {
    const thicknesses = metal.quick_look?.thicknesses || [];
    const values = thicknesses.map(t => t.value).filter(Boolean);
    const picked = assignment.thicknesses.filter(v => values.includes(v)).length;
    const setThicknesses = (list) => onChange({ ...assignment, thicknesses: list });

    return (
        <Card
            title={metal.name}
            subtitle={metal.category_name || undefined}
            actions={values.length > 0 ? <span className="cat-muted">{picked} / {values.length} thicknesses</span> : null}
            className={assignment.assigned || picked ? 'cat-assign is-on' : 'cat-assign'}
        >
            <Switch
                label="Whole metal"
                description={`Offer ${serviceTitle} for ${metal.name} in general.`}
                checked={assignment.assigned}
                onChange={on => onChange({ ...assignment, assigned: on })}
            />
            {values.length > 0 ? (
                <>
                    <hr className="ak-divider" />
                    <Field as="div" label="Thicknesses">
                        <ChoiceChips
                            compact
                            label={`${metal.name} thicknesses`}
                            options={values.map(v => ({ value: v, label: v }))}
                            selected={assignment.thicknesses}
                            onToggle={(v, on) => setThicknesses(on ? [...assignment.thicknesses.filter(x => x !== v), v] : assignment.thicknesses.filter(x => x !== v))}
                        />
                    </Field>
                    <div className="ak-row-actions">
                        <Button size="sm" variant="ghost" onClick={() => setThicknesses(values)} disabled={picked === values.length}>All thicknesses</Button>
                        <Button size="sm" variant="ghost" onClick={() => setThicknesses([])} disabled={picked === 0}>None</Button>
                    </div>
                </>
            ) : (
                <p className="ak-hint">This metal has no thicknesses yet.</p>
            )}
        </Card>
    );
}
