import { useCallback, useMemo, useState } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import { Button, Card, EmptyState, Field, Select } from '../../../components/admin/ui';
import { costingService } from '../../../services/admin/costing';
import { bucketLabel } from './costingFormat';
import OperationEditor from './OperationEditor';
import NewOperationDialog from './NewOperationDialog';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/**
 * Operations: what each step of making a part costs. Pick one in the list;
 * its settings and values are edited beside it (on phones the list is a
 * dropdown above the editor).
 */
export default function OperationsTab({ config, reload, toast, confirm, onDirtyChange }) {
    const { operations, operationTypes, services, links } = config;
    const [selectedId, setSelectedId] = useState(operations[0]?.id ?? null);
    const [creating, setCreating] = useState(false);
    const [editorDirty, setEditorDirty] = useState(false);

    const selected = operations.find(o => o.id === selectedId) || null;

    const usedBy = useMemo(() => {
        const map = {};
        Object.entries(links.operations || {}).forEach(([serviceId, ids]) => ids.forEach(id => {
            (map[id] ||= []).push(services.find(s => String(s.id) === String(serviceId))?.title || `#${serviceId}`);
        }));
        return map;
    }, [links, services]);

    const reportDirty = useCallback((d) => { setEditorDirty(d); onDirtyChange(d ? 1 : 0); }, [onDirtyChange]);
    const closeCreate = useCallback(() => setCreating(false), []);

    const pick = async (id) => {
        if (id === selectedId) return;
        if (editorDirty && !(await confirm({
            title: 'Leave without saving?',
            message: `Your changes to ${selected?.name} are not saved and will be lost.`,
            confirmLabel: 'Discard changes',
            danger: true,
        }))) return;
        setSelectedId(id);
    };

    const save = async (draft) => {
        try {
            await costingService.save('operations', draft);
            await reload();
            toast(`${draft.name} saved`, 'success');
            return true;
        } catch (err) {
            toast(err.message, 'error');
            return false;
        }
    };

    const remove = async () => {
        const used = usedBy[selected.id] || [];
        const yes = await confirm({
            title: `Delete "${selected.name}"?`,
            message: used.length
                ? `It is used by ${used.join(', ')}. Those services stop charging for it straight away.`
                : 'No service uses it. This cannot be undone.',
            confirmLabel: 'Delete operation',
            danger: true,
        });
        if (!yes) return;
        try {
            await costingService.remove('operations', selected.id);
            setSelectedId(operations.find(o => o.id !== selected.id)?.id ?? null);
            await reload();
            toast(`${selected.name} deleted`, 'success');
        } catch (err) {
            toast(err.message, 'error');
        }
    };

    const create = async ({ name, op_type }) => {
        try {
            const row = await costingService.save('operations', {
                name,
                op_type,
                bucket: operationTypes[op_type]?.defaultBucket,
                variables: {},
                sort_order: (operations.at(-1)?.sort_order || 0) + 10,
            });
            await reload();
            setSelectedId(row.id);
            toast('Operation added. Set its values, then link it to a service.', 'success');
            return true;
        } catch (err) {
            toast(err.message, 'error');
            return false;
        }
    };

    const metaOf = (op) => [operationTypes[op.op_type]?.label || op.op_type, bucketLabel(op.bucket), !op.is_active && 'off'].filter(Boolean).join(' · ');

    return (
        <div className="ck-split">
            <Card
                flush
                className="ck-op-list-card"
                title="Operations"
                count={operations.length}
                actions={<Button size="sm" icon={Plus} onClick={() => setCreating(true)}>New</Button>}
            >
                <ul className="ck-op-list" aria-label="Operations">
                    {operations.map(op => (
                        <li key={op.id}>
                            <button
                                type="button"
                                className={cx('ck-op-item', op.id === selectedId && 'is-active', !op.is_active && 'is-off')}
                                aria-current={op.id === selectedId ? 'true' : undefined}
                                onClick={() => pick(op.id)}
                            >
                                <span className="ak-cell-main">{op.name}</span>
                                <span className="ak-cell-sub">{metaOf(op)}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </Card>

            <div className="ck-op-main">
                <div className="ck-op-picker">
                    <Field label="Operation">
                        <Select
                            value={selectedId ?? ''}
                            onChange={e => pick(Number(e.target.value))}
                            options={operations.map(op => ({ value: op.id, label: `${op.name}${op.is_active ? '' : ' (off)'}` }))}
                        />
                    </Field>
                    <Button icon={Plus} onClick={() => setCreating(true)}>New operation</Button>
                </div>
                {selected ? (
                    <OperationEditor
                        key={`${selected.id}-${selected.updated_at}`}
                        operation={selected}
                        type={operationTypes[selected.op_type]}
                        usedBy={usedBy[selected.id] || []}
                        onSave={save}
                        onDelete={remove}
                        onDirtyChange={reportDirty}
                    />
                ) : (
                    <Card>
                        <EmptyState
                            icon={Settings2}
                            title={operations.length ? 'Pick an operation' : 'No operations yet'}
                            action={<Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>New operation</Button>}
                        >
                            {operations.length ? 'Choose one in the list to edit it.' : 'Add the first step parts go through.'}
                        </EmptyState>
                    </Card>
                )}
            </div>

            {creating && <NewOperationDialog operationTypes={operationTypes} onCreate={create} onClose={closeCreate} />}
        </div>
    );
}
