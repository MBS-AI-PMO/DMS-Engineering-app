import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Eye, ExternalLink, Newspaper } from 'lucide-react';
import {
    Banner, Button, Card, Page, PageHeader, Pill, SideLayout, Skeleton, useConfirm,
} from '../../../components/admin/ui';
import { useToast } from '../../../context/ToastContext';
import { blogService } from '../../../services/admin/blog';
import { siteSettingsService } from '../../../services/admin/siteSettings';
import { nodeText } from '../../../components/blog/blogDoc';
import { normalizeSeoMeta } from '../../../utils/seo';
import BlogPreview from './BlogPreview';
import CoverCard from './CoverCard';
import EditorCard from './EditorCard';
import PostDetailsCard from './PostDetailsCard';
import PublishCard from './PublishCard';
import SaveState from './SaveState';
import SeoCard from './SeoCard';
import { dropBackup, readBackup, usePostSaver } from './usePostSaver';
import { ago, dateTime, followsTitle, isBlank, payloadOf, serialize, slugFromTitle, stateMeta, toForm } from './blogModel';
import '../content/content.css';
import './blogAdmin.css';

/* A summary from the opening paragraphs, as the site makes one when there is none. */
function autoExcerptOf(doc) {
    const flat = (doc?.content || []).filter(n => n.type === 'paragraph').map(nodeText).join(' ').replace(/\s+/g, ' ').trim().slice(0, 800);
    if (flat.length <= 180) return flat;
    const cut = flat.slice(0, 181);
    const at = cut.lastIndexOf(' ');
    return `${cut.slice(0, at > 108 ? at : 180).replace(/[\s,;:.–—-]+$/, '')}…`;
}

/**
 * Admin > Blog > a post (/admin/blog/new, /admin/blog/:id): the editor in
 * the main column; publishing, address and details, cover, and search and
 * sharing in the side column. Drafts save themselves as you write (see
 * usePostSaver); a live post changes on the site when you update it.
 * ?preview=1 opens the preview straight away.
 */
