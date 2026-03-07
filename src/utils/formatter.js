/**
 * Text Formatting Utils
 */
import { escapeHtml } from './dom.js';

export function formatMarkdown(text) {
    if (!text) return '';
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
