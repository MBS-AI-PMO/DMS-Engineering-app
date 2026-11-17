import { BarChart3, BookOpen, Code, ListChecks } from 'lucide-react';
import { Card, Field, Input, Textarea } from '../../../components/admin/ui';
import ImageField from '../catalog/ImageField';
import RowsEditor from '../catalog/RowsEditor';
import RawJsonEditor from '../catalog/RawJsonEditor';

const RATINGS = [1, 2, 3, 4, 5].map(v => ({ value: v, label: `${v} / 5` }));
const FEATURE_COLUMNS = [
    { key: 'label', label: 'Feature', placeholder: 'e.g. Weldability', width: 'minmax(0, 2fr)' },
    { key: 'rating', label: 'Rating', type: 'select', options: RATINGS, parse: Number },
];
const ITEM_COLUMNS = [{ key: null, label: 'Item', placeholder: 'e.g. Enclosures and brackets' }];

/** The "About this metal" block: text and picture, feature ratings, capabilities. */
export default function MetalAbout({ about, onChange, upload, metalName }) {
    const a = about || {};
    const caps = a.capabilities || {};
    const set = (patch) => onChange({ ...a, ...patch });
    const setCaps = (patch) => set({ capabilities: { ...caps, ...patch } });

    return (
        <>
            <Card title="About" icon={BookOpen}>
                <Field label="Title" optional>
                    <Input value={a.title || ''} onChange={e => set({ title: e.target.value })} placeholder={`e.g. What is ${metalName || 'this metal'}?`} />
                </Field>
                <Field label="Text" optional>
                    <Textarea rows={5} value={a.text || ''} onChange={e => set({ text: e.target.value })} />
                </Field>
                <Field as="div" label="Picture" optional>
                    <ImageField value={a.image || ''} onChange={v => set({ image: v })} upload={upload} alt="" placeholder="/uploads/metals/…" />
                </Field>
            </Card>

            <Card title="Feature chart" icon={BarChart3} subtitle="Rated 1 to 5 on the metal page.">
                <RowsEditor
                    rows={a.featureChart || []}
                    onChange={rows => set({ featureChart: rows })}
                    columns={FEATURE_COLUMNS}
                    newRow={{ label: '', rating: 3 }}
                    itemLabel="feature"
                    reorder
                />
            </Card>

            <Card title="Capabilities" icon={ListChecks}>
                <Field label="Title" optional>
                    <Input value={caps.title || ''} onChange={e => setCaps({ title: e.target.value })} />
                </Field>
                <Field label="Text" optional>
                    <Textarea rows={3} value={caps.text || ''} onChange={e => setCaps({ text: e.target.value })} />
                </Field>
                <Field as="div" label="Items" optional>
                    <RowsEditor rows={caps.items || []} onChange={rows => setCaps({ items: rows })} columns={ITEM_COLUMNS} newRow="" scalar itemLabel="item" reorder />
                </Field>
            </Card>

            <details className="cat-fold">
                <summary><Code size={15} aria-hidden="true" /> About as JSON</summary>
                <div className="cat-fold-body">
                    <RawJsonEditor label="about_section" value={about} onChange={onChange} />
                </div>
            </details>
        </>
    );
}
