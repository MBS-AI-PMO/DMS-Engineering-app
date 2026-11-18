import { useEffect, useId, useState } from 'react';
import { Check, Info, Link2, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Card, Field, Input, Textarea } from '../../../components/admin/ui';
import { blogService } from '../../../services/admin/blog';
import { slugify } from '../../../components/blog/blogDoc';
import CharCount from '../content/CharCount';
import TagInput from './TagInput';
import { slugFromTitle } from './blogModel';

/* The post's address: /blog/<slug>, from the title until edited. Says
 * whether it is free (the server adds -2, -3… when it is not). */
function SlugField({ form, set, auto, setAuto, post }) {
    const [check, setCheck] = useState(null);
    const slug = form.slug;
    const live = post?.state === 'published';

    useEffect(() => {
        if (!slug) return undefined;
        let cancelled = false;
        const t = setTimeout(() => {
            blogService.checkSlug(slug, post?.id).then(r => { if (!cancelled) setCheck({ ...r, for: slug }); }).catch(() => {});
        }, 450);
        return () => { cancelled = true; clearTimeout(t); };
    }, [slug, post?.id]);

    const result = check && check.for === slug ? check : null;
    const taken = result && !result.available;

    return (
        <Field
            label="Address"
            error={taken ? `Another post uses this address. It will be saved as /blog/${result.suggestion}.` : undefined}
            hint={live && post.slug !== slug
                ? 'The old address will keep working and forward here.'
                : auto ? 'Made from the title. Type here to choose your own.' : undefined}
        >
            <span className="be-slug">
                <span className="be-slug-prefix" aria-hidden="true">/blog/</span>
                <Input
                    value={slug}
                    onChange={e => { setAuto(false); set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 120) }); }}
                    onBlur={() => set({ slug: slugify(slug) || slugFromTitle(form.title) })}
                    placeholder={slugFromTitle(form.title) || 'post-address'}
                    aria-label="Address of the post, after /blog/"
                    invalid={Boolean(taken)}
                />
                {result?.available && <Check size={15} className="be-slug-ok" aria-label="Free" />}
            </span>
            {!auto && !live && slugFromTitle(form.title) && slug !== slugFromTitle(form.title) && (
                <button type="button" className="be-link-btn" onClick={() => { setAuto(true); set({ slug: slugFromTitle(form.title) }); }}>
                    <RotateCcw size={13} aria-hidden="true" /> Use the title
                </button>
            )}
        </Field>
    );
}

/**
 * Address, summary, category, tags and author. topics: { categories,
 * tags, authors } already used, offered as suggestions.
 */
export default function PostDetailsCard({ form, set, slugAuto, setSlugAuto, post, topics, autoExcerpt }) {
    const catList = useId();
    const authorList = useId();
    return (
        <Card title="Post details" icon={SlidersHorizontal}>
            <SlugField form={form} set={set} auto={slugAuto} setAuto={setSlugAuto} post={post} />

            <Field label={<>Summary <CharCount value={form.excerpt} max={160} /></>} optional hint="Shown on the blog page under the title, and to search engines when there is no SEO description. Empty: the start of the post.">
                <Textarea rows={3} value={form.excerpt} onChange={e => set({ excerpt: e.target.value })} maxLength={400} placeholder={autoExcerpt || 'A sentence or two about the post'} />
            </Field>

            <Field label="Category" optional hint="One topic, used to filter the blog.">
                <Input value={form.category} onChange={e => set({ category: e.target.value })} maxLength={80} list={catList} placeholder="e.g. Guides" />
                <datalist id={catList}>{(topics.categories || []).map(c => <option key={c.name} value={c.name} />)}</datalist>
            </Field>

            <Field as="div" label="Tags" optional hint="Press Enter or type a comma after each one. Up to 12.">
                <TagInput value={form.tags} onChange={tags => set({ tags })} suggestions={(topics.tags || []).map(t => t.name)} />
            </Field>

            <Field label="Author" optional hint={post?.id ? 'Shown under the title.' : `Shown under the title. Empty: ${topics.me || 'you'}.`}>
                <Input value={form.author_name} onChange={e => set({ author_name: e.target.value })} maxLength={120} list={authorList} placeholder={post?.id ? 'Name shown under the title' : topics.me || 'Name'} />
                <datalist id={authorList}>{(topics.authors || []).map(a => <option key={a} value={a} />)}</datalist>
            </Field>

            {post?.previous_slugs?.length > 0 && (
                <p className="ak-hint be-old-slugs">
                    <Info size={13} aria-hidden="true" /> Old addresses that forward here: {post.previous_slugs.map(s => `/blog/${s}`).join(', ')}
                </p>
            )}
            {post?.state === 'published' && (
                <a className="be-link-btn" href={post.url} target="_blank" rel="noreferrer"><Link2 size={13} aria-hidden="true" /> {window.location.host}{post.url}</a>
            )}
        </Card>
    );
}
