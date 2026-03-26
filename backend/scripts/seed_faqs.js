/**
 * seed_faqs.js - Seeds the PostgreSQL database from faqData.js
 * 
 * Reads faqData.js which exports two arrays:
 *   - faqCategories: [{id, title}, ...]
 *   - faqData: [{id, category, question, answer}, ...]
 * 
 * Idempotent: Clears and re-inserts.
 * Usage: node scripts/seed_faqs.js
 */

const fs = require('fs');
const path = require('path');
const db = require('../db');
const slugify = require('slugify');

function generateSlug(name) {
    return slugify(name, { lower: true, strict: true, remove: /[*+~.()'"!:@&]/g });
}

async function parseFaqData() {
    const filePath = path.join(__dirname, '..', '..', 'client', 'src', 'data', 'faqData.js');
    let content = fs.readFileSync(filePath, 'utf-8');

    // Remove 'export' keywords
    content = content.replace(/export\s+const/g, 'const');

    // Evaluate both arrays
    const evalContent = content + '\n({ faqCategories, faqData });';
    const result = eval(evalContent);

    console.log(`  Parsed ${result.faqCategories.length} categories and ${result.faqData.length} FAQs`);
    return result;
}

async function seed() {
    console.log('🔧 Seeding FAQ data...\n');

    try {
        console.log('Step 1: Parsing faqData.js...');
        const { faqCategories, faqData } = await parseFaqData();

        // Step 2: Insert categories
        console.log('\nStep 2: Creating FAQ categories...');
        const categoryIdMap = {}; // Maps faqData category string to DB id

        for (let i = 0; i < faqCategories.length; i++) {
            const cat = faqCategories[i];
            const slug = cat.id; // Already slugified in the data
            const name = cat.title;

            const result = await db.query(`
                INSERT INTO faq_categories (name, slug, display_order)
                VALUES ($1, $2, $3)
                ON CONFLICT (slug) DO UPDATE SET name = $1, display_order = $3
                RETURNING id
            `, [name, slug, i]);

            categoryIdMap[cat.id] = result.rows[0].id;
            console.log(`  ✓ ${name} (slug: ${slug})`);
        }

        // Step 3: Clear and insert FAQs
        console.log('\nStep 3: Inserting FAQs...');
        await db.query('DELETE FROM faqs');

        let inserted = 0;
        const categoryCount = {};

        for (const faq of faqData) {
            const categoryDbId = categoryIdMap[faq.category];
            if (!categoryDbId) {
                console.warn(`  ⚠ Unknown category "${faq.category}" for FAQ: "${faq.question.substring(0, 50)}..."`);
                continue;
            }

            categoryCount[faq.category] = (categoryCount[faq.category] || 0) + 1;

            await db.query(`
                INSERT INTO faqs (category_id, question, answer, display_order)
                VALUES ($1, $2, $3, $4)
            `, [categoryDbId, faq.question, faq.answer, categoryCount[faq.category]]);

            inserted++;
        }

        console.log(`\n✅ FAQ seeding complete!`);
        console.log(`   ${faqCategories.length} categories created`);
        console.log(`   ${inserted} FAQs inserted`);

        // Summary per category
        console.log('\n   Breakdown:');
        for (const [cat, count] of Object.entries(categoryCount)) {
            console.log(`     ${cat}: ${count} FAQs`);
        }

    } catch (err) {
        console.error('\n❌ FAQ seeding failed:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        await db.pool.end();
    }
}

seed();
