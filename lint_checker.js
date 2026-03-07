const fs = require('fs');
const path = require('path');

const filePath = process.argv[2] || path.join(__dirname, 'legacy', 'app-core.js');

if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

const file = fs.readFileSync(filePath, 'utf8');

// VERY basic syntax check
try {
  new Function(file);
  console.log("No syntax errors.");
} catch (e) {
  console.log("Syntax error!", e);
}
