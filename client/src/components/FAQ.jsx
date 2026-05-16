import React, { useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

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

    const toggleAccordion = (index) => {
        setActiveIndex((current) => (current === index ? null : index));
    };

    return (
        <section id="faq" className="faq-section faq-landing-section">
            <div className="faq-container">
                <div className="faq-header">
                    <div className="faq-icon-wrapper">
                        <div className="faq-icon">?</div>
                    </div>
                    <h2 className="faq-title">Frequently asked questions</h2>
                    <p className="faq-subtitle">Quick answers to the most common questions about ordering, quoting, and production.</p>
                </div>

                <div className="faq-list">
                    {FAQData.map((item, index) => {
                        const isOpen = activeIndex === index;
                        return (
                            <motion.div
                                key={index}
                                className={`faq-item-custom ${isOpen ? 'active' : ''}`}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.28, delay: index * 0.04, ease: 'easeOut' }}
                            >
                                <motion.button
                                    type="button"
                                    className="faq-question-row"
                                    onClick={() => toggleAccordion(index)}
                                    aria-expanded={isOpen}
                                    whileTap={{ scale: 0.995 }}
                                >
                                    <motion.div
                                        className="faq-icon-circle"
                                        animate={{ rotate: isOpen ? 135 : 0, scale: isOpen ? 1.04 : 1 }}
                                        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                                    >
                                        +
                                    </motion.div>
                                    <h3 className="faq-question-text">{item.question}</h3>
                                </motion.button>
                                <motion.div
                                    className="faq-answer-row"
                                    animate={{
                                        gridTemplateRows: isOpen ? '1fr' : '0fr',
                                        opacity: isOpen ? 1 : 0
                                    }}
                                    initial={false}
                                    transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
                                >
                                    <motion.div
                                        className="faq-answer-inner"
                                        animate={{ y: isOpen ? 0 : -4 }}
                                        transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
                                    >
                                        <p className="faq-answer-text">{item.answer}</p>
                                        <Link to="/faq" className="faq-link">READ FULL FAQ -&gt;</Link>
                                    </motion.div>
                                </motion.div>
                            </motion.div>
                        );
                    })}
                </div>

                <div className="faq-footer">
                    <Link to="/faq" className="view-all-faq">VIEW ALL FAQS -&gt;</Link>
                </div>
            </div>
        </section>
    );
};

export default FAQ;
