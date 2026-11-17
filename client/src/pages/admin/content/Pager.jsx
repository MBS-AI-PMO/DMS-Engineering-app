import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '../../../components/admin/ui';

/** "26–50 of 215" with previous / next, under a table. */
export default function Pager({ page, pageSize, total, onChange, label = 'items' }) {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (total <= pageSize) return null;
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);
    return (
        <nav className="ac-pager" aria-label={`Pages of ${label}`}>
            <span>{from}–{to} of {total}</span>
            <span className="ak-row-actions">
                <IconButton icon={ChevronLeft} label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)} />
                <IconButton icon={ChevronRight} label="Next page" disabled={page >= pages} onClick={() => onChange(page + 1)} />
            </span>
        </nav>
    );
}
