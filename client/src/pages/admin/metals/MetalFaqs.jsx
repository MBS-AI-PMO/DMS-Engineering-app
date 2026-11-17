import { HelpCircle } from 'lucide-react';
import { Card } from '../../../components/admin/ui';
import RowsEditor from '../catalog/RowsEditor';

const COLUMNS = [
    { key: 'question', label: 'Question', type: 'textarea', rows: 2, placeholder: 'e.g. What thicknesses do you offer?' },
    { key: 'answer', label: 'Answer', type: 'textarea', rows: 3, width: 'minmax(0, 1.6fr)' },
];

/** Questions and answers shown on the metal page, in this order. */
export default function MetalFaqs({ faqs, onChange }) {
    return (
        <Card title="FAQs" icon={HelpCircle} count={faqs.length} subtitle="Shown at the bottom of the metal page.">
            <RowsEditor rows={faqs} onChange={onChange} columns={COLUMNS} newRow={{ question: '', answer: '' }} itemLabel="question" addLabel="Add question" reorder />
        </Card>
    );
}
