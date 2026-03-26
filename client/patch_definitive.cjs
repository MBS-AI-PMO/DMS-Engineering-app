const fs = require('fs');
const path = 'public/ov-libs/o3dv.min.js';
let content = fs.readFileSync(path, 'utf8');

// Target the OCCT worker creation logic in 0.18.0
// Replacing the Blob creation and instantiation with a direct Worker call.
const oldPattern = `let s=new Blob([i],{type:"text/javascript"});return vu=URL.createObjectURL(s),e(new Worker(vu))`;
const newPattern = `return e(new Worker('/ov-libs/occt/occt-import-js-worker.js'))`;

if (content.includes(oldPattern)) {
    console.log("Found Blob Worker pattern. Replacing with Direct Worker...");
    content = content.replace(oldPattern, newPattern);
    fs.writeFileSync(path, content);
    console.log("Patch applied.");
} else {
    console.log("Pattern not found. Checking for slightly variations...");
    // Fallback search
    const partial = 'new Worker(vu)';
    if (content.includes(partial)) {
        console.log("Found partial match 'new Worker(vu)'. Performing wide search and replace.");
        // This is more risky but needed if strings slightly vary
        content = content.replace(/let s=new Blob\(.+?,e\(new Worker\([a-z]+\)\)/, 
            `return e(new Worker('/ov-libs/occt/occt-import-js-worker.js'))`);
        fs.writeFileSync(path, content);
    }
}
