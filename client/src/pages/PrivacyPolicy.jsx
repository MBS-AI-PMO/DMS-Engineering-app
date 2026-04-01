import React from 'react';
import { motion } from 'framer-motion';// eslint-disable-line no-unused-vars
import { Shield, ChevronLeft, Lock, Eye, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const PrivacyPolicy = () => {
  const sections = [
    {
      title: "1. Information We Collect",
      content: "We collect information you provide directly to us (e.g., when you create an account, upload a CAD model, or request a quote). This includes contact details, design specifications, and payment information.",
      icon: <Eye size={20} className="text-danger" />
    },
    {
      title: "2. How We Use Your Data",
      content: "Your data is used to provide instant pricing, process manufacturing orders, and improve our CAD analysis algorithms. We do not sell your intellectual property to third parties.",
      icon: <Lock size={20} className="text-danger" />
    },
    {
      title: "3. IP Protection",
      content: "DMS Metals respects the confidentiality of your designs. All uploaded CAD files are stored on secure servers and are only accessible by automated analysis systems or authorized production staff.",
      icon: <Shield size={20} className="text-danger" />
    },
    {
      title: "4. Cookies & Tracking",
      content: "We use essential cookies to maintain your session and shopping cart. Analytical cookies help us understand how users interact with our pricing tools to enhance the user experience.",
      icon: <CheckCircle size={20} className="text-danger" />
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="privacy-page bg-white py-20"
    >
      <div className="container" style={{ maxWidth: '800px' }}>
        <Link to="/" className="breadcrumb-back text-danger text-decoration-none p-0">
          <ChevronLeft size={16} /> BACK TO HOME
        </Link>
        <header className="mb-16">
          <span className="technical-mono text-danger fw-black letter-spacing-2 text-xxs mb-1 d-block opacity-50">LEGAL DOCUMENT</span>
          <h1 className="display-4 fw-black text-dark mb-4">Privacy Policy</h1>
          <p className="text-muted fs-5 leading-relaxed">
            Last Updated: April 1, 2026. Your privacy and the security of your intellectual property are our top priorities.
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
            <h3 className="fs-5 fw-bold mb-4">Questions?</h3>
            <p className="text-muted m-0">
              If you have concerns about your data security, please contact our security team at <Link to="/contact" className="text-danger fw-bold">privacy@dms-metals.com</Link>.
            </p>
          </div>
        </main>
      </div>
    </motion.div>
  );
};

export default PrivacyPolicy;
