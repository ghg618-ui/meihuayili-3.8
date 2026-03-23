/**
 * Chat Messages View
 */
import { $, escapeHtml } from '../utils/dom.js';
import { formatMarkdown } from '../utils/formatter.js';
import { hasProAccess, getUserTier } from '../storage/auth.js';

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

export function appendAssistantMessageActions(msgEl, allowFollowUp = true) {
    if (!msgEl) return;

    const contentEl = msgEl.querySelector('.msg-content');
    if (!contentEl) return;

    contentEl.querySelectorAll('.msg-feedback-actions, .msg-bottom-actions, .msg-action-row, .wechat-promo').forEach((node) => node.remove());

    // 检查是否是 Pro 用户且允许追问
    const isPro = hasProAccess();
    const tier = getUserTier();
    const followUpCount = parseInt(msgEl.dataset.followUpCount || '0');
    const maxFollowUp = tier === 'lifetime' || tier === 'admin' ? 5 : 3;
    const canFollowUp = isPro && allowFollowUp && followUpCount < maxFollowUp;

    let followUpButton = '';
    if (canFollowUp) {
        followUpButton = `
            <button class="msg-inline-action msg-followup-btn" onclick="window.startFollowUp('${msgEl.id}')" title="针对此卦象继续提问">
                💬 追问 (${followUpCount}/${maxFollowUp})
            </button>
        `;
    } else if (isPro && followUpCount >= maxFollowUp) {
        followUpButton = `
            <button class="msg-inline-action" disabled title="本轮追问次数已用完">
                💬 追问已用完
            </button>
        `;
    }

    contentEl.insertAdjacentHTML('beforeend', `
        <div class="msg-action-row">
            <button class="msg-inline-action" onclick="window.openFeedbackModal('${msgEl.id}')" title="提供卦例反馈">
                卦例点评
            </button>
            ${followUpButton}
            <button class="msg-inline-action" onclick="window.exportDivinationResult()">导出结果</button>
            <button class="msg-inline-action" onclick="window.startNewCaseFromChat()">新起一卦</button>
        </div>
    `);

    window.syncMobileNewCaseButtonVisibility?.();
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

    const style = window.getComputedStyle(container);
    const isScrollable = ['auto', 'scroll'].includes(style.overflowY) && container.scrollHeight > container.clientHeight + 1;

    if (!isScrollable) {
        const scrollRoot = document.scrollingElement || document.documentElement;
        const viewportBottom = window.scrollY + window.innerHeight;
        return scrollRoot.scrollHeight - viewportBottom < threshold;
    }

    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
}

export function scrollChat(container, force = false) {
    if (!container) return;

    const style = window.getComputedStyle(container);
    const isScrollable = ['auto', 'scroll'].includes(style.overflowY) && container.scrollHeight > container.clientHeight + 1;

    if (force || isNearBottom(container)) {
        if (!isScrollable) {
            const scrollRoot = document.scrollingElement || document.documentElement;
            scrollRoot.scrollTop = scrollRoot.scrollHeight;
            return;
        }

        container.scrollTop = container.scrollHeight;
    }
}
