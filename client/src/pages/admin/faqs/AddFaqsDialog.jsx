import { useMemo, useState } from 'react';
import { Button, Checkbox, EmptyState, Modal, SearchInput, Select } from '../../../components/admin/ui';
import { HelpCircle } from 'lucide-react';
import { snippet } from './faqPages';

const SHOW_AT_MOST = 80;

/**
 * Pick existing FAQs to add to a page: search, filter by category, tick any
 * number. FAQs already on the page are left out. onAdd(ids) adds them at the
 * end of the page's list (the dialog closes when it resolves).
 */
export default function AddFaqsDialog({ faqs, categories, onPage, pageName, onAdd, onClose }) {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('');
    const [picked, setPicked] = useState([]);
    const [saving, setSaving] = useState(false);

    const categoryName = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
    const available = useMemo(() => faqs.filter(f => !onPage.has(f.id)), [faqs, onPage]);
    const needle = query.trim().toLowerCase();
    const matches = useMemo(() => available.filter(f => {
        if (category && String(f.category_id ?? '') !== category) return false;
        return !needle || f.question.toLowerCase().includes(needle) || String(f.answer || '').toLowerCase().includes(needle);
    }), [available, category, needle]);
    const shown = matches.slice(0, SHOW_AT_MOST);

    const toggle = (id, on) => setPicked(prev => (on ? [...prev, id] : prev.filter(x => x !== id)));
    const add = async () => {
        setSaving(true);
        try {
            await onAdd(picked);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            title={`Add FAQs to ${pageName}`}
            subtitle={onPage.size ? `They go after the ${onPage.size} already on it; FAQs already there are not listed.` : 'Tick the questions to show on this page.'}
            size="lg"
            onClose={onClose}
            footer={(
                <>
                    <span className="ac-faq-add-count" aria-live="polite">{picked.length ? `${picked.length} picked` : ''}</span>
                    <Button onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button variant="primary" onClick={add} loading={saving} disabled={!picked.length}>
                        {picked.length === 1 ? 'Add 1 FAQ' : `Add ${picked.length || ''} FAQs`.replace('  ', ' ')}
                    </Button>
                </>
            )}
        >
            <div className="ac-faq-add-filters">
                <SearchInput value={query} onChange={setQuery} placeholder="Search questions and answers…" label="Search FAQs" className="ac-faq-add-search" />
                <Select
                    className="ac-toolbar-select"
                    aria-label="Filter by category"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    options={[{ value: '', label: 'All categories' }, ...categories.map(c => ({ value: String(c.id), label: c.name }))]}
                />
            </div>
            {shown.length ? (
                <div className="ac-faq-add-list" role="group" aria-label="FAQs">
                    {shown.map(f => (
                        <Checkbox
                            key={f.id}
                            className="ac-faq-add-item"
                            checked={picked.includes(f.id)}
                            onChange={on => toggle(f.id, on)}
                            label={(
                                <span className="ac-faq-picker-label">
                                    <span>{f.question}</span>
                                    <small>{f.show_on_faq_page === false ? 'Page-only' : categoryName.get(f.category_id) || 'No category'} · {snippet(f.answer, 90)}</small>
                                </span>
                            )}
                        />
                    ))}
                    {matches.length > shown.length && (
                        <p className="ac-faq-picker-empty">Showing {shown.length} of {matches.length}. Search to find the others.</p>
                    )}
                </div>
            ) : (
                <EmptyState icon={HelpCircle} title={available.length ? 'No FAQs match' : 'Every FAQ is on this page'}>
                    {available.length ? 'Try other words or another category.' : 'There is nothing left to add.'}
                </EmptyState>
            )}
        </Modal>
    );
}
