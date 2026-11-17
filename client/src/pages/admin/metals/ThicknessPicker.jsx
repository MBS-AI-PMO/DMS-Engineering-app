import { Tabs } from '../../../components/admin/ui';
import { thicknessLabel } from './metalForm';

/** Choose one of the metal's thicknesses (by index). */
export default function ThicknessPicker({ thicknesses, index, onChange, label = 'Thickness', counts }) {
    return (
        <Tabs
            label={label}
            value={String(index)}
            onChange={v => onChange(Number(v))}
            items={thicknesses.map((t, i) => ({ value: String(i), label: thicknessLabel(t, i), count: counts?.[i] }))}
        />
    );
}
