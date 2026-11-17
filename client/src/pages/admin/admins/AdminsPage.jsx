import { useCallback, useEffect, useState } from 'react';
import { Calendar, Clock, Mail, Pencil, Plus, ShieldCheck, Trash2, User } from 'lucide-react';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { useToast } from '../../../context/ToastContext';
import {
    Page, PageHeader, Button, IconButton, Banner, DataTable, CellText, RowActions, Pill, EmptyState, useConfirm,
} from '../../../components/admin/ui';
import { adminsService } from '../../../services/admin/admins';
import { ago, dateText, plural } from '../people/format';
import AdminFormModal from './AdminFormModal';

/**
 * Admin › Admins: the accounts that can sign in to this admin. Add one,
 * change a name, email or password, or delete one (not your own account,
 * and never the last admin).
 */
export default function AdminsPage() {
    const { admin: me } = useAdminAuth();
    const toast = useToast();
    const [confirm, confirmDialog] = useConfirm();
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(null); // null | 'new' | admin row
    const [deletingId, setDeletingId] = useState(null);

    const load = useCallback(() => adminsService.list()
        .then(rows => { setAdmins(rows || []); setError(''); })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false)), []);
    useEffect(() => { load(); }, [load]);

    const closeForm = useCallback(() => setEditing(null), []);
    const onSaved = useCallback((row, isNew) => {
        setAdmins(list => (isNew ? [...list, row] : list.map(a => (a.id === row.id ? { ...a, ...row } : a))));
        setEditing(null);
        toast(isNew ? `${row.email} can now sign in.` : 'Admin saved.', 'success');
    }, [toast]);

    const remove = async (row) => {
        const yes = await confirm({
            title: `Delete ${row.name?.trim() || row.email}?`,
            message: `${row.email} will no longer be able to sign in to the admin. This cannot be undone.`,
            confirmLabel: 'Delete admin',
            danger: true,
        });
        if (!yes) return;
        setDeletingId(row.id);
        try {
            await adminsService.remove(row.id);
            setAdmins(list => list.filter(a => a.id !== row.id));
            toast('Admin deleted.', 'success');
        } catch (err) {
            toast(`Could not delete the admin: ${err.message}`, 'error');
        } finally {
            setDeletingId(null);
        }
    };

    const isMe = (row) => me && Number(me.id) === Number(row.id);
    const onlyOne = admins.length <= 1;

    const columns = [
        {
            key: 'name', header: 'Name', icon: User,
            render: a => (
                <span className="ak-cell-with-thumb">
                    <CellText avatar={a.name?.trim() || a.email} main={a.name?.trim() || '—'} />
                    {isMe(a) && <Pill tone="red">You</Pill>}
                </span>
            ),
        },
        { key: 'email', header: 'Email', icon: Mail, render: a => a.email },
        { key: 'created', header: 'Added', icon: Calendar, render: a => <CellText main={dateText(a.created_at)} sub={ago(a.created_at)} /> },
        { key: 'updated', header: 'Last changed', icon: Clock, hideBelow: 860, render: a => (a.updated_at ? <CellText main={dateText(a.updated_at)} sub={ago(a.updated_at)} /> : '—') },
        {
            key: 'actions', header: 'Actions', actions: true,
            render: a => {
                const blocked = isMe(a) ? "You can't delete your own account" : onlyOne ? "The last admin can't be deleted" : null;
                return (
                    <RowActions>
                        <IconButton icon={Pencil} label={`Edit ${a.email}`} onClick={() => setEditing(a)} />
                        <IconButton
                            icon={Trash2}
                            variant="danger"
                            label={blocked || `Delete ${a.email}`}
                            disabled={Boolean(blocked)}
                            loading={deletingId === a.id}
                            onClick={() => remove(a)}
                        />
                    </RowActions>
                );
            },
        },
    ];

    return (
        <Page>
            <PageHeader
                icon={ShieldCheck}
                title="Admins"
                subtitle={loading ? 'People who can sign in to this admin.' : `${plural(admins.length, 'person', 'people')} can sign in to this admin. Every admin has full access.`}
                actions={<Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Add admin</Button>}
            />

            {error && <Banner tone="error" action={<Button size="sm" onClick={() => { setLoading(true); load(); }}>Try again</Button>}>Could not load the admins. {error}</Banner>}

            <DataTable
                caption="Admins"
                columns={columns}
                rows={admins}
                loading={loading}
                skeletonRows={3}
                onRowClick={a => setEditing(a)}
                empty={<EmptyState icon={ShieldCheck} title="No admins found">Add one so someone can sign in.</EmptyState>}
            />

            {editing && (
                <AdminFormModal
                    admin={editing === 'new' ? null : editing}
                    isSelf={editing !== 'new' && isMe(editing)}
                    onClose={closeForm}
                    onSaved={onSaved}
                />
            )}
            {confirmDialog}
        </Page>
    );
}
