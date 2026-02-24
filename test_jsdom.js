const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/Users/gong-ai/梅花易数起卦/index.html', 'utf-8');
const js = fs.readFileSync('/Users/gong-ai/梅花易数起卦/app-core.js', 'utf-8');

const dom = new JSDOM(html, { runScripts: "outside-only", url: "file:///Users/gong-ai/梅花易数起卦/index.html" });
const window = dom.window;
const document = window.document;

// Mock localStorage
window.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = v; },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
};

// Set up user
window.localStorage.setItem('meihua_user', JSON.stringify({name: 'testuser'}));
window.localStorage.setItem('meihua_users', JSON.stringify({'testuser': {passwordHash: 'dummy'}}));

// Mock user history exactly like old format
const oldRecord = {
    id: 12345,
    user: 'testuser',
    timestamp: new Date().toLocaleString(),
    question: '明天开车回寿光， 顺利吗',
    result: { trigramDetails: { 
        ben: { upper: {}, lower: {} },
        hu: { upper: {}, lower: {} },
        bian: { upper: {}, lower: {} },
        cuo: { upper: {}, lower: {} },
        zong: { upper: {}, lower: {} }
    }, tiyong: {ti:{}, yong:{}},
    original: {name: '乾为天'}
    },
    analysis: '这是一段旧的分析',
    reasoning: '旧的推理过程'
};
window.localStorage.setItem('meihua_history_testuser', JSON.stringify([oldRecord]));

// Mock other APIs
window.fetch = () => Promise.resolve({});
window.requestAnimationFrame = (cb) => cb();

// Run the core script
try {
    dom.window.eval(js);
    console.log("App initialized.");

    // Trigger history click manually!
    const historyItem = document.querySelector('.history-item');
    if (historyItem) {
        historyItem.click();
        console.log("History item clicked.");
    } else {
        console.log("No history items found after init.");
    }
} catch (e) {
    console.error("Test error:", e);
}
