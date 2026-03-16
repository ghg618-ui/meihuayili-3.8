const NON_QUESTION_PATTERNS = [
    /^(你好|您好|嗨|哈喽|hello|hi)$/i,
    /^(在吗|你在吗|有人吗|在不在|忙吗|收到吗)$/,
    /^(测试|试试|test)$/i,
    /^(谢谢|谢了|好的|好)$/,
];

let _pendingParsedResult = null;
let _pendingDateInfo = null;

function isMeaningfulDivinationQuestion(rawQuestion, hasParsedHex = false) {
    if (hasParsedHex) return true;

    const question = (rawQuestion || '').trim();
    if (!question) return false;
    
    // 清除所有常见标点符号和空格
    const normalized = question
        .replace(/[\s,.，。!！?？~～、]/g, '')
        .toLowerCase();

    // 拦截纯寒暄与测试短语
    if (NON_QUESTION_PATTERNS.some((pattern) => pattern.test(normalized))) return false;

    // 不再使用庞大词缀库判定：只要字数大于或等于3，即放行
    return normalized.length >= 3;
}

console.log('Result:', isMeaningfulDivinationQuestion('明天他们会来我家吗？'));
