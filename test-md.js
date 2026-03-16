function formatMarkdown(text) {
    if (!text) return '';
    
    // Auto-close bold
    const boldMatches = text.match(/\*\*/g) || [];
    if (boldMatches.length % 2 !== 0) {
        text += '**';
    }

    let html = text; 
    html = html.replace(/^(#{1,3}) \*{0,2}(.+?)\*{0,2}$/gm, '$1 $2');
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/\n/g, '<br>');
    return html;
}
console.log(formatMarkdown('**text'));
console.log(formatMarkdown('**text**'));
