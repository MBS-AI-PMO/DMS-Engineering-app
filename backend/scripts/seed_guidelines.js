const db = require('../db');
const fs = require('fs');
const path = require('path');

const GUIDELINES_FILE = path.join(__dirname, '../../client/src/data/guidelinesData.js');

const serviceIdMap = {
    'anodizing': 8,
    'bending': 3,
    'countersinking': 4,
    'deburring': 9,
    'dimple-forming': 5,
    'hardware': 6,
    'plating': 10,
    'powder-coating': 11,
    'tapping': 7,
    'tumbling': 12
};

async function seed() {
    console.log('Seeding guidelines...');
    try {
        const content = fs.readFileSync(GUIDELINES_FILE, 'utf8');
        // Extract the array from "export const guidelinesData = [ ... ];"
        const arrayStr = content.substring(content.indexOf('['), content.lastIndexOf(']') + 1);
        
        // This is still JS-like, not pure JSON. Evaluate it carefully in a safe-ish way.
        // Or just use eval() as it's a seed script on local machine.
        let guidelines;
        try {
            // Using a simple Function constructor to evaluate the JS array
            guidelines = new Function(`return ${arrayStr}`)();
        } catch (e) {
            console.error('Failed to parse guidelinesData.js:', e.message);
            return;
        }

        for (const g of guidelines) {
            const serviceId = serviceIdMap[g.id];
            if (!serviceId) {
                console.warn(`No service ID mapping for: ${g.id}`);
                continue;
            }

            console.log(`  Inserting guidelines for Service ID ${serviceId} (${g.title})...`);
            await db.query(`
                INSERT INTO service_guidelines (service_id, title, content, requirements, tables)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (service_id) DO UPDATE SET
                    title = EXCLUDED.title,
                    content = EXCLUDED.content,
                    requirements = EXCLUDED.requirements,
                    tables = EXCLUDED.tables,
                    updated_at = NOW()
            `, [serviceId, g.title, g.content, JSON.stringify(g.requirements), JSON.stringify(g.tables)]);
        }

        console.log('✅ Guidelines seeded successfully');
    } catch (err) {
        console.error('❌ Seeding failed:', err.message);
    } finally {
        process.exit();
    }
}

seed();
