const fs = require('fs');
const path = 'public/ov-libs/o3dv.min.js';
let content = fs.readFileSync(path, 'utf8');

// The hardcoded CDN URL in v0.18.0
const oldUrl = 'https://cdn.jsdelivr.net/npm/occt-import-js@0.0.22/dist/';
// Our local path
const newUrl = '/ov-libs/occt/';

if (content.includes(oldUrl)) {
    console.log(`Found hardcoded CDN URL. Patching to ${newUrl}...`);
    content = content.split(oldUrl).join(newUrl);
    fs.writeFileSync(path, content);
    console.log('Patch applied successfully.');
} else {
    console.log('CDN URL not found. It might already be patched or use a different version.');
}
