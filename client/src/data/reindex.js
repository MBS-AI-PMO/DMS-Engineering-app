const fs = require('fs');
const filePath = 'd:\\Frontend\\DMS\\client\\src\\data\\faqData.js';
let content = fs.readFileSync(filePath, 'utf8');

let currentId = 1;
// Replace all id: \d+ with sequential numbers
content = content.replace(/id:\s*\d+/g, () => `id: ${currentId++}`);

fs.writeFileSync(filePath, content);
console.log('FAQ re-indexed successfully.');
