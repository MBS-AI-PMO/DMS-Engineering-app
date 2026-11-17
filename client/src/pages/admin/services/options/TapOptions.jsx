import { Wrench } from 'lucide-react';
import { Field, Input, Switch } from '../../../../components/admin/ui';
import OptionsTableCard from './OptionsTableCard';
import OptionDialog from './OptionDialog';
import { money } from '../serviceForm';

const EMPTY_TAP = { name: '', min_diameter: '', max_diameter: '', min_depth: null, max_depth: '', price: '', notes: '' };
const FIELDS = [
    { key: 'min_diameter', label: 'Min hole diameter (in)', placeholder: '0.0000' },
    { key: 'max_diameter', label: 'Max hole diameter (in)', placeholder: '0.0000' },
    { key: 'max_depth', label: 'Max depth (in)', placeholder: '0.0000' },
    { key: 'price', label: 'Price per hole ($)', step: '0.01', placeholder: '0.00' },
];

function TapDialog({ option, onSave, onClose }) {
    return (
        <OptionDialog
            title={option ? `Edit ${option.name}` : 'Add tap'}
            option={option}
            empty={EMPTY_TAP}
            fields={FIELDS}
            nameLabel="Tap name"
            namePlaceholder="e.g. M2 x 0.4 Roll Tap"
            notesPlaceholder="Material notes or hole size advice…"
            saveLabel={option ? 'Save tap' : 'Add tap'}
            onSave={onSave}
            onClose={onClose}
        >
            {(form, set) => (
                <Field as="div" label="Min depth" hint="Off: any depth up to the max is fine.">
                    <div className="cat-inline">
                        <Switch label="Set a minimum depth" checked={form.min_depth !== null && form.min_depth !== undefined} onChange={on => set('min_depth', on ? '0' : null)} />
                        {form.min_depth !== null && form.min_depth !== undefined && (
                            <Input type="number" step="0.0001" value={form.min_depth} onChange={e => set('min_depth', e.target.value)} placeholder="0.0000" aria-label="Min depth (in)" />
                        )}
                    </div>
                </Field>
            )}
        </OptionDialog>
    );
}

const COLUMNS = [
    { key: 'diameter', header: 'Hole Ø (in)', render: (o) => `${o.min_diameter || '0'} – ${o.max_diameter || '0'}` },
    { key: 'depth', header: 'Depth (in)', render: (o) => `${o.min_depth === null || o.min_depth === undefined ? 'Any' : o.min_depth} to ${o.max_depth || '0'}` },
    { key: 'price', header: 'Per hole', align: 'right', render: (o) => money(o.price) },
];

/** The taps offered by the Tapping service (service_options). */
export default function TapOptions({ options, onChange }) {
    return (
        <OptionsTableCard
            title="Taps"
            icon={Wrench}
            itemLabel="tap"
            subtitle="Hole diameter and depth ranges each tap fits. Customers pick them in the quote flow for matching holes."
            options={options}
            onChange={onChange}
            columns={COLUMNS}
            Dialog={TapDialog}
            emptyText="Add a tap to offer threading."
        />
    );
}
