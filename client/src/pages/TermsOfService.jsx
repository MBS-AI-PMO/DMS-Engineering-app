import React from 'react';
import LegalDocument from '../components/LegalDocument';

/**
 * Terms of service (/terms-of-service). The sections are written in
 * Admin > Terms & Policy (type "terms"); LegalDocument loads and lays
 * them out.
 */
const TermsOfService = () => (
    <LegalDocument
        type="terms"
        art="document"
        titleStrong="Terms"
        titleLight="of service"
        crumb="Terms of service"
        docName="terms of service"
        lede="Please read these terms carefully before starting your manufacturing project."
        questions={{
            title: 'Questions about these terms?',
            text: 'If anything here is unclear, send us a message before you place your order.',
        }}
        related={{ to: '/privacy-policy', label: 'Privacy policy' }}
        closing={{
            title: 'By using this platform, you agree',
            text: 'Clicking “Proceed to checkout” on our pricing tools constitutes your electronic signature and full acceptance of these manufacturing terms.',
        }}
    />
);

export default TermsOfService;
