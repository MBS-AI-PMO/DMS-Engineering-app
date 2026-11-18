import { useState } from 'react';
import { Youtube } from 'lucide-react';
import { Button, Field, Input, Modal } from '../../../../components/admin/ui';
import { youtubeId } from '../../../../components/blog/blogDoc';

/* Seconds from "t=90", "t=1m30s" or "start=90" in a YouTube link. */
function startOf(url) {
    const m = String(url).match(/[?&#](?:t|start)=(\d+h)?(\d+m)?(\d+)s?/i);
    if (!m) return 0;
    return (Number.parseInt(m[1] || '0', 10) * 3600) + (Number.parseInt(m[2] || '0', 10) * 60) + Number.parseInt(m[3] || '0', 10);
}

/**
 * Embed a YouTube video: paste its link (watch, youtu.be, shorts or embed).
 * On the site the video loads only when it is played.
 * onInsert({ src, start }).
 */
export default function YoutubeDialog({ onInsert, onClose }) {
    const [url, setUrl] = useState('');
    const id = youtubeId(url.trim());
    const tried = url.trim().length > 8;

    const submit = (e) => {
        e?.preventDefault();
        if (!id) return;
        onInsert({ src: `https://www.youtube.com/watch?v=${id}`, start: startOf(url) });
    };

    return (
        <Modal
            title="Add a YouTube video"
            subtitle="It shows in the post as a picture with a play button."
            size="md"
            onClose={onClose}
            footer={(
                <>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button variant="primary" icon={Youtube} onClick={submit} disabled={!id}>Add video</Button>
                </>
            )}
        >
            <form onSubmit={submit} className="be-yt-form">
                <Field label="Video link" error={tried && !id ? 'That does not look like a YouTube video link.' : undefined} hint="Copy it from the browser bar or from Share on YouTube.">
                    <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" autoFocus invalid={tried && !id} />
                </Field>
                {id && (
                    <div className="be-yt-preview">
                        <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" />
                    </div>
                )}
            </form>
        </Modal>
    );
}
