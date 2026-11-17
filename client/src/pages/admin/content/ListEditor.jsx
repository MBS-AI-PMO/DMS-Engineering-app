import { Plus, Trash2 } from 'lucide-react';
import { Button, IconButton, Input, Textarea } from '../../../components/admin/ui';
import MoveButtons from './MoveButtons';
import { move, newKey } from './list';

/**
 * An ordered list of short texts (requirements, paragraphs): numbered rows
 * with move up / down and remove, and an Add button.
 *
 * items: [{ key, text }] (keys from newKey()). onChange(items).
 * multiline: textareas instead of one-line inputs. itemLabel: "requirement".
 */
export default function ListEditor({ items, onChange, multiline = false, itemLabel = 'item', addLabel, placeholder, emptyText, rows = 3, maxLength }) {
    const update = (index, text) => onChange(items.map((item, i) => (i === index ? { ...item, text } : item)));
    const remove = (index) => onChange(items.filter((_, i) => i !== index));
    const add = () => onChange([...items, { key: newKey(), text: '' }]);
    const Control = multiline ? Textarea : Input;

    return (
        <div className="ac-list">
            {items.length === 0 && emptyText && <p className="ac-list-empty">{emptyText}</p>}
            {items.length > 0 && (
                <ol className="ac-list-rows">
                    {items.map((item, index) => (
                        <li key={item.key} className="ac-list-row">
                            <span className="ac-list-num" aria-hidden="true">{index + 1}</span>
                            <Control
                                value={item.text}
                                onChange={e => update(index, e.target.value)}
                                placeholder={placeholder}
                                aria-label={`${itemLabel[0].toUpperCase()}${itemLabel.slice(1)} ${index + 1}`}
                                maxLength={maxLength}
                                {...(multiline ? { rows } : {})}
                            />
                            <span className="ac-list-tools">
                                <MoveButtons index={index} count={items.length} onMove={(from, to) => onChange(move(items, from, to))} label={`${itemLabel} ${index + 1}`} />
                                <IconButton icon={Trash2} size="xs" variant="danger" label={`Remove ${itemLabel} ${index + 1}`} onClick={() => remove(index)} />
                            </span>
                        </li>
                    ))}
                </ol>
            )}
            <Button size="sm" icon={Plus} onClick={add}>{addLabel || `Add ${itemLabel}`}</Button>
        </div>
    );
}
