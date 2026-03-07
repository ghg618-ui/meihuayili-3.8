/**
 * Chat Messages View
 */
import { $, escapeHtml } from '../utils/dom.js';
import { formatMarkdown } from '../utils/formatter.js';

export function addMessage(container, { role, content, reasoning, modelLabel }) {
    if (!container) return;

    const msgId = 'msg-' + Date.now();

    const feedbackHtml = role === 'assistant' ? `
        <div class="msg-feedback-actions">
            <button class="btn-feedback icon-btn" onclick="window.openFeedbackModal('${msgId}')" title="提供卦例点评反馈">
                <span class="fb-icon" style="font-size:1.1rem">📋</span> 卦例点评
            </button>
        </div>
    ` : '';

    const msgHtml = `
        <div class="chat-message ${role}" id="${msgId}">
            <div class="msg-content">
                ${reasoning ? `<details class="thinking-block"><summary>💭 思考过程</summary><pre>${escapeHtml(reasoning)}</pre></details>` : ''}
                ${formatMarkdown(content)}
                ${feedbackHtml}
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', msgHtml);
    return $(`#${msgId}`);
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
