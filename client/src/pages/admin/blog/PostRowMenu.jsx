import { useRef, useState } from 'react';
import { CalendarX2, Copy, Eye, EyeOff, MoreHorizontal, Send, Trash2 } from 'lucide-react';
import { IconButton, Popover } from '../../../components/admin/ui';

/**
 * The "more" menu on a post row: publish now / unpublish / cancel the
 * schedule, preview, duplicate, delete. onAction(kind) with kind one of
 * publish | unpublish | preview | duplicate | delete.
 */
export default function PostRowMenu({ post, onAction, busy = false }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const pick = (kind) => { setOpen(false); onAction(kind); };
    const item = (kind, Icon, label, danger = false) => (
        <button type="button" role="menuitem" className={`be-menu-item${danger ? ' is-danger' : ''}`} onClick={() => pick(kind)}>
            <Icon size={15} aria-hidden="true" /> {label}
        </button>
    );
    return (
        <>
            <IconButton
                ref={ref}
                icon={MoreHorizontal}
                label={`More actions for ${post.title || 'this post'}`}
                aria-haspopup="menu"
                aria-expanded={open}
                loading={busy}
                onClick={() => setOpen(v => !v)}
            />
            <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} role="menu" label="Post actions" align="end" width={210}>
                <div className="be-menu">
                    {post.state === 'draft' && item('publish', Send, 'Publish now')}
                    {post.state === 'published' && item('unpublish', EyeOff, 'Unpublish')}
                    {post.state === 'scheduled' && item('publish', Send, 'Publish now')}
                    {post.state === 'scheduled' && item('unpublish', CalendarX2, 'Cancel schedule')}
                    {item('preview', Eye, post.state === 'published' ? 'View on site' : 'Preview')}
                    {item('duplicate', Copy, 'Duplicate')}
                    <span className="be-menu-rule" aria-hidden="true" />
                    {item('delete', Trash2, 'Delete', true)}
                </div>
            </Popover>
        </>
    );
}
