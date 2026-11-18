import { useState } from 'react';
import { CalendarClock, CalendarX2, ExternalLink, EyeOff, RotateCcw, Save, Send, Trash2 } from 'lucide-react';
import { Button, Card, Field, Input, KeyValue, Pill } from '../../../components/admin/ui';
import SaveState from './SaveState';
import { dateTime, isComing, shortDay, stateMeta, suggestedTime, toLocalInput } from './blogModel';

/**
 * The side panel's first card: where the post stands (draft, scheduled,
 * on the site) and what can be done next: save the draft, publish now,
 * schedule for a date and time, update a live post, unpublish, delete.
 * busy: the action running ('save' | 'publish' | 'schedule' | 'unpublish' | 'delete').
 */
export default function PublishCard({ saver, words, busy, onSave, onPublish, onSchedule, onUnpublish, onDiscard, onDelete }) {
    const { post, dirty } = saver;
    const state = post?.state || 'draft';
    const meta = stateMeta(state);
    const [planning, setPlanning] = useState(false);
    const [when, setWhen] = useState(() => toLocalInput(state === 'scheduled' ? post.published_at : suggestedTime()));
    const any = Boolean(busy);

    const note = state === 'scheduled' ? `Goes live ${dateTime(post.published_at)}.`
        : state === 'published' ? `On the site since ${shortDay(post.published_at)}. Changes go live when you update.`
            : 'Only admins can see it. It saves as you write.';

    const whenDate = when ? new Date(when) : null;
    const whenOk = isComing(whenDate);

    return (
        <Card title="Publish" icon={Send} className="be-publish">
            <div className="be-pub-head">
                <Pill tone={meta.tone} dot>{meta.label}</Pill>
                <SaveState saver={saver} />
            </div>
            <p className="ak-hint be-pub-note">{note}</p>

            <div className="be-pub-actions">
                {state === 'published' ? (
                    <>
                        <Button variant="primary" icon={Save} onClick={onSave} loading={busy === 'save'} disabled={!dirty || any}>Update post</Button>
                        {dirty && <Button variant="ghost" icon={RotateCcw} onClick={onDiscard} disabled={any}>Discard changes</Button>}
                    </>
                ) : (
                    <>
                        <Button icon={Save} onClick={onSave} loading={busy === 'save'} disabled={any || (!dirty && Boolean(post?.id))}>
                            {state === 'scheduled' ? 'Save changes' : 'Save draft'}
                        </Button>
                        <Button variant="primary" icon={Send} onClick={onPublish} loading={busy === 'publish'} disabled={any}>Publish now</Button>
                    </>
                )}
            </div>

            {state !== 'published' && (
                planning || state === 'scheduled' ? (
                    <div className="be-pub-plan">
                        <Field label={state === 'scheduled' ? 'Publish time' : 'Publish on'} hint="Your local time. It goes live by itself.">
                            <Input type="datetime-local" value={when} min={toLocalInput(new Date())} onChange={e => setWhen(e.target.value)} />
                        </Field>
                        <div className="be-pub-actions">
                            <Button icon={CalendarClock} onClick={() => onSchedule(whenDate)} loading={busy === 'schedule'} disabled={any || !whenOk}>
                                {state === 'scheduled' ? 'Reschedule' : 'Schedule'}
                            </Button>
                            {state === 'scheduled'
                                ? <Button variant="ghost" icon={CalendarX2} onClick={onUnpublish} loading={busy === 'unpublish'} disabled={any}>Cancel schedule</Button>
                                : <Button variant="ghost" onClick={() => setPlanning(false)} disabled={any}>Not now</Button>}
                        </div>
                        {when && !whenOk && <p className="ak-error-text">Pick a time at least a minute from now.</p>}
                    </div>
                ) : (
                    <button type="button" className="be-link-btn" onClick={() => setPlanning(true)} disabled={any}>
                        <CalendarClock size={15} aria-hidden="true" /> Schedule for later
                    </button>
                )
            )}

            {state === 'published' && (
                <div className="be-pub-actions">
                    <Button variant="ghost" icon={EyeOff} onClick={onUnpublish} loading={busy === 'unpublish'} disabled={any}>Unpublish</Button>
                    <Button variant="ghost" icon={ExternalLink} href={post.url} target="_blank" rel="noreferrer">View on site</Button>
                </div>
            )}

            {post?.id && (
                <>
                    <hr className="ak-divider" />
                    <KeyValue items={[
                        ['Length', `${words.toLocaleString()} words · ${Math.max(1, Math.round(words / 225))} min read`],
                        ['Created', shortDay(post.created_at)],
                        ['Last saved', dateTime(post.updated_at)],
                    ]}
                    />
                    <button type="button" className="be-link-btn is-danger" onClick={onDelete} disabled={any}>
                        <Trash2 size={15} aria-hidden="true" /> Delete post
                    </button>
                </>
            )}
        </Card>
    );
}