export default function BlogEditPage() {
    const { id: routeId } = useParams();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const toast = useToast();
    const [confirm, confirmDialog] = useConfirm();

    const [form, setForm] = useState(() => toForm());
    const [editorKey, setEditorKey] = useState(0);
    const [loading, setLoading] = useState(Boolean(routeId));
    const [loadError, setLoadError] = useState('');
    const [words, setWords] = useState(0);
    const [slugAuto, setSlugAuto] = useState(true);
    const [topics, setTopics] = useState({});
    const [seo, setSeo] = useState(null);
    const [busy, setBusy] = useState(null);
    const [focus, setFocus] = useState(false);
    const [preview, setPreview] = useState(false);
    const [backup, setBackup] = useState(null);
    const loadedId = useRef(null);

    const saver = usePostSaver(form, {
        onCreated: (id) => {
            loadedId.current = String(id);
            navigate(`/admin/blog/${id}`, { replace: true });
        },
        onServerFields: (fields) => setForm(f => ({ ...f, ...fields })),
    });
    const { post, reset } = saver;

    const set = useCallback((patch) => setForm(f => ({ ...f, ...patch })), []);
    const setTitle = (title) => setForm(f => ({ ...f, title, ...(slugAuto ? { slug: slugFromTitle(title) } : {}) }));
    const onContent = useCallback((doc, count) => {
        setWords(count);
        if (doc) setForm(f => ({ ...f, content: doc }));
    }, []);

    // Suggestions and the site's SEO defaults, once.
    useEffect(() => {
        blogService.topics().then(setTopics).catch(() => {});
        siteSettingsService.all().then(s => setSeo(normalizeSeoMeta(s?.seo_meta).defaults)).catch(() => {});
    }, []);

    const showLoaded = useCallback((row) => {
        const f = toForm(row);
        loadedId.current = String(row.id);
        setForm(f);
        reset(row, f);
        setWords(row.word_count || 0);
        setEditorKey(k => k + 1);
        setSlugAuto(row.state === 'draft' && !row.previous_slugs?.length && followsTitle(row.slug, row.title));
        return f;
    }, [reset]);

    // Load the post (not again right after creating it here).
    useEffect(() => {
        if (!routeId) {
            // Back to "new" from a post (the page is reused): start blank.
            if (loadedId.current) {
                const blank = toForm();
                setForm(blank);
                reset(null, blank);
                setWords(0);
                setSlugAuto(true);
                setEditorKey(k => k + 1);
            }
            loadedId.current = null;
            const saved = readBackup(null);
            if (saved && !isBlank(toForm(saved.form))) setBackup(saved);
            return undefined;
        }
        if (loadedId.current === routeId) return undefined;
        let cancelled = false;
        setLoading(true);
        blogService.get(routeId)
            .then(row => {
                if (cancelled) return;
                const f = showLoaded(row);
                const saved = readBackup(row.id);
                if (saved && saved.at > Date.parse(row.updated_at) && serialize(toForm(saved.form)) !== serialize(f)) setBackup(saved);
                setLoadError('');
            })
            .catch(err => { if (!cancelled) setLoadError(err.status === 404 ? 'There is no post with this number. It may have been deleted.' : err.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [routeId, showLoaded, reset]);

    // ?preview=1 (from the list) opens the preview once the post is in.
    useEffect(() => {
        if (loading || params.get('preview') !== '1') return;
        setPreview(true);
        setParams(prev => { const next = new URLSearchParams(prev); next.delete('preview'); return next; }, { replace: true });
    }, [loading, params, setParams]);

    const autoExcerpt = useMemo(() => autoExcerptOf(form.content), [form.content]);

    const upload = useCallback(async (file) => blogService.uploadImage(file), []);
    const uploadError = useCallback((message) => toast(message, 'error'), [toast]);

    const run = async (kind, work) => {
        setBusy(kind);
        try { return await work(); } catch (err) {
            if (!(err?.status === 409)) toast(err.message, 'error');
            return null;
        } finally { setBusy(null); }
    };

    const saveNow = () => run('save', async () => {
        const row = await saver.save();
        if (row) toast(saver.live ? 'Post updated on the site' : 'Draft saved', 'success');
        else if (!post?.id) toast('Write a title or some text first.', 'info');
    });

    const publish = async () => {
        if (!(await confirm({ title: 'Publish this post?', message: 'It goes on the blog right away, where anyone can read it.', confirmLabel: 'Publish now' }))) return;
        await run('publish', async () => {
            const row = await saver.act('publish');
            setSlugAuto(false);
            toast(`Published. It is on the blog at ${row.url}`, 'success');
        });
    };

    const schedule = (when) => run('schedule', async () => {
        const row = await saver.act('schedule', when);
        setSlugAuto(false);
        toast(`Scheduled for ${dateTime(row.published_at)}`, 'success');
    });

    const unpublish = async () => {
        const scheduled = post?.state === 'scheduled';
        if (!(await confirm({
            title: scheduled ? 'Cancel the schedule?' : 'Unpublish this post?',
            message: scheduled ? 'It goes back to being a draft and will not go live.' : 'It comes off the blog and goes back to being a draft. Links to it stop working until you publish it again.',
            confirmLabel: scheduled ? 'Cancel schedule' : 'Unpublish',
            danger: !scheduled,
        }))) return;
        await run('unpublish', async () => {
            await saver.act('unpublish');
            toast(scheduled ? 'Schedule cancelled. It is a draft again.' : 'Unpublished. It is a draft again.', 'success');
        });
    };

    const reload = () => run('reload', async () => {
        const row = await blogService.get(post.id);
        showLoaded(row);
        dropBackup(row.id);
    });

    const discard = async () => {
        if (!(await confirm({ title: 'Discard your changes?', message: 'The post goes back to how it is on the site.', confirmLabel: 'Discard changes', danger: true }))) return;
        await reload();
    };

    const overwrite = () => run('save', async () => {
        const body = await blogService.save(post.id, payloadOf(form));
        reset(body.data, form);
        toast('Saved over the other version', 'success');
    });

    const remove = async () => {
        if (!(await confirm({
            title: 'Delete this post?',
            message: `It${post.state === 'published' ? ' comes off the blog and' : ''} is removed for good, with its pictures (unless another post uses them).`,
            confirmLabel: 'Delete post',
            danger: true,
        }))) return;
        await run('delete', async () => {
            await blogService.remove(post.id);
            dropBackup(post.id);
            reset(null, form); // nothing left to save on the way out
            toast('Post deleted', 'success');
            navigate('/admin/blog');
        });
    };

    const restore = () => {
        const f = { ...form, ...toForm(backup.form) };
        setForm(f);
        setEditorKey(k => k + 1);
        setSlugAuto(false);
        setBackup(null);
        toast('Your unsaved changes are back', 'success');
    };

    // Ctrl/⌘ S saves.
    const saveRef = useRef(saveNow);
    useEffect(() => { saveRef.current = saveNow; });
    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                saveRef.current();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    const back = { to: '/admin/blog', label: 'Blog' };

    if (loading) {
        return (
            <Page busy>
                <PageHeader back={back} icon={Newspaper} title={<Skeleton width={260} size="lg" />} subtitle="Opening the post…" />
                <SideLayout
                    main={<Card><Skeleton width="60%" size="lg" /><Skeleton /><Skeleton /><Skeleton width="80%" /><Skeleton size="block" /></Card>}
                    side={<Card><Skeleton width="40%" /><Skeleton /><Skeleton /></Card>}
                />
            </Page>
        );
    }
    if (loadError) {
        return (
            <Page>
                <PageHeader back={back} icon={Newspaper} title="Post" />
                <Banner tone="error" action={<Button size="sm" to="/admin/blog">All posts</Button>}>{loadError}</Banner>
            </Page>
        );
    }

    const meta = stateMeta(post?.state || 'draft');
    return (
        <Page className="be-page">
            <PageHeader
                back={back}
                icon={Newspaper}
                title={<>{form.title.trim() || (post?.id ? 'Untitled post' : 'New post')}<Pill tone={meta.tone} dot>{meta.label}</Pill></>}
                subtitle={<SaveState saver={saver} />}
                actions={(
                    <>
                        <Button icon={Eye} onClick={() => setPreview(true)}>Preview</Button>
                        {post?.state === 'published' && <Button icon={ExternalLink} href={post.url} target="_blank" rel="noreferrer">View on site</Button>}
                    </>
                )}
            />

            {backup && (
                <Banner tone="warn" action={(
                    <span className="ak-row-actions">
                        <Button size="sm" variant="primary" onClick={restore}>Restore them</Button>
                        <Button size="sm" variant="ghost" onClick={() => { dropBackup(post?.id); setBackup(null); }}>Dismiss</Button>
                    </span>
                )}
                >
                    Changes to this post from {ago(backup.at)} were not saved, but this browser kept a copy.
                </Banner>
            )}
            {saver.status === 'conflict' && (
                <Banner tone="error" action={(
                    <span className="ak-row-actions">
                        <Button size="sm" onClick={reload} loading={busy === 'reload'}>Load the other version</Button>
                        <Button size="sm" variant="danger" onClick={overwrite} loading={busy === 'save'}>Keep mine</Button>
                    </span>
                )}
                >
                    {saver.error} Saving is paused so nothing is overwritten.
                </Banner>
            )}
            {saver.status === 'error' && (
                <Banner tone="error" action={<Button size="sm" onClick={saveNow} loading={busy === 'save'}>Try again</Button>}>
                    Could not save: {saver.error} {saver.autosave ? 'Trying again shortly; your changes are also kept in this browser.' : 'Your changes are kept in this browser.'}
                </Banner>
            )}

            <SideLayout
                main={(
                    <EditorCard
                        form={form}
                        setTitle={setTitle}
                        editorKey={editorKey}
                        onContent={onContent}
                        words={words}
                        saver={saver}
                        onUpload={upload}
                        onError={uploadError}
                        onPreview={() => setPreview(true)}
                        focus={focus}
                        setFocus={setFocus}
                    />
                )}
                side={(
                    <>
                        <PublishCard
                            saver={saver}
                            words={words}
                            busy={busy}
                            onSave={saveNow}
                            onPublish={publish}
                            onSchedule={schedule}
                            onUnpublish={unpublish}
                            onDiscard={discard}
                            onDelete={remove}
                        />
                        <PostDetailsCard form={form} set={set} slugAuto={slugAuto} setSlugAuto={setSlugAuto} post={post} topics={topics} autoExcerpt={autoExcerpt} />
                        <CoverCard form={form} set={set} />
                        <SeoCard form={form} set={set} seo={seo} autoExcerpt={autoExcerpt} />
                    </>
                )}
            />

            {preview && <BlogPreview form={form} post={post} words={words} autoExcerpt={autoExcerpt} onClose={() => setPreview(false)} />}
            {confirmDialog}
        </Page>
    );
}
