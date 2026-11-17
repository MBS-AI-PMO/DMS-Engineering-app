import React from 'react';
import LegalDocument from '../components/LegalDocument';

/**
 * Privacy policy (/privacy-policy). The sections are written in
 * Admin > Terms & Policy (type "privacy"); LegalDocument loads and lays
 * them out.
 */
const PrivacyPolicy = () => (
    <LegalDocument
        type="privacy"
        art="lock"
        titleStrong="Privacy"
        titleLight="policy"
        crumb="Privacy policy"
        docName="privacy policy"
        lede="Your privacy and the security of your intellectual property are our top priorities."
        questions={{
            title: 'Privacy questions?',
            text: 'If you have concerns about your data or your design files, send us a message.',
        }}
        related={{ to: '/terms-of-service', label: 'Terms of service' }}
    />
);

export default PrivacyPolicy;
