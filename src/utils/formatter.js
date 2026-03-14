/**
 * Text Formatting Utils
 */
import { escapeHtml } from './dom.js';

const CANONICAL_HEADINGS = [
    { match: ['卦象速览'], output: '### 🎴 【卦象速览】' },
    { match: ['一语定调'], output: '### 🔮 【一语定调】' },
    { match: ['现状与大势'], output: '### 📊 【现状与大势】' },
    { match: ['过程与结局'], output: '### 🔄 【过程与结局】' },
    { match: ['高维生存锦囊', '高位生存锦囊', '行动建议'], output: '### 💡 【行动建议】' },
    { match: ['慎行事项'], output: '### ⚠️ 【慎行事项】' },
];

export function normalizeAnalysisText(text) {
    if (!text) return '';

    return text
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => normalizeHeadingLine(line))
        .join('\n')
        .replace(/【高维生存锦囊】|【高位生存锦囊】/g, '【行动建议】');
}

function normalizeHeadingLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return line;

    const withoutHashes = trimmed.replace(/^#{1,3}\s*/, '');
    const compact = withoutHashes
        .replace(/\*+/g, '')
        .replace(/[>`]/g, '')
        .replace(/^[^\u4e00-\u9fa5A-Za-z0-9【\[]+/, '')
        .replace(/[】\]]?\s*[:：]?\s*$/, '')
        .trim();

    const plain = compact
        .replace(/^[【\[]\s*/, '')
        .replace(/\s*[】\]]$/, '')
        .replace(/\s+/g, '');

    for (const heading of CANONICAL_HEADINGS) {
        if (heading.match.some((keyword) => plain.includes(keyword))) {
            return heading.output;
        }
    }

    return line;
}

export function formatMarkdown(text) {
    if (!text) return '';
    text = normalizeAnalysisText(text);
    // Simple markdown formatting
    let html = escapeHtml(text);
    // Headers (strip redundant ** inside header lines before converting)
    html = html.replace(/^(#{1,3}) \*{0,2}(.+?)\*{0,2}$/gm, '$1 $2');
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    // Bold (allow cross-line matching)
    html = html.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Clean up orphaned markdown markers that AI failed to close
    html = html.replace(/\*{2,}/g, '');
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    // Lists
    html = html.replace(/^- (.+)$/gm, '• $1');
    return html;
}
