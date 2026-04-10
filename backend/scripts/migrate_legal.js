const db = require('../db');

async function migrate() {
    console.log('Running legal documents migration...');

    try {
        // Create legal_documents table
        await db.query(`
            CREATE TABLE IF NOT EXISTS legal_documents (
                id SERIAL PRIMARY KEY,
                type VARCHAR(20) NOT NULL CHECK (type IN ('privacy', 'terms')),
                serial_number VARCHAR(10) NOT NULL,
                icon VARCHAR(100) NOT NULL,
                heading VARCHAR(255) NOT NULL,
                color VARCHAR(20) NOT NULL,
                content JSONB NOT NULL DEFAULT '[]',
                display_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('  ✓ legal_documents table');

        // Initial Seed Data for Privacy Policy
        const privacySections = [
            {
                serial: '01',
                title: 'Information We Collect',
                icon: 'Eye',
                color: '#6366f1',
                content: [
                    'We collect information you provide directly when you create an account, upload a CAD model, or request a quote. This includes your name, email address, company name, and billing information.',
                    'Technical data such as CAD file metadata, part dimensions, and material specifications are collected to generate instant pricing and production estimates.',
                    'Usage data including IP address, browser type, and interaction patterns are collected to improve our platform performance and user experience.'
                ]
            },
            {
                serial: '02',
                title: 'How We Use Your Data',
                icon: 'Lock',
                color: '#e31b23',
                content: [
                    'Your data powers our instant pricing engine — we analyze uploaded STEP files to compute accurate material, cutting, bending, and finishing costs in real time.',
                    'Order and account data is used to fulfill manufacturing orders, send production updates, and maintain your order history.',
                    'We do not sell, rent, or trade your personal information or intellectual property to any third party under any circumstances.'
                ]
            },
            {
                serial: '03',
                title: 'IP & Design Protection',
                icon: 'Shield',
                color: '#10b981',
                content: [
                    'All uploaded CAD files (STEP, DXF, etc.) are stored on AES-256 encrypted servers. Access is strictly limited to automated analysis systems and authorized production personnel directly involved in your order.',
                    'You retain 100% ownership of your designs at all times. DMS Metals claims no intellectual property rights over any customer-uploaded files.',
                    'Files associated with cancelled or expired quotes are permanently deleted from our servers within 90 days.'
                ]
            },
            {
                serial: '04',
                title: 'Cookies & Tracking',
                icon: 'CheckCircle',
                color: '#f59e0b',
                content: [
                    'Essential cookies maintain your session state, shopping cart contents, and authentication tokens. These cannot be disabled as they are required for the platform to function.',
                    'Analytical cookies (opt-in) help us understand which features are most used, allowing our engineering team to prioritize improvements to the pricing and 3D viewer tools.',
                    'You can manage cookie preferences at any time through your account settings or browser controls.'
                ]
            }
        ];

        // Seed Privacy
        for (let i = 0; i < privacySections.length; i++) {
            const s = privacySections[i];
            await db.query(`
                INSERT INTO legal_documents (type, serial_number, icon, heading, color, content, display_order)
                VALUES ('privacy', $1, $2, $3, $4, $5, $6)
                ON CONFLICT DO NOTHING
            `, [s.serial, s.icon, s.title, s.color, JSON.stringify(s.content), i]);
        }
        console.log('  ✓ privacy policy seeded');

        // Initial Seed Data for Terms of Service
        const termsSections = [
            {
                serial: '01',
                title: 'Acceptance of Terms',
                icon: 'ClipboardList',
                color: '#6366f1',
                content: [
                    'By accessing or using the DMS Metals platform — including uploading CAD files, requesting quotes, or placing manufacturing orders — you agree to be bound by these Terms of Service.',
                    'If you are using the platform on behalf of a company or organization, you represent that you have the authority to bind that entity to these terms.',
                    'We reserve the right to update these terms at any time. Continued use of the platform after changes constitutes acceptance of the revised terms.'
                ]
            },
            {
                serial: '02',
                title: 'CAD File Accuracy',
                icon: 'Zap',
                color: '#e31b23',
                content: [
                    'Users are solely responsible for the accuracy and correctness of all uploaded 3D models and DXF drawings. DMS Metals applies automated geometry analysis but does not validate functional design intent.',
                    'Quotes generated by our instant pricing engine are based entirely on the specifications extracted from your uploaded files. Discrepancies between the file and your intended part are the customer\'s responsibility.',
                    'We strongly recommend verifying all automated measurements and tolerances before proceeding to production.'
                ]
            },
            {
                serial: '03',
                title: 'Manufacturing & Quality',
                icon: 'Hammer',
                color: '#10b981',
                content: [
                    'All manufacturing is performed to the tolerances specified in your order. Standard tolerances are ±0.1mm unless explicitly agreed otherwise in writing.',
                    'Changes requested after order placement may incur additional fees and lead time adjustments. Major design revisions may require a new quote.',
                    'DMS Metals guarantees the quality of our manufacturing processes. If a part does not conform to the stated tolerances, we will re-manufacture or provide a refund at our discretion.'
                ]
            },
            {
                serial: '04',
                title: 'Intellectual Property',
                icon: 'ShieldAlert',
                color: '#f59e0b',
                content: [
                    'You retain full ownership of all CAD files and designs you upload. By submitting files to DMS Metals, you grant us a limited, non-exclusive license solely for the purpose of generating quotes and manufacturing the ordered parts.',
                    'This license terminates upon order completion or cancellation. DMS Metals will not use your designs to produce parts for any third party without your explicit written consent.',
                    'DMS Metals\' own pricing algorithms, 3D analysis tools, and platform software remain the exclusive intellectual property of DMS Metals.'
                ]
            },
            {
                serial: '05',
                title: 'Payment & Billing',
                icon: 'CreditCard',
                color: '#8b5cf6',
                content: [
                    'All prices quoted are in USD and are valid for 48 hours from the time of quote generation unless otherwise stated. Material price fluctuations may affect quotes after this period.',
                    'Full payment is required before production begins for new customers. Established accounts may qualify for net-30 payment terms upon approval.',
                    'Cancellations made before production has started are fully refunded. Cancellations after production begins may be subject to material and labor costs already incurred.'
                ]
            },
            {
                serial: '06',
                title: 'Limitation of Liability',
                icon: 'AlertTriangle',
                color: '#ef4444',
                content: [
                    'DMS Metals\' liability is limited to the total value of the specific order in question. We are not liable for indirect, consequential, or incidental damages arising from delays or manufacturing defects.',
                    'We are not responsible for design failures, patent infringements, or safety issues arising from customer-provided specifications. Always have critical parts independently verified by a qualified engineer.',
                    'Force majeure events including supply chain disruptions, natural disasters, or regulatory changes may affect delivery timelines without incurring liability on our part.'
                ]
            }
        ];

        // Seed Terms
        for (let i = 0; i < termsSections.length; i++) {
            const s = termsSections[i];
            await db.query(`
                INSERT INTO legal_documents (type, serial_number, icon, heading, color, content, display_order)
                VALUES ('terms', $1, $2, $3, $4, $5, $6)
                ON CONFLICT DO NOTHING
            `, [s.serial, s.icon, s.title, s.color, JSON.stringify(s.content), i]);
        }
        console.log('  ✓ terms of service seeded');

    } catch (err) {
        console.error('❌ Legal migration failed:', err.message);
        process.exit(1);
    } finally {
        await db.pool.end();
    }
}

migrate();
