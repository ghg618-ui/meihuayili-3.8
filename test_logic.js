// Mock DOM elements
const document = {
    createElement: (tag) => ({ className: '', innerHTML: '', appendChild: () => {}, querySelector: () => null }),
    getElementById: (id) => ({ innerHTML: '', remove: () => {}, classList: { remove: () => {}, add: () => {} }, scrollIntoView: () => {}, textContent: '', appendChild: () => {}, querySelector: () => null, querySelectorAll: () => [] })
};
const chatMessages = document.getElementById('chat-messages');

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/&/g, "&amp;");
}

function formatMarkdown(text) {
    if (!text) return '';
    return text;
}

function addAnalysisToChat(content, reasoning = null, analyses = null) {
    console.log("addAnalysisToChat called with analyses:", analyses);
    if (!chatMessages) return;

    if (analyses && analyses.length > 1) {
        console.log("Creating comparison panel.");
        const panel = document.createElement('div');
        panel.className = 'model-comparison-panel';

        analyses.forEach(a => {
            const col = document.createElement('div');
            col.className = 'model-column';
            let colHtml = `<div class="model-column-header"><span class="model-dot"></span>${a.modelLabel || '模型'}</div>`;
            colHtml += '<div class="model-column-content">';
            if (a.reasoning) {
                colHtml += `<details class="thinking-block"><summary>💭 思考过程</summary><pre>${escapeHtml(a.reasoning)}</pre></details>`;
            }
            colHtml += formatMarkdown(a.content);
            colHtml += '</div>';
            colHtml += `<div class="model-column-status">✅ 已完成</div>`;
            col.innerHTML = colHtml;
            panel.appendChild(col);
        });
        chatMessages.appendChild(panel);
    } else {
        console.log("Creating single analysis panel.");
        const div = document.createElement('div');
        div.className = 'chat-message assistant';
        let html = '';
        if (reasoning) {
            html += `<details class="thinking-block" open><summary>💭 历史思考过程</summary><pre>${escapeHtml(reasoning)}</pre></details>`;
        }
        html += formatMarkdown(content);
        div.innerHTML = html;
        chatMessages.appendChild(div);
    }
}

try {
    const record = {
        analyses: [{ content: '1', reasoning: '1' }, { content: '2', reasoning: '2' }],
        analysis: '1',
        reasoning: '1'
    };
    if (record.analyses && record.analyses.length > 0) {
        let modelAnalyses = [...record.analyses];
        addAnalysisToChat(record.analysis, record.reasoning, record.analyses);
    }
    console.log("Success with length 2!");
} catch (e) {
    console.error("Error with length 2:", e);
}

try {
    const record = {
        analysis: '1',
        reasoning: '1'
    };
    if (record.analyses && record.analyses.length > 0) {
        let modelAnalyses = [...record.analyses];
        addAnalysisToChat(record.analysis, record.reasoning, record.analyses);
    } else if (record.analysis) {
        let modelAnalyses = [{
            modelKey: 'legacy',
            modelLabel: '历史记录',
            content: record.analysis,
            reasoning: record.reasoning
        }];
        addAnalysisToChat(record.analysis, record.reasoning);
    }
    console.log("Success with no analyses!");
} catch (e) {
    console.error("Error with no analyses:", e);
}
