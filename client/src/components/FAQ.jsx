import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Plus } from 'lucide-react';
import '../styles/HomeFaq.css';

/**
 * Home page FAQ: the heading and the way to the full list on the left,
 * the questions on the right, one open at a time, a hairline above each.
 */

const FAQData = [
    {
        question: "What are your standard production times?",
        answer: "Your estimated ship date is calculated in real-time in your shopping cart as you add parts and services. Production times for standard orders without additional services like bending or finishing are typically 2-4 business days before shipping."
    },
    {
        question: "How do I get a Formal Quote from DMS Engineering?",
        answer: "Formal Quotes make it easy to send a link to your accounts payable department so they can process payment for orders online, while the order itself remains associated with your account. This allows you to remain the point of contact if there are any questions during production. Read the complete FAQ for detailed info!"
    },
    {
        question: "What is your cut tolerance?",
        answer: "The cut tolerance for each material depends on the cutting process for that material and specific thickness. You can find cut tolerance specifications for each stock thickness on the material pages in our Material Catalog."
    },
    {
        question: "What if I don't have a CAD file?",
        answer: "If you don't have a CAD file, there are multiple options available! You can use our free Parts Builder, enlist our Design Services for sketch-to-CAD conversion, or contact an available designer."
    },
    {
        question: "Why won't my part file upload?",
        answer: "There are a few reasons why your part file may not be uploading successfully to DMS Engineering's website. We'll cover these scenarios and give you tips in our full FAQ."
    }
];

const FAQ = () => {
    const [activeIndex, setActiveIndex] = useState(null);
    const reduceMotion = useReducedMotion();
    const baseId = useId();

    const toggleAccordion = (index) => {
        setActiveIndex((current) => (current === index ? null : index));
    };

    const reveal = (delay = 0) => (reduceMotion ? {} : {
        initial: { opacity: 0, y: 12 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-40px' },
        transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] },
    });

    return (
        <section id="faq" className="hf" aria-labelledby="hf-title">
            <div className="hf-inner">
                <motion.div className="hf-head" {...reveal()}>
                    <h2 id="hf-title" className="hf-title">Frequently asked questions</h2>
                    <p className="hf-lede">Quick answers to the most common questions about ordering, quoting, and production.</p>
                    <div className="hf-head-actions">
                        <Link to="/faq" className="hf-btn">
                            View all FAQs
                            <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                        <Link to="/contact" className="hf-ask">Still stuck? Contact us</Link>
                    </div>
                </motion.div>

                <ul className="hf-list">
                    {FAQData.map((item, index) => {
                        const isOpen = activeIndex === index;
                        const buttonId = `${baseId}-q${index}`;
                        const panelId = `${baseId}-a${index}`;
                        return (
                            <motion.li
                                key={item.question}
                                className={`hf-item${isOpen ? ' is-open' : ''}`}
                                {...reveal(Math.min(index, 6) * 0.04)}
                            >
                                <h3 className="hf-q">
                                    <button
                                        type="button"
                                        id={buttonId}
                                        className="hf-q-btn"
                                        onClick={() => toggleAccordion(index)}
                                        aria-expanded={isOpen}
                                        aria-controls={panelId}
                                    >
                                        <span className="hf-q-text">{item.question}</span>
                                        <span className="hf-q-icon" aria-hidden="true">
                                            <Plus size={16} />
                                        </span>
                                    </button>
                                </h3>
                                {/* Closed answers stay in the page for the height
                                    animation; inert keeps their link out of Tab. */}
                                <div
                                    id={panelId}
                                    className="hf-a"
                                    role="region"
                                    aria-labelledby={buttonId}
                                    inert={!isOpen}
                                >
                                    <div className="hf-a-inner">
                                        <p className="hf-a-text">{item.answer}</p>
                                        <Link to="/faq" className="hf-a-link">
                                            Read the full FAQ
                                            <ArrowRight size={14} aria-hidden="true" />
                                        </Link>
                                    </div>
                                </div>
                            </motion.li>
                        );
                    })}
                </ul>
            </div>
        </section>
    );
};

export default FAQ;
