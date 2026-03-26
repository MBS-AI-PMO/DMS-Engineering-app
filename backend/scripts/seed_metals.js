const fs = require('fs');
const path = require('path');
const db = require('../db');
const slugify = require('slugify');
const seedServices = require('./seed_services');

// Category mappings based on metal name keywords
const CATEGORY_MAP = {
    'aluminum': 'Aluminum',
    'brass': 'Brass',
    'copper': 'Copper',
    'stainless': 'Stainless Steel',
    'titanium': 'Titanium',
    'steel': 'Steel',
};

function detectCategory(metalName) {
    const lower = metalName.toLowerCase();
    if (lower.includes('stainless')) return 'Stainless Steel';
    if (lower.includes('titanium')) return 'Titanium';
    if (lower.includes('aluminum')) return 'Aluminum';
    if (lower.includes('brass')) return 'Brass';
    if (lower.includes('copper')) return 'Copper';
    return 'Steel';
}

function generateSlug(name) {
    return slugify(name, { lower: true, strict: true, remove: /[*+~.()'"!:@&]/g });
}

async function parseMetalsData() {
    const filePath = path.join(__dirname, '..', '..', 'client', 'src', 'data', 'metalsData.js');
    let content = fs.readFileSync(filePath, 'utf-8');

    // Extract image imports
    const importMap = {};
    const importRegex = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
        const varName = match[1];
        const importPath = match[2];
        const servingPath = importPath.replace(/^.*\/metals\//, '/uploads/metals/');
        importMap[varName] = servingPath;
    }

    // Prepare content for evaluation
    content = content.replace(/import\s+\w+\s+from\s+['"][^'"]+['"];?\s*/g, '');
    content = content.replace(/export\s+const\s+metalsData\s*=/, 'const metalsData =');

    // Replace image variable references
    for (const [varName, pathStr] of Object.entries(importMap)) {
        const regex = new RegExp(`(?<=:\\s*)\\b${varName}\\b(?!\\s*[:(])`, 'g');
        content = content.replace(regex, `"${pathStr}"`);
        const arrayRegex = new RegExp(`(?<=\\[\\s*)\\b${varName}\\b`, 'g');
        content = content.replace(arrayRegex, `"${pathStr}"`);
        const commaRegex = new RegExp(`(?<=,\\s*)\\b${varName}\\b`, 'g');
        content = content.replace(commaRegex, `"${pathStr}"`);
    }

    try {
        const evalContent = content + '\nmetalsData;';
        return eval(evalContent);
    } catch (err) {
        const arrayMatch = content.match(/const metalsData\s*=\s*(\[[\s\S]*\]);?\s*$/);
        if (arrayMatch) return eval(arrayMatch[1]);
        throw err;
    }
}

async function seed() {
    console.log('🔧 Seeding Services and Metals...\n');

    try {
        // Step 1: Seed Services and get ID map
        const serviceMap = await seedServices();

        // Step 2: Parse metals data
        console.log('\nStep 2: Parsing metalsData.js...');
        const metalsData = await parseMetalsData();

        // Step 3: Create categories
        console.log('\nStep 3: Creating categories...');
        const categories = ['Aluminum', 'Brass', 'Copper', 'Stainless Steel', 'Steel', 'Titanium'];
        const categoryIds = {};
        for (let i = 0; i < categories.length; i++) {
            const catName = categories[i];
            const catSlug = generateSlug(catName);
            const result = await db.query(`
                INSERT INTO metal_categories (name, slug, display_order)
                VALUES ($1, $2, $3)
                ON CONFLICT (slug) DO UPDATE SET name = $1, display_order = $3
                RETURNING id
            `, [catName, catSlug, i]);
            categoryIds[catName] = result.rows[0].id;
        }

        // Step 4: Insert metals
        console.log('\nStep 4: Inserting metals...');
        let inserted = 0, updated = 0;

        for (const metal of metalsData) {
            const category = detectCategory(metal.name);
            const categoryId = categoryIds[category];
            const slug = generateSlug(metal.name);
            const imagePath = typeof metal.image === 'string' ? metal.image : `/uploads/metals/metal-${metal.id}.jpg`;

            // --- Map Services ---
            // 1. Metal-level services
            const metalServiceNames = metal.specifications?.availableServices || [];
            const metalServiceIds = metalServiceNames
                .map(name => serviceMap[name])
                .filter(id => id !== undefined);

            // 2. Thickness-level services (within quickLook.thicknesses)
            const quickLook = { ...(metal.quickLook || {}) };
            if (quickLook.thicknesses) {
                quickLook.thicknesses = quickLook.thicknesses.map(t => {
                    const thicknessServiceNames = metal.thicknessSpecs?.[t.value]?.availableServices;
                    if (thicknessServiceNames) {
                        const thicknessServiceIds = thicknessServiceNames
                            .map(name => serviceMap[name])
                            .filter(id => id !== undefined);
                        return { ...t, services: thicknessServiceIds };
                    }
                    return t;
                });
            }

            const result = await db.query(`
                INSERT INTO metals (slug, name, category_id, thickness, description, image_path,
                    quick_look, services, specifications, thickness_specs,
                    about_section, faqs, custom_fields, display_order)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
                ON CONFLICT (slug) DO UPDATE SET
                    name = EXCLUDED.name,
                    category_id = EXCLUDED.category_id,
                    thickness = EXCLUDED.thickness,
                    description = EXCLUDED.description,
                    image_path = EXCLUDED.image_path,
                    quick_look = EXCLUDED.quick_look,
                    services = EXCLUDED.services,
                    specifications = EXCLUDED.specifications,
                    thickness_specs = EXCLUDED.thickness_specs,
                    about_section = EXCLUDED.about_section,
                    faqs = EXCLUDED.faqs,
                    custom_fields = EXCLUDED.custom_fields,
                    display_order = EXCLUDED.display_order
                RETURNING id, (xmax = 0) as is_insert
            `, [
                slug, metal.name, categoryId, metal.thickness || '', metal.description || '', imagePath,
                JSON.stringify(quickLook),
                JSON.stringify(metalServiceIds),
                JSON.stringify(metal.specifications || {}),
                JSON.stringify(metal.thicknessSpecs || {}),
                JSON.stringify(metal.aboutSection || {}),
                JSON.stringify(metal.faqs || []),
                JSON.stringify(metal.customFields || {}),
                metal.id || 0
            ]);

            if (result.rows[0].is_insert) inserted++; else updated++;
            console.log(`  ✓ ${metal.name} [${result.rows[0].is_insert ? 'INSERT' : 'UPDATE'}]`);
        }

        console.log(`\n✅ Seeding complete! ${inserted} inserted, ${updated} updated.`);
    } catch (err) {
        console.error('\n❌ Seeding failed:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        await db.pool.end();
    }
}

seed();
