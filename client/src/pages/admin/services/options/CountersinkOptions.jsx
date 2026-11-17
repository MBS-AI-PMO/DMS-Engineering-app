import { CircleDot } from 'lucide-react';
import OptionsTableCard from './OptionsTableCard';
import OptionDialog from './OptionDialog';
import { money } from '../serviceForm';

const EMPTY_PROFILE = { name: '', major_dia: '', minor_dia: '', angle: '', price: '', notes: '' };
const FIELDS = [
    { key: 'major_dia', label: 'Major Ø (in)', step: '0.001', min: '0', placeholder: 'e.g. 0.320' },
    { key: 'minor_dia', label: 'Minor Ø (in)', step: '0.001', min: '0', placeholder: 'e.g. 0.164' },
    { key: 'angle', label: 'Angle (°)', step: '1', min: '1', max: '179', placeholder: 'e.g. 82' },
    { key: 'price', label: 'Price per hole ($)', step: '0.01', placeholder: '0.00' },
];

function CountersinkDialog({ option, onSave, onClose }) {
    return (
        <OptionDialog
            title={option ? `Edit ${option.name}` : 'Add countersink profile'}
            option={option}
            empty={EMPTY_PROFILE}
            fields={FIELDS}
            nameLabel="Profile name"
            namePlaceholder="e.g. 82° #8 Flat Head"
            notesPlaceholder="Optional engineering notes…"
            saveLabel={option ? 'Save profile' : 'Add profile'}
            onSave={onSave}
            onClose={onClose}
        />
    );
}

const COLUMNS = [
    { key: 'major', header: 'Major Ø (in)', align: 'right', render: (o) => o.major_dia || '—' },
    { key: 'minor', header: 'Minor Ø (in)', align: 'right', render: (o) => o.minor_dia || '—' },
    { key: 'angle', header: 'Angle', align: 'right', render: (o) => (o.angle ? `${o.angle}°` : '—') },
    { key: 'price', header: 'Per hole', align: 'right', render: (o) => money(o.price) },
];

/** The countersink profiles of the Countersinking service (service_options). */
export default function CountersinkOptions({ options, onChange }) {
    return (
        <OptionsTableCard
            title="Countersink profiles"
            icon={CircleDot}
            itemLabel="profile"
            subtitle="Major / minor diameter and angle of each profile. Matched to countersunk holes found in STEP files."
            options={options}
            onChange={onChange}
            columns={COLUMNS}
            Dialog={CountersinkDialog}
            emptyText="Add a profile to offer countersinking."
        />
    );
}
