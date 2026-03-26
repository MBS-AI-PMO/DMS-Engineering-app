const db = require('../db');

const services = [
    { title: "Laser Cutting", description: "Precision sheet cutting using fiber laser, waterjet, and CNC routing.", image_path: "/uploads/services/service-1.png" },
    { title: "CNC Machining", description: "Multiaxis CNC machining in billet stock.", image_path: "/uploads/services/service-2.png" },
    { title: "Bending", description: "Add dimension to your projects with our precision CNC bending services.", image_path: "/uploads/services/service-3.png" },
    { title: "Countersinking", description: "Allow hardware to sit flush on your parts to reduce wear and tear.", image_path: "/uploads/services/service-4.png" },
    { title: "Dimple Forming", description: "Strengthen material with aesthetically pleasing dimples.", image_path: "/uploads/services/service-5.png" },
    { title: "Hardware", description: "Select from our catalog of PEM press-fit hardware to add nuts, studs, and standoffs.", image_path: "/uploads/services/service-6.png" },
    { title: "Tapping", description: "Easily add threading to allow for the addition of hardware to your parts.", image_path: "/uploads/services/service-7.png" },
    { title: "Anodizing", description: "Increase durability with Class II anodizing services available in 5 colors.", image_path: "/uploads/services/service-8.png" },
    { title: "Deburring", description: "Remove small imperfections, scratches, and burr left over from the cutting process.", image_path: "/uploads/services/service-9.png" },
    { title: "Plating", description: "Increase rust prevention, wear resistance, and strength with zinc and nickel plating.", image_path: "/uploads/services/service-10.png" },
    { title: "Powder Coating", description: "Give your custom cut parts a bold, long-lasting protective layer in one of 10 options.", image_path: "/uploads/services/service-11.png" },
    { title: "Tumbling", description: "Reduce the surface blemishes and handling scratches found in raw materials.", image_path: "/uploads/services/service-12.png" },
];

async function seedServices() {
    console.log('--- Seeding Services ---');
    const serviceMap = {};
    try {
        for (let i = 0; i < services.length; i++) {
            const s = services[i];
            const result = await db.query(
                `INSERT INTO services (title, description, image_path, display_order)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (title) DO UPDATE SET
                    description = EXCLUDED.description,
                    image_path = EXCLUDED.image_path,
                    display_order = EXCLUDED.display_order
                 RETURNING id`,
                [s.title, s.description, s.image_path, i + 1]
            );
            const id = result.rows[0].id;
            serviceMap[s.title] = id;
            // Add common aliases for mapping from metalsData.js
            if (s.title === "Laser Cutting") serviceMap["Precision Sheet Cutting"] = id;
            if (s.title === "Hardware") serviceMap["Hardware Insertion"] = id;

            console.log(`  ✓ ${s.title} (id: ${id})`);
        }
        console.log('✅ Services seeded.');
        return serviceMap;
    } catch (err) {
        console.error('❌ Service seed failed:', err.message);
        throw err;
    }
}

if (require.main === module) {
    seedServices().then(() => db.pool.end()).catch(() => process.exit(1));
}

module.exports = seedServices;
