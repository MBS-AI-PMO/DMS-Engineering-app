import { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { useFaqJsonLd } from './useFaqJsonLd';
import '../../styles/FaqPage.css';
import '../../styles/PageFaqs.css';

/**
 * FAQs admin placed on this page, in a band above the footer. It is the FAQ
 * page's panel and accordion (same fp- classes): one answer open at a time,
 * a plus that turns into a red cross. Up / Down / Home / End move between
 * the questions. Also writes the FAQPage structured data for them.
 * Loaded only on pages that have placed FAQs (see PageFaqsSlot).
 */

const MOVE_KEYS = ['ArrowDown', 'ArrowUp', 'Home', 'End'];

export function FaqAccordion({ items }) {
    const [openId, setOpenId] = useState(null);
    const baseId = useId();
    const listRef = useRef(null);

    const onKeyDown = (e) => {
        if (!MOVE_KEYS.includes(e.key)) return;
        const buttons = [...listRef.current.querySelectorAll('.fp-q-btn')];
        const at = buttons.indexOf(document.activeElement);
        if (at === -1) return;
        e.preventDefault();
        const last = buttons.length - 1;
        const next = e.key === 'Home' ? 0
            : e.key === 'End' ? last
                : e.key === 'ArrowDown' ? (at === last ? 0 : at + 1)
                    : (at === 0 ? last : at - 1);
        buttons[next].focus();
    };

    return (
        <ul className="fp-list" ref={listRef} onKeyDown={onKeyDown}>
            {items.map((item, index) => {
                const isOpen = openId === item.id;
                const buttonId = `${baseId}-q${index}`;
                const panelId = `${baseId}-a${index}`;
                return (
                    <li key={item.id} className={`fp-item${isOpen ? ' is-open' : ''}`}>
                        <h3 className="fp-q">
                            <button
                                type="button"
                                id={buttonId}
                                className="fp-q-btn"
                                aria-expanded={isOpen}
                                aria-controls={panelId}
                                onClick={() => setOpenId(isOpen ? null : item.id)}
                            >
                                <span className="fp-q-text"><span className="fp-q-label">{item.question}</span></span>
                                <span className="fp-q-icon" aria-hidden="true"><Plus size={16} /></span>
                            </button>
                        </h3>
                        {/* Closed answers stay in the page for the height animation;
                            inert keeps them out of Tab and screen readers. */}
                        <div id={panelId} className="fp-a" role="region" aria-labelledby={buttonId} inert={!isOpen}>
                            <div className="fp-a-inner">
                                <p className="fp-a-text">{item.answer}</p>
                            </div>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

export default function PageFaqs({ items }) {
    const titleId = useId();
    useFaqJsonLd(items);

    return (
        <section className="fp pf" aria-labelledby={titleId}>
            <div className="fp-inner pf-inner">
                <div className="fp-panel pf-panel">
                    <div className="fp-panel-head">
                        <h2 id={titleId} className="fp-panel-title">Frequently asked questions</h2>
                        <Link to="/faq" className="pf-all">
                            All FAQs
                            <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                    </div>
                    <FaqAccordion items={items} />
                    <div className="fp-foot">
                        <span>Still have a question?</span>
                        <Link to="/contact" className="fp-foot-link">
                            Send us a message
                            <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}
