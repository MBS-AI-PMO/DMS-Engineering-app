import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Hash, Package, Pencil, Plus, Ruler, Search, Tag, Trash2, Upload } from 'lucide-react';
import {
    Banner, Button, CellText, DataTable, EmptyState, IconButton, Pill, RowActions, SearchInput, Segmented, Stack, Toolbar, useConfirm,
} from '../../../../components/admin/ui';
import { useToast } from '../../../../context/ToastContext';
import { hardwareService } from '../../../../services/admin/services';
import ImageZoom from '../../catalog/ImageZoom';
import HardwareItemDialog from './HardwareItemDialog';
import { showIn, specFields } from './hardwareSpecs';
import { money } from '../serviceForm';

const UNITS = [{ value: 'in', label: 'in' }, { value: 'mm', label: 'mm' }];

/**
 * One hardware type: its picture (replaced straight away) and its items,
 * added / edited / deleted straight away (not with the service).
 */
export default function HardwareItems({ type, onBack, onTypeChange }) {
    const toast = useToast();
    const [confirm, confirmDialog] = useConfirm();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [unit, setUnit] = useState('in');
    const [editing, setEditing] = useState(null); // null | 'new' | item
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [zoom, setZoom] = useState(null);
    const photoInput = useRef(null);
    const fields = specFields(type);

    const load = useCallback(() => {
        setLoading(true);
        setError('');
        return hardwareService.items(type.id)
            .then(rows => setItems(rows || []))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [type.id]);

    useEffect(() => { load(); }, [load]);
    const closeDialog = useCallback(() => setEditing(null), []);
    const closeZoom = useCallback(() => setZoom(null), []);

    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return needle ? items.filter(i => [i.name, i.size_spec, i.notes].some(v => v && v.toLowerCase().includes(needle))) : items;
    }, [items, query]);

    const replacePhoto = async (file) => {
        if (!file) return;
        setUploading(true);
        try {
            const path = await hardwareService.uploadTypeImage(type.id, file);
            onTypeChange({ ...type, image_path: path });
            toast(`${type.name} photo updated`, 'success');
        } catch (err) {
            toast(`Upload failed: ${err.message}`, 'error');
        } finally {
            setUploading(false);
        }
    };

    const save = async (payload) => {
        setSaving(true);
        try {
            if (editing === 'new') await hardwareService.createItem(payload);
            else await hardwareService.updateItem(editing.id, payload);
            toast(editing === 'new' ? `${payload.name} added` : `${payload.name} saved`, 'success');
            setEditing(null);
            const rows = await hardwareService.items(type.id);
            setItems(rows || []);
            onTypeChange({ ...type, item_count: String((rows || []).length) });
        } catch (err) {
            toast(`Could not save: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const remove = async (item) => {
        if (!(await confirm({ title: `Delete ${item.name}?`, message: 'Customers can no longer choose it. This cannot be undone.', confirmLabel: 'Delete item', danger: true }))) return;
        setBusyId(item.id);
        try {
            await hardwareService.deleteItem(item.id);
            setItems(prev => prev.filter(i => i.id !== item.id));
            onTypeChange({ ...type, item_count: String(Math.max(0, items.length - 1)) });
            toast(`${item.name} deleted`, 'success');
        } catch (err) {
            toast(`Could not delete: ${err.message}`, 'error');
        } finally {
            setBusyId(null);
        }
    };

    const specs = (item) => {
        const parts = fields
            .filter(f => item[f.key] !== null && item[f.key] !== undefined && item[f.key] !== '')
            .map(f => (
                <span key={f.key} className={f.key === 'max_hole_diameter' ? 'is-limit' : undefined}>
                    <b>{f.short}</b> {f.inches ? showIn(item[f.key], unit) : Number.parseFloat(item[f.key])}
                </span>
            ));
        return parts.length ? <span className="cat-specs">{parts}</span> : <span className="cat-muted">None</span>;
    };

    const columns = [
        { key: 'n', header: '#', icon: Hash, width: 56, hideBelow: 860, render: (_, i) => <span className="cat-muted">{i + 1}</span> },
        { key: 'name', header: 'Item', icon: Package, render: (i) => <CellText main={i.name} sub={i.size_spec || undefined} /> },
        { key: 'specs', header: `Measurements (${unit})`, icon: Ruler, render: specs },
        { key: 'price', header: 'Price', icon: Tag, align: 'right', render: (i) => money(i.price, 4) },
        { key: 'status', header: 'Status', render: (i) => (i.is_active ? <Pill tone="green" dot>Active</Pill> : <Pill dot>Hidden</Pill>) },
        {
            key: 'actions', actions: true,
            render: (i) => (
                <RowActions>
                    <IconButton icon={Pencil} label={`Edit ${i.name}`} onClick={() => setEditing(i)} />
                    <IconButton icon={Trash2} label={`Delete ${i.name}`} variant="danger" loading={busyId === i.id} onClick={() => remove(i)} />
                </RowActions>
            ),
        },
    ];

    return (
        <Stack>
            <div className="cat-inline">
                <Button size="sm" variant="ghost" icon={ArrowLeft} onClick={onBack}>All types</Button>
            </div>

            <div className="cat-tile is-static">
                {type.image_path ? (
                    <button type="button" className="cat-zoomable" onClick={() => setZoom({ src: type.image_path, title: type.name })} aria-label={`View the ${type.name} photo larger`}>
                        <img className="cat-tile-img is-lg" src={type.image_path} alt="" />
                    </button>
                ) : <span className="cat-tile-img is-lg is-empty" aria-hidden="true"><Package size={22} /></span>}
                <span className="cat-tile-text">
                    <span className="ak-cell-main">{type.name}</span>
                    <span className="ak-cell-sub">{items.length} {items.length === 1 ? 'item' : 'items'} · the photo is shared by every item</span>
                    <input ref={photoInput} type="file" accept="image/*" hidden onChange={e => { replacePhoto(e.target.files?.[0]); e.target.value = ''; }} />
                    <span className="cat-tile-action">
                        <Button size="sm" icon={Upload} loading={uploading} onClick={() => photoInput.current?.click()}>Change photo</Button>
                    </span>
                </span>
            </div>

            {error && <Banner tone="error" action={<Button size="sm" onClick={load}>Try again</Button>}>Could not load the items. {error}</Banner>}

            <Toolbar
                left={<SearchInput value={query} onChange={setQuery} placeholder={`Search ${type.name.toLowerCase()} items…`} label="Search items" />}
                right={(
                    <>
                        <Segmented label="Unit" items={UNITS} value={unit} onChange={setUnit} />
                        <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Add item</Button>
                    </>
                )}
            />

            <DataTable
                caption={`${type.name} items`}
                columns={columns}
                rows={visible}
                loading={loading}
                skeletonRows={4}
                onRowClick={(i) => setEditing(i)}
                empty={query
                    ? <EmptyState icon={Search} title="No items match" action={<Button size="sm" onClick={() => setQuery('')}>Clear search</Button>} />
                    : <EmptyState icon={Package} title="No items yet" action={<Button size="sm" variant="primary" icon={Plus} onClick={() => setEditing('new')}>Add item</Button>}>Add the sizes customers can choose.</EmptyState>}
            />

            {editing !== null && (
                <HardwareItemDialog type={type} item={editing === 'new' ? null : editing} unit={unit} saving={saving} onSave={save} onClose={closeDialog} />
            )}
            <ImageZoom image={zoom} onClose={closeZoom} />
            {confirmDialog}
        </Stack>
    );
}
