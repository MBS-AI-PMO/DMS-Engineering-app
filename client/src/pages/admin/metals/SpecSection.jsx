import RowsEditor from '../catalog/RowsEditor';
import { FIELD_LABELS } from './metalForm';

/** One spec table (e.g. Bending: label / inch / mm rows) as a collapsible section. */
export default function SpecSection({ section, rows = [], onChange }) {
    const columns = section.fields.map(f => ({ key: f, label: FIELD_LABELS[f] || f, placeholder: FIELD_LABELS[f] || f, width: f === 'label' || f === 'value' ? 'minmax(0, 1.4fr)' : undefined }));
    const empty = Object.fromEntries(section.fields.map(f => [f, '']));
    return (
        <details className="cat-fold">
            <summary>
                {section.label}
                <span className="cat-fold-count">{rows.length} {rows.length === 1 ? 'row' : 'rows'}</span>
            </summary>
            <div className="cat-fold-body">
                <RowsEditor rows={rows} onChange={onChange} columns={columns} newRow={empty} itemLabel="row" emptyText={null} />
            </div>
        </details>
    );
}
