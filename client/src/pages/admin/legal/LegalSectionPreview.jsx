import LegalIcon from '../../../components/LegalIcon';
import { sectionBlocks } from './legalText';

const Block = ({ block }) => {
    if (block.type === 'ul') return <ul>{block.items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
    if (block.type === 'ol') return <ol start={block.start !== 1 ? block.start : undefined}>{block.items.map((item, i) => <li key={i}>{item}</li>)}</ol>;
    return <p>{block.text}</p>;
};

/** One section drawn the way the public Privacy policy / Terms pages show it. */
export default function LegalSectionPreview({ serial, heading, icon, paragraphs }) {
    const blocks = sectionBlocks(paragraphs);
    return (
        <div className="ac-lg-preview" aria-label="Preview">
            <div className="ac-lg-preview-head">
                <span className="ac-lg-preview-icon" aria-hidden="true"><LegalIcon name={icon} size={18} /></span>
                <h3 className="ac-lg-preview-title">
                    {serial && <span className="ac-lg-preview-num">{serial}</span>}
                    <span>{heading || 'Section heading'}</span>
                </h3>
            </div>
            <div className="ac-lg-prose">
                {blocks.length ? blocks.map((block, i) => <Block key={i} block={block} />) : <p className="ac-lg-preview-empty">The text you write shows here.</p>}
            </div>
        </div>
    );
}
