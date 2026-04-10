import React from 'react';
import { ALL_LEGAL_ICONS } from '../constants/legalIcons';
import { FileText } from 'lucide-react';

const LegalIcon = ({ name, size = 18, color = 'currentColor', className = '' }) => {
    const IconComponent = ALL_LEGAL_ICONS[name] || FileText;
    return <IconComponent size={size} color={color} className={className} />;
};

export default LegalIcon;
