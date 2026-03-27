const fs = require('fs');
const path = require('path');
const db = require('../db');
const slugify = require('slugify');

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
    // Custom slugify to match user expectations (e.g., hrpando-a36a1018)
    // We want & to be "and" for HRP&O
    let slug = name.toLowerCase().replace(/&/g, 'and');
    return slugify(slug, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g });
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
        return eval(content);
    }
}

async function getServiceMap() {
    try {
        console.log('  Fetching services for mapping...');
        const result = await db.query('SELECT id, title FROM services');
        console.log(`  Found ${result.rows.length} services.`);
        const map = {};
        result.rows.forEach(s => {
            map[s.title] = s.id;
            if (s.title === 'Hardware') map['Hardware Insertion'] = s.id;
            if (s.title === 'Hardware Insertion') map['Hardware Insertion'] = s.id;
        });
        return map;
    } catch (err) {
        console.error('  ! Failed to get service map:', err.message);
        throw err;
    }
}

async function seed() {
    console.log('🔧 Seeding HRP&O Carbon Steel with updated content...\n');

    try {
        const serviceMap = await getServiceMap();
        console.log('Step 1: Parsing metalsData.js...');
        const metalsData = await parseMetalsData();
        console.log(`  Found ${metalsData.length} metals in static file.`);

        // Filter for HRP&O
        const hrpoMetals = metalsData.filter(m => m && m.name && m.name.includes('HRP&O'));
        console.log(`  Filtered to ${hrpoMetals.length} HRP&O metals.`);

        if (hrpoMetals.length === 0) {
            throw new Error('HRP&O metal not found in metalsData.js');
        }

        for (const metal of hrpoMetals) {
            console.log(`\nProcessing metal: ${metal.name} (ID: ${metal.id})`);
            const categoryName = detectCategory(metal.name);
            console.log(`  Category: ${categoryName}`);

            const catResult = await db.query('SELECT id FROM metal_categories WHERE name = $1', [categoryName]);
            if (catResult.rows.length === 0) {
                console.warn(`  ! Category "${categoryName}" not found in database, skipping ${metal.name}`);
                continue;
            }
            const categoryId = catResult.rows[0].id;

            console.log(`  Step 2: Generating slug...`);
            const slug = generateSlug(metal.name);
            console.log(`  Target slug: ${slug}`);

            const imagePath = typeof metal.image === 'string' ? metal.image : `/uploads/metals/metal-${metal.id}.jpg`;

            const metalServiceNames = metal.specifications?.availableServices || [];
            const metalServiceIds = metalServiceNames
                .map(name => serviceMap[name])
                .filter(id => id !== undefined);

            const quickLook = { ...(metal.quickLook || {}) };
            if (quickLook.thicknesses) {
                quickLook.thicknesses = quickLook.thicknesses.map(t => {
                    const thicknessSpecs = metal.thicknessSpecs?.[t.value];
                    const thicknessServiceNames = thicknessSpecs?.availableServices;
                    if (thicknessServiceNames) {
                        const thicknessServiceIds = thicknessServiceNames
                            .map(name => serviceMap[name])
                            .filter(id => id !== undefined);
                        return { ...t, services: thicknessServiceIds };
                    }
                    return t;
                });
            }

            console.log(`Step 3: Upserting ${metal.name} into "metals" table...`);
            const result = await db.query(`
                INSERT INTO metals (slug, name, category_id, thickness, description, image_path,
                    quick_look, services, specifications, thickness_specs,
                    about_section, faqs, display_order)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
                metal.id || 0
            ]);

            console.log(`  ✓ ${metal.name} ${result.rows[0].is_insert ? 'inserted' : 'updated'} successfully!`);
        }

    } catch (err) {
        console.error('\n❌ Seeding failed:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        await db.pool.end();
    }
}

seed();
