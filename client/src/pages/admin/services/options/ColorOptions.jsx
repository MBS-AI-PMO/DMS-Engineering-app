import { useCallback, useState } from 'react';
import { Palette, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, Card, EmptyState, IconButton } from '../../../../components/admin/ui';
import { wrinkleSwatchStyle } from '../../../../utils/wrinkleTexture';
import ColorDialog from './ColorDialog';
import { money } from '../serviceForm';

/** The colours of Anodizing or Powder Coating (service_options). Saved with the service. */
export default function ColorOptions({ options, onChange, powder }) {
    const [editing, setEditing] = useState(null); // null | 'new' | index
    const close = useCallback(() => setEditing(null), []);

    const save = (color) => {
        onChange(editing === 'new' ? [...options, color] : options.map((o, i) => (i === editing ? color : o)));
        setEditing(null);
    };

    return (
        <Card
            title={powder ? 'Powder coating colours' : 'Anodizing colours'}
            icon={Palette}
            count={options.length}
            subtitle="The colours customers can pick in the quote flow."
            actions={<Button size="sm" variant="dark" icon={Plus} onClick={() => setEditing('new')}>Add colour</Button>}
        >
            {options.length === 0 ? (
                <EmptyState icon={Palette} title="No colours yet" action={<Button size="sm" icon={Plus} onClick={() => setEditing('new')}>Add colour</Button>}>
                    Add the first finish customers can choose.
                </EmptyState>
            ) : (
                <div className="cat-tile-grid">
                    {options.map((o, i) => (
                        <div key={`${o.name}-${i}`} className="cat-tile is-static">
                            <span className="cat-swatch" style={wrinkleSwatchStyle(o.color || '#000000', powder && !!o.is_wrinkled, 10)} aria-hidden="true" />
                            <span className="cat-tile-text">
                                <span className="ak-cell-main">{o.name || 'Unnamed'}</span>
                                <span className="ak-cell-sub">
                                    {powder
                                        ? [`Gloss ${o.gloss ?? 50}%`, o.is_wrinkled && 'Wrinkle'].filter(Boolean).join(' · ')
                                        : (Number.parseFloat(o.price) > 0 ? `+${money(o.price)}` : 'No upcharge')}
                                </span>
                            </span>
                            <span className="ak-row-actions">
                                <IconButton icon={Pencil} size="xs" label={`Edit ${o.name}`} onClick={() => setEditing(i)} />
                                <IconButton icon={Trash2} size="xs" variant="danger" label={`Remove ${o.name}`} onClick={() => onChange(options.filter((_, idx) => idx !== i))} />
                            </span>
                        </div>
                    ))}
                </div>
            )}
            {editing !== null && <ColorDialog color={editing === 'new' ? null : options[editing]} powder={powder} onSave={save} onClose={close} />}
        </Card>
    );
}
