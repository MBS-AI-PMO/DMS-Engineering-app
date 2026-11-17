import { Avatar, SkeletonRows } from './Feedback';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/**
 * A list as a table. Rows turn into stacked cards on narrow screens.
 *
 * columns: [{
 *   key,                       // unique; also the row field shown when there is no render
 *   header,                    // column title (also the label on phones)
 *   icon?,                     // small lucide icon before the header text
 *   render?: (row, index) => node,
 *   align?: 'right',           // numbers
 *   width?: CSS width,
 *   actions?: true,            // the buttons column (no label, right aligned)
 *   hideBelow?: 1280 | 1100 | 860,  // drop on narrower screens
 * }]
 * rows, rowKey (field name or fn), loading, empty (node shown when no rows),
 * onRowClick(row) makes rows clickable (buttons inside should stopPropagation).
 */
export default function DataTable({ columns, rows, rowKey = 'id', loading = false, skeletonRows = 5, empty, onRowClick, caption, className, footer }) {
    const keyOf = (row, i) => (typeof rowKey === 'function' ? rowKey(row, i) : row[rowKey] ?? i);
    const cellClass = (c) => cx(c.align === 'right' && 'is-num', c.actions && 'is-actions', c.hideBelow && `ak-hide-${c.hideBelow}`, c.className);
    return (
        <div className={cx('ak-table-card', className)}>
            <table className="ak-table is-stackable">
                {caption && <caption className="ak-sr">{caption}</caption>}
                <thead>
                    <tr>
                        {columns.map(c => {
                            const Icon = c.icon;
                            return (
                                <th key={c.key} scope="col" className={cellClass(c)} style={c.width ? { width: c.width } : undefined}>
                                    {c.actions ? <span className="ak-sr">{c.header || 'Actions'}</span> : <>{Icon && <Icon size={14} aria-hidden="true" />}{c.header}</>}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {loading ? <SkeletonRows rows={skeletonRows} columns={columns.map(cellClass)} /> : rows.length === 0 ? (
                        <tr><td colSpan={columns.length}>{empty}</td></tr>
                    ) : rows.map((row, i) => (
                        <tr
                            key={keyOf(row, i)}
                            className={onRowClick ? 'is-clickable' : undefined}
                            onClick={onRowClick ? () => onRowClick(row) : undefined}
                        >
                            {columns.map(c => (
                                <td key={c.key} className={cellClass(c)} data-label={c.actions ? undefined : (typeof c.header === 'string' ? c.header : undefined)}>
                                    {c.render ? c.render(row, i) : row[c.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {footer}
        </div>
    );
}

/** Main text with a muted line under it, for table cells. thumb: an image
 * URL shown before it; avatar: a name whose initial is shown before it. */
export function CellText({ main, sub, thumb, thumbAlt = '', avatar }) {
    const text = (
        <span>
            <span className="ak-cell-main">{main}</span>
            {sub && <span className="ak-cell-sub">{sub}</span>}
        </span>
    );
    if (avatar !== undefined) return <span className="ak-cell-with-thumb"><Avatar name={avatar} />{text}</span>;
    if (thumb === undefined) return text;
    return (
        <span className="ak-cell-with-thumb">
            {thumb ? <img className="ak-thumb" src={thumb} alt={thumbAlt} loading="lazy" decoding="async" /> : <span className="ak-thumb" aria-hidden="true" />}
            {text}
        </span>
    );
}

/** Stops a click inside a clickable row from opening the row. */
export function RowActions({ children }) {
    return <div className="ak-row-actions" onClick={e => e.stopPropagation()}>{children}</div>;
}
