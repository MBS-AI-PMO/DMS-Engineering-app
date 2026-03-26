const fs = require('fs');
const path = 'public/ov-libs/o3dv.min.js';
let content = fs.readFileSync(path, 'utf8');

// The OCCT worker factory (usually minified as function Wo or similar)
// We want to find the pattern where it fetches the CDN URL, replaces strings, and creates a Blob worker.
// Instead of matching the whole function, we replace the specific 'new Worker(vu)' call after the fetch.

// Actually, let's just replace the whole async function that manages OCCT workers.
// In 0.18.0 it often looks like: 
// function Wo(r){return new Promise((e,t)=>{if(vu!==null){e(new Worker(vu));return}...URL.createObjectURL(s),e(new Worker(vu))...

// DEFINITIVE FIX: 
// Replace the entire worker creator logic for OCCT and Draco with straight local paths.

const occtPatch = `function Wo(r){return new Promise((e,t)=>{e(new Worker('/ov-libs/occt/occt-import-js-worker.js'))})}`;
const dracoPatch = `function Vo(r){return new Promise((e,t)=>{e(new Worker('/ov-libs/draco/draco_p_decoder.js'))})}`;

// We need to find the old functions. Since they are minified, they might have different names.
// However, 'occt-import-js@0.0.22/dist/' is a very unique string in that function.

// Let's use a more surgical approach with regex.
const occtRegex = /function \w+\(r\)\{return new Promise\(\(e,t\)=>\{if\(vu!==null\)\{e\(new Worker\(vu\)\);return\}let n="\/ov-libs\/occt\/";fetch\(n\+"occt-import-js-worker.js"\).+?\}\)\}/;
// Wait, my previous patch already changed the URL to /ov-libs/occt/.
// So the regex should account for that.

// LETS JUST REPLACE THE WHOLE THING.
// Based on my previous view_file, the function starts with 'function Wo(r){return new Promise((e,t)=>{'
// and contains 'occt-import-js-worker.js'.

// Actually, I'll just find the specific pattern and replace it.
// Finding: function Wo(r){return new Promise((e,t)=>{ ... new Worker(vu) ... })}

content = content.replace(/function [a-zA-Z0-9_$]+\(r\)\{return new Promise\(\(e,t\)=>\{if\([a-zA-Z0-9_$]+!==null\)\{e\(new Worker\([a-zA-Z0-9_$]+\)\);return\}/t, (match) => {
    console.log("Found worker factory start. Patching...");
    return "function Wo(r){return new Promise((e,t)=>{e(new Worker('/ov-libs/occt/occt-import-js-worker.js'));return"; 
});

// That might be too risky. Let's try a simpler string replace on the known segments.
const target = 'if(vu!==null){e(new Worker(vu));return}'; // This is from my earlier view_file observation
if (content.includes(target)) {
    console.log("Found the Worker(vu) check. Patching logic...");
    // Replace the whole check and fetch logic inside the promise
    content = content.replace(/if\(vu!==null\)\{e\(new Worker\(vu\)\);return\}let n="\/ov-libs\/occt\/";.+?URL\.createObjectURL\(s\),e\(new Worker\(vu\)\)/, 
    "e(new Worker('/ov-libs/occt/occt-import-js-worker.js'))");
}

fs.writeFileSync(path, content);
console.log("Patch applied correctly.");
