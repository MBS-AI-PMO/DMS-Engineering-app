import { ArrowDown, ArrowUp } from 'lucide-react';
import { IconButton } from '../../../components/admin/ui';

/** Up / down buttons for reordering a row. label names the row for screen readers. */
export default function MoveButtons({ index, count, onMove, label, disabled = false }) {
    return (
        <span className="ac-move">
            <IconButton icon={ArrowUp} size="xs" label={`Move ${label} up`} disabled={disabled || index === 0} onClick={() => onMove(index, index - 1)} />
            <IconButton icon={ArrowDown} size="xs" label={`Move ${label} down`} disabled={disabled || index >= count - 1} onClick={() => onMove(index, index + 1)} />
        </span>
    );
}
