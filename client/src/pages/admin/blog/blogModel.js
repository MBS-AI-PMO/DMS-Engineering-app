/*
 * Admin > Blog: post states, the edit form and its payload, dates.
 * The editor document (content) is TipTap JSON; the server checks it
 * against a fixed list of blocks (backend/blog/content.js).
 */
import { docText, slugify } from '../../../components/blog/blogDoc';

export const STATES = {
    draft: { label: 'Draft', tone: 'gray' },
    scheduled: { label: 'Scheduled', tone: 'amber' },
    published: { label: 'Published', tone: 'green' },
};
export const stateMeta = (state) => STATES[state] || STATES.draft;

export const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

/* The fields the editor saves, in a fixed order (so two forms compare as text). */
export const FORM_KEYS = ['title', 'slug', 'excerpt', 'cover_image', 'cover_alt', 'content', 'category', 'tags',
    'author_name', 'seo_title', 'seo_description', 'og_image'];

export function toForm(post = {}) {
    return {
        title: post.title || '',
        slug: post.slug || '',
        excerpt: post.excerpt || '',
        cover_image: post.cover_image || '',
        cover_alt: post.cover_alt || '',
        content: post.content && post.content.type === 'doc' ? post.content : EMPTY_DOC,
        category: post.category || '',
        tags: Array.isArray(post.tags) ? post.tags : [],
        author_name: post.author_name || '',
        seo_title: post.seo_title || '',
        seo_description: post.seo_description || '',
        og_image: post.og_image || '',
    };
}

/* What is sent to the server: the form, keys in order. */
export const payloadOf = (form) => Object.fromEntries(FORM_KEYS.map(k => [k, form[k]]));
export const serialize = (form) => JSON.stringify(payloadOf(form));

/* Nothing typed yet: no point creating a post for it. */
const hasMedia = (node) => Boolean(node) && (['image', 'youtube', 'table', 'horizontalRule'].includes(node.type) || (node.content || []).some(hasMedia));
export function isBlank(form) {
    return !form.title.trim() && !form.excerpt.trim() && !form.cover_image && !docText(form.content) && !hasMedia(form.content);
}

/* The slug the title gives, and whether a slug still follows the title. */
export const slugFromTitle = (title) => slugify(title) || '';
export const followsTitle = (slug, title) => {
    const base = slugFromTitle(title);
    return !slug || slug === base || new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d+$`).test(slug) || /^untitled(-\d+)?$/.test(slug);
};

/* Dates */
const asDate = (value) => (value instanceof Date ? value : new Date(value));
export function dateTime(value) {
    const d = asDate(value);
    if (!value || Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export function shortDay(value) {
    const d = asDate(value);
    if (!value || Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
export function clock(value) {
    const d = asDate(value);
    if (!value || Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
/* "just now", "5 min ago", "3 h ago", else the day. */
export function ago(value) {
    const d = asDate(value);
    if (!value || Number.isNaN(d.getTime())) return '';
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 45) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return shortDay(d);
}
/* <input type="datetime-local"> value for a date, in this browser's time zone. */
export function toLocalInput(value) {
    const d = asDate(value);
    if (!value || Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/* A valid time at least a minute from now (a publish time). */
export const isComing = (date) => Boolean(date) && !Number.isNaN(date.getTime()) && date.getTime() > Date.now() + 60 * 1000;

/* Tomorrow at 9:00, a sensible first suggestion for "schedule". */
export function suggestedTime() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
}
