import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Skeleton } from '../../../components/admin/ui';
import './dashboard.css';

/**
 * Rows that each open a page: icon, label (+ a muted line), a value on
 * the right. items: [{ to, icon, label, sub?, value?, tone? }]; value
 * undefined shows a loading bar, null a dash. tone puts the icon on a
 * tinted tile (for things that need attention); otherwise it is plain red.
 */
export default function LinkList({ items }) {
    return (
        <ul className="db-links">
            {items.map(item => {
                const Icon = item.icon;
                return (
                    <li key={item.to + item.label}>
                        <Link to={item.to} className="db-link">
                            <span className={`db-link-icon${item.tone ? ` is-tile is-${item.tone}` : ''}`} aria-hidden="true"><Icon size={17} /></span>
                            <span className="db-link-text">
                                <span className="db-link-label">{item.label}</span>
                                {item.sub && <span className="db-link-sub">{item.sub}</span>}
                            </span>
                            {'value' in item && (
                                <span className="db-link-value">
                                    {item.value === undefined ? <Skeleton width={28} /> : item.value === null ? '—' : item.value}
                                </span>
                            )}
                            <ChevronRight size={16} className="db-link-go" aria-hidden="true" />
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
}
