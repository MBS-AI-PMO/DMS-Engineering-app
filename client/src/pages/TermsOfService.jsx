import React from 'react';
import { motion } from 'framer-motion';// eslint-disable-line no-unused-vars
import { ShieldAlert, ChevronLeft, Zap, ClipboardIcon, Hammer } from 'lucide-react';
import { Link } from 'react-router-dom';

const TermsOfService = () => {
    const sections = [
        {
            title: "1. Acceptance of Terms",
            content: "By accessing the DMS Metals platform, you agree to comply with our technical and safety guidelines. These terms govern all CAD uploads, instant pricing requests, and manufacturing orders.",
            icon: <ClipboardIcon size={20} className="text-danger" />
        },
        {
            title: "2. CAD File Accuracy",
            content: "Users are responsible for the accuracy of their 3D models and DXF drawings. DMS Metals uses automated analysis but the final structural integrity and functional correctness of the part belong to the user.",
            icon: <Zap size={20} className="text-danger" />
        },
        {
            title: "3. Manufacturing & Quality",
            content: "Our quotes are based on the specifications provided. Changes made after order placement may incur additional fees. We guarantee precision within our stated manufacturing tolerances (+/- 0.1mm unless specified).",
            icon: <Hammer size={20} className="text-danger" />
        },
        {
            title: "4. Intellectual Property",
            content: "You retain all rights to your uploaded designs. By uploading, you grant DMS Metals a temporary license only to analyze, quote, and manufacture the requested parts.",
            icon: <ShieldAlert size={20} className="text-danger" />
        }
    ];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="terms-page bg-white py-20"
        >
            <div className="container" style={{ maxWidth: '800px' }}>
                <Link to="/" className="breadcrumb-back text-danger text-decoration-none p-0">
                    <ChevronLeft size={16} /> BACK TO HOME
                </Link>

                <header className="mb-16">
                    <span className="technical-mono text-danger fw-black letter-spacing-2 text-xxs mb-1 d-block opacity-50">LEGAL DOCUMENT</span>
                    <h1 className="display-4 fw-black text-dark mb-4">Terms of Service</h1>
                    <p className="text-muted fs-5 leading-relaxed">
                        Last Updated: April 1, 2026. Please read these terms carefully before starting your manufacturing project.
                    </p>
                    <div className="border-bottom border-light-subtle pt-10" />
                </header>

                <main className="d-flex flex-column gap-12">
                    {sections.map((section, idx) => (
                        <section key={idx} className="policy-section">
                            <div className="d-flex align-items-center gap-3 mb-4">
                                <div className="policy-icon-box">
                                    {section.icon}
                                </div>
                                <h2 className="fs-4 fw-bold m-0 text-dark">{section.title}</h2>
                            </div>
                            <p className="text-muted leading-relaxed" style={{ fontSize: '1.1rem' }}>
                                {section.content}
                            </p>
                        </section>
                    ))}

                    <div className="agreement-card">
                        <h3 className="fs-5 fw-bold mb-4">Agreement</h3>
                        <p className="text-muted m-0">
                            By clicking "PROCEED TOWARD QUOTE" on our pricing tools, you acknowledge that you have read and agreed to these technical manufacturing terms.
                        </p>
                    </div>
                </main>
            </div>
        </motion.div>
    );
};

export default TermsOfService;
