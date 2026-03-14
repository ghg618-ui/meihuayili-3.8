/**
 * Chat Messages View
 */
import { $, escapeHtml } from '../utils/dom.js';
import { formatMarkdown } from '../utils/formatter.js';

export function addMessage(container, { role, content, reasoning, modelLabel }) {
    if (!container) return;

    const msgId = 'msg-' + Date.now();

    const msgHtml = `
        <div class="chat-message ${role}" id="${msgId}">
            <div class="msg-content">
                ${formatMarkdown(content)}
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', msgHtml);
    return $(`#${msgId}`);
}

export function appendAssistantMessageActions(msgEl) {
    if (!msgEl) return;

    const contentEl = msgEl.querySelector('.msg-content');
    if (!contentEl) return;

    contentEl.querySelectorAll('.msg-feedback-actions, .msg-bottom-actions, .wechat-promo').forEach((node) => node.remove());

    contentEl.insertAdjacentHTML('beforeend', `
        <div class="msg-feedback-actions">
            <button class="btn-feedback icon-btn" onclick="window.openFeedbackModal('${msgEl.id}')" title="提供卦例反馈">
                <span class="fb-icon" style="font-size:1.1rem">📋</span> 卦例点评
            </button>
        </div>
        <div class="msg-bottom-actions">
            <button class="btn-new-case-inline" onclick="window.startNewCaseFromChat()">🔄 新起一卦</button>
            <button class="btn-export-inline" onclick="window.exportDivinationResult()">📤 导出结果</button>
        </div>
        <div class="wechat-promo" onclick="window.showQRCode()">
            <span class="wechat-promo-text">📱 关注微信服务号「易泓录」获取更多易学智慧</span>
            <span class="wechat-promo-hint">👉 点击查看二维码</span>
        </div>
    `);
}

export function wrapDualLayout(existingMsgEl, leftLabel, rightLabel) {
    const panelId = 'dual-' + Date.now();
    const existingContent = existingMsgEl.querySelector('.msg-content');

    const wrapper = document.createElement('div');
    wrapper.className = 'chat-message assistant dual-analysis';
    wrapper.id = panelId;

    wrapper.innerHTML = `
        <div class="dual-columns">
            <div class="dual-col">
                <div class="dual-col-header"><span class="dual-dot simple"></span>${leftLabel}</div>
                <div class="dual-col-body" id="${panelId}-left"></div>
            </div>
            <div class="dual-col">
                <div class="dual-col-header"><span class="dual-dot pro"></span>${rightLabel}</div>
                <div class="dual-col-body" id="${panelId}-right">
                    <div class="loading-dots"><span></span><span></span><span></span></div>
                </div>
            </div>
        </div>
    `;

    existingMsgEl.replaceWith(wrapper);

    // Move existing content into left column
    const leftBody = wrapper.querySelector(`#${panelId}-left`);
    leftBody.innerHTML = existingContent.innerHTML;

    const rightBody = wrapper.querySelector(`#${panelId}-right`);
    return { panelEl: wrapper, targetEl: rightBody };
}

export function addSystemMessage(container, text) {
    if (!container) return;
    const msgHtml = `<div class="chat-message system">${escapeHtml(text)}</div>`;
    container.insertAdjacentHTML('beforeend', msgHtml);
}

export function isNearBottom(container, threshold = 80) {
    if (!container) return true;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
}

export function scrollChat(container, force = false) {
    if (!container) return;
    if (force || isNearBottom(container)) {
        container.scrollTop = container.scrollHeight;
    }
}
