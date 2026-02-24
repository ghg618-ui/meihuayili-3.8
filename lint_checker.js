const fs = require('fs');

const file = fs.readFileSync('/Users/gong-ai/梅花易数起卦/app-core.js', 'utf8');

// VERY basic syntax check
try {
  new Function(file);
  console.log("No syntax errors.");
} catch (e) {
  console.log("Syntax error!", e);
}
