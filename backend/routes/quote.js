const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * POST /api/quote/validate
 * Body: { metal_slug, thickness_value, width_inch, height_inch }
 * Returns: { valid, reason }
 */
router.post('/validate', async (req, res) => {
    const { metal_slug, thickness_value, width_inch, height_inch } = req.body;

    if (!metal_slug || !thickness_value) {
        return res.status(400).json({ error: 'metal_slug and thickness_value are required' });
    }

    try {
        const result = await db.query(
            'SELECT quick_look, thickness_specs FROM metals WHERE slug = $1',
            [metal_slug]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Metal not found' });
        }

        const { quick_look, thickness_specs } = result.rows[0];
        const thicknesses = quick_look?.thicknesses || [];
        const thickness = thicknesses.find(t => t.value === thickness_value);

        if (!thickness) {
            return res.status(404).json({ error: 'Thickness not found for this metal' });
        }

        // Check max part size if provided in thickness spec
        const specs = thickness_specs?.[thickness_value] || {};
        const maxPartSize = thickness.maxPartSize || specs.maxPartSize;

        if (maxPartSize && width_inch != null && height_inch != null) {
            const [maxW, maxH] = maxPartSize.split('x').map(s => parseFloat(s.trim().replace(/['"]/g, '')));
            if (parseFloat(width_inch) > maxW || parseFloat(height_inch) > maxH) {
                return res.json({
                    valid: false,
                    reason: `Part size ${width_inch}" × ${height_inch}" exceeds max ${maxPartSize} for ${thickness_value} ${metal_slug}`
                });
            }
        }

        res.json({ valid: true, thickness, specs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;