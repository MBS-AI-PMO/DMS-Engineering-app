import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { Mail, Phone, MapPin, Send, MessageSquare, Clock, Globe, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';

const FAQItem = ({ question, answer }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className={`faq-item ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(!isOpen)}>
            <div className="faq-question">
                <span>{question}</span>
                {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="faq-answer"
                    >
                        <p>{answer}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const Contact = () => {
    const [formState, setFormState] = useState({
        name: '',
        email: '',
        company: '',
        subject: '',
        message: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        alert('Thank you for reaching out! We will get back to you shortly.');
    };

    const handleChange = (e) => {
        setFormState({ ...formState, [e.target.name]: e.target.value });
    };

    const faqs = [
        {
            question: "What is your typical lead time for custom laser cutting?",
            answer: "Our standard lead time is 3-5 business days for most projects. However, we offer expedited services for urgent requirements, which can be as fast as 24-48 hours depending on material availability."
        },
        {
            question: "Do you provide design assistance for complex metal parts?",
            answer: "Yes, our engineering team can review your CAD files and provide suggestions for manufacturability (DFM) to optimize quality and reduce costs."
        },
        {
            question: "What file formats do you accept for quotes?",
            answer: "We primarily work with .DXF, .DWG, and .STEP files. We can also handle .PDF drawings for reference, but vector-based files are preferred for accurate pricing."
        },
        {
            question: "Do you have a minimum order quantity (MOQ)?",
            answer: "No, we cater to both prototyping (single parts) and high-volume production runs. Every project is handled with the same level of precision."
        },
        {
            question: "Is international shipping available?",
            answer: "Absolutely. We ship our precision parts globally using trusted carriers, ensuring safe and timely delivery regardless of your location."
        }
    ];

    return (
        <div className="contact-page">
            {/* HERO SECTION */}
            <section className="contact-hero">
                <div className="contact-hero-overlay"></div>
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="container"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="contact-hero-badge"
                    >
                        <ShieldCheck size={16} />
                        <span>Expert Support & Consulting</span>
                    </motion.div>
                    <h1 className="contact-hero-title">Let's Build Something <span className="highlight">Precise.</span></h1>
                    <p className="contact-hero-subtitle">Engineering Excellence. Delivered Globally. Your vision, our precision.</p>
                </motion.div>
            </section>

            {/* CONTACT MAIN SECTION */}
            <section className="contact-main">
                <div className="container">
                    <div className="contact-grid">
                        {/* LEFT: INFO */}
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="contact-info"
                        >
                            <h2 className="section-title">Get in Touch</h2>
                            <p className="section-desc">Have a project in mind? Our expert team is ready to help you navigate the complexities of metal fabrication and engineering.</p>

                            <div className="contact-cards">
                                <div className="info-card">
                                    <Mail className="card-icon" />
                                    <div className="card-text">
                                        <h3>Email Us</h3>
                                        <p>projects@dms-metals.com</p>
                                        <p>support@dms-metals.com</p>
                                    </div>
                                </div>
                                <div className="info-card">
                                    <Phone className="card-icon" />
                                    <div className="card-text">
                                        <h3>Call Us</h3>
                                        <p>+1 (555) 123-4567</p>
                                        <p>Mon - Fri, 8am - 6pm EST</p>
                                    </div>
                                </div>
                                <div className="info-card">
                                    <MapPin className="card-icon" />
                                    <div className="card-text">
                                        <h3>Visit Us</h3>
                                        <p>1234 Precision Way, Metal City, CA 90210</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* RIGHT: FORM */}
                        <motion.div
                            initial={{ opacity: 0, x: 30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="contact-form-container"
                        >
                            <form className="contact-form" onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label>Full Name</label>
                                    <input type="text" name="name" placeholder="John Doe" required onChange={handleChange} />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Email Address</label>
                                        <input type="email" name="email" placeholder="john@company.com" required onChange={handleChange} />
                                    </div>
                                    <div className="form-group">
                                        <label>Company</label>
                                        <input type="text" name="company" placeholder="Industries Inc." onChange={handleChange} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Subject</label>
                                    <select name="subject" onChange={handleChange}>
                                        <option>Laser Cutting Quote</option>
                                        <option>Material Consultation</option>
                                        <option>Bulk Production</option>
                                        <option>Other</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Message</label>
                                    <textarea name="message" rows="5" placeholder="Tell us about your project..." required onChange={handleChange}></textarea>
                                </div>
                                <button type="submit" className="btn-submit">
                                    Send Message <Send size={18} />
                                </button>
                            </form>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* GLOBAL OFFICES */}
            <section className="offices-section">
                <div className="container">
                    <h2 className="section-title centered">Global Presence</h2>
                    <div className="offices-grid">
                        <div className="office-card">
                            <Globe className="office-icon" />
                            <h3>North America</h3>
                            <p>Headquarters & Primary Production</p>
                            <p className="office-addr">Metal City, CA | Detroit, MI</p>
                        </div>
                        <div className="office-card">
                            <Globe className="office-icon" />
                            <h3>Europe</h3>
                            <p>Design Hub & Distribution</p>
                            <p className="office-addr">Munich, Germany | Sheffield, UK</p>
                        </div>
                        <div className="office-card">
                            <Globe className="office-icon" />
                            <h3>Asia-Pacific</h3>
                            <p>Large Scale Operations</p>
                            <p className="office-addr">Singapore | Melbourne, Australia</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ SECTION */}
            <section className="faq-section">
                <div className="container">
                    <h2 className="section-title centered">Frequently Asked Questions</h2>
                    <div className="faq-list">
                        {faqs.map((faq, index) => (
                            <FAQItem key={index} {...faq} />
                        ))}
                    </div>
                </div>
            </section>

            {/* FINAL CTA */}
            <section className="contact-cta">
                <div className="container">
                    <div className="cta-content">
                        <h2>Ready to Start Your Project?</h2>
                        <p>Join thousands of engineers who trust DMS for their mission-critical components.</p>
                        <button className="btn-cta-primary">GET AN INSTANT QUOTE</button>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Contact;
