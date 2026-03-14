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
            <div class="history-item-surface">
                <div class="history-item-top">
                    <span class="history-item-name">${escapeHtml(name)}</span>
                    <span class="history-item-time" style="font-size: 0.75rem; color: var(--text-tertiary); font-weight: normal;">${escapeHtml(time)}</span>
                </div>
                <div class="history-item-desc">${escapeHtml(item.question || '未设问')}</div>
            </div>
            <button class="history-delete-btn" type="button" title="删除记录">删除</button>
        </div>
    `;
    }).join('');

    // Attach listeners
    let openedItem = null;
    const SWIPE_WIDTH = 56;

    const closeOpenedItem = () => {
        if (!openedItem) return;
        const openedSurface = openedItem.querySelector('.history-item-surface');
        openedItem.classList.remove('swiped');
        if (openedSurface) openedSurface.style.transform = '';
        const openedBtn = openedItem.querySelector('.history-delete-btn');
        if (openedBtn) {
            openedBtn.dataset.confirming = 'false';
            openedBtn.textContent = '删除';
        }
        openedItem = null;
    };

    container.querySelectorAll('.history-item').forEach(el => {
        let startX = null;
        let startY = 0;
        let deltaX = 0;
        let ignoreClick = false;
        let dragging = false;
        const surface = el.querySelector('.history-item-surface');

        const setSurfaceOffset = (offset) => {
            if (!surface) return;
            surface.style.transform = `translateX(${offset}px)`;
        };

        el.addEventListener('click', (e) => {
            if (e.target.closest('.history-delete-btn')) return;
            if (ignoreClick) {
                ignoreClick = false;
                return;
            }
            if (openedItem && openedItem !== el) {
                closeOpenedItem();
            }
            if (el.classList.contains('swiped')) {
                closeOpenedItem();
                return;
            }
            const id = el.dataset.id;
            if (onSelect) onSelect(id);
        });

        el.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            if (openedItem && openedItem !== el) {
                closeOpenedItem();
            }
            startX = e.clientX;
            startY = e.clientY;
            deltaX = 0;
            dragging = false;
        });

        el.addEventListener('pointermove', (e) => {
            if (startX === null) return;
            deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 18) {
                dragging = true;
                e.preventDefault();

                if (el.classList.contains('swiped')) {
                    const nextOffset = Math.max(-SWIPE_WIDTH, Math.min(0, -SWIPE_WIDTH + deltaX));
                    setSurfaceOffset(nextOffset);
                    return;
                }

                const nextOffset = Math.max(-SWIPE_WIDTH, Math.min(0, deltaX));
                setSurfaceOffset(nextOffset);
            }
        });

        const finishSwipe = () => {
            if (startX === null) return;

            if (!dragging) {
                startX = null;
                deltaX = 0;
                return;
            }

            if (!el.classList.contains('swiped') && deltaX < -32) {
                el.classList.add('swiped');
                setSurfaceOffset(-SWIPE_WIDTH);
                openedItem = el;
                ignoreClick = true;
                startX = null;
                deltaX = 0;
                dragging = false;
                return;
            }

            if (el.classList.contains('swiped') && deltaX > 22) {
                closeOpenedItem();
                ignoreClick = true;
            } else if (el.classList.contains('swiped')) {
                setSurfaceOffset(-SWIPE_WIDTH);
            } else {
                setSurfaceOffset(0);
            }

            startX = null;
            deltaX = 0;
            dragging = false;
        };

        el.addEventListener('pointerup', finishSwipe);
        el.addEventListener('pointercancel', () => {
            if (el.classList.contains('swiped')) {
                setSurfaceOffset(-SWIPE_WIDTH);
            } else {
                setSurfaceOffset(0);
            }
            startX = null;
            deltaX = 0;
            dragging = false;
        });

        const delBtn = el.querySelector('.history-delete-btn');
        if (delBtn) {
            delBtn.onclick = (e) => {
                e.stopPropagation();
                const id = el.dataset.id;
                if (delBtn.dataset.confirming === 'true') {
                    closeOpenedItem();
                    if (onDelete) onDelete(id);
                } else {
                    delBtn.dataset.confirming = 'true';
                    delBtn.textContent = '确认';
                    setTimeout(() => {
                        delBtn.dataset.confirming = 'false';
                        delBtn.textContent = '删除';
                    }, 3000);
                }
            };
        }
    });
}
