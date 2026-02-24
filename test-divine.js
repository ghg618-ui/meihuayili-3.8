const fs = require('fs');

const raw = fs.readFileSync('divination-engine.js', 'utf8');
// Mock what app.js does
let HEXAGRAM_NAME_LOOKUP = {};
let HEXAGRAM_SHORT_LOOKUP = {};
let NATURE_TO_TRIGRAM = {};
let HEXAGRAM_NAMES = {};
let TRIGRAMS = {};

try {
    eval(raw);
    const parsed = DivinationEngine.parseFromText("这只是一个测试对话，并不包含任何卦名。");
    console.log("Parsed:", parsed);
} catch (e) {
    console.error("Error:", e);
}
