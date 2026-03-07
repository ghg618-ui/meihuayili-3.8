/**
 * History List View
 */
import { $, $$, escapeHtml } from '../utils/dom.js';

export function renderHistoryList(container, history, currentId, onSelect, onDelete) {
    if (!container) return;

    if (history.length === 0) {
        container.innerHTML = '<div class="history-empty">暂无回响，请先起卦</div>';
        return;
    }

    container.innerHTML = history.map(item => {
        const name = item.result?.original?.name || '未知卦象';
        const time = (item.timestamp || '').split(' ')[0] || '';
        return `
        <div class="history-item ${String(currentId) === String(item.id) ? 'active' : ''}" data-id="${item.id}">
            <div class="history-item-top">
                <span class="history-item-name">${escapeHtml(name)}</span>
                <span class="history-item-time" style="font-size: 0.75rem; color: var(--text-tertiary); font-weight: normal;">${escapeHtml(time)}</span>
            </div>
            <div class="history-item-desc">${escapeHtml(item.question || '未设问')}</div>
            <div class="history-delete-btn" title="删除记录">🗑️</div>
        </div>
    `;
    }).join('');

    // Attach listeners
    container.querySelectorAll('.history-item').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.history-delete-btn')) return;
            const id = el.dataset.id;
            if (onSelect) onSelect(id);
        });

        const delBtn = el.querySelector('.history-delete-btn');
        if (delBtn) {
            delBtn.onclick = (e) => {
                e.stopPropagation();
                const id = el.dataset.id;
                if (delBtn.dataset.confirming === 'true') {
                    if (onDelete) onDelete(id);
                } else {
                    delBtn.dataset.confirming = 'true';
                    delBtn.textContent = '❌';
                    delBtn.style.color = 'red';
                    setTimeout(() => {
                        delBtn.dataset.confirming = 'false';
                        delBtn.textContent = '🗑️';
                        delBtn.style.color = '';
                    }, 3000);
                }
            };
        }
    });
}
