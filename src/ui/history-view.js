/**
 * History List View
 * 点击 → 露出"打开"按钮，左滑 → 露出"删除"按钮
 */
import { $, $$, escapeHtml } from '../utils/dom.js';

export function renderHistoryList(container, history, currentId, onSelect, onDelete) {
    if (!container) return;

    if (history.length === 0) {
        container.innerHTML = '<div class="history-empty">暂无回响，请先起卦</div>';
        return;
    }

    const SWIPE_WIDTH = 60;

    container.innerHTML = history.map(item => {
        const name = item.result?.original?.name || '未知卦象';
        const time = (item.timestamp || '').split(' ')[0] || '';
        return `
        <div class="history-item ${String(currentId) === String(item.id) ? 'active' : ''}" data-id="${item.id}">
            <button class="history-open-btn" type="button">打开</button>
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

    let openedItem = null;

    const closeOpenedItem = () => {
        if (!openedItem) return;
        const s = openedItem.querySelector('.history-item-surface');
        openedItem.classList.remove('swiped-left', 'swiped-right');
        if (s) s.style.transform = '';
        const delBtn = openedItem.querySelector('.history-delete-btn');
        if (delBtn) { delBtn.dataset.confirming = 'false'; delBtn.textContent = '删除'; }
        openedItem = null;
    };

    const openRight = (el) => {
        closeOpenedItem();
        el.classList.add('swiped-right');
        const s = el.querySelector('.history-item-surface');
        if (s) s.style.transform = `translateX(${SWIPE_WIDTH}px)`;
        openedItem = el;
    };

    container.querySelectorAll('.history-item').forEach(el => {
        let startX = null;
        let startY = 0;
        let dragging = false;
        const surface = el.querySelector('.history-item-surface');

        const setOffset = (px) => {
            if (surface) surface.style.transform = `translateX(${px}px)`;
        };

        // --- POINTER: detect both tap and left-swipe ---
        el.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            startX = e.clientX;
            startY = e.clientY;
            dragging = false;
        });

        el.addEventListener('pointermove', (e) => {
            if (startX === null) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            // Only enter drag mode on clear leftward horizontal gesture
            if (!dragging && Math.abs(dx) > Math.abs(dy) && dx < -18) {
                dragging = true;
            }
            if (!dragging) return;
            e.preventDefault();

            if (el.classList.contains('swiped-left')) {
                setOffset(Math.max(-SWIPE_WIDTH, Math.min(0, -SWIPE_WIDTH + dx)));
            } else {
                // Close any right-revealed state first, then track left drag
                if (el.classList.contains('swiped-right')) {
                    el.classList.remove('swiped-right');
                    openedItem = null;
                }
                setOffset(Math.max(-SWIPE_WIDTH, Math.min(0, dx)));
            }
        });

        const finishSwipe = (e) => {
            if (startX === null) return;

            if (!dragging) {
                startX = null;
                // This was a tap — show/hide "打开" button
                if (e && !e.target.closest('.history-delete-btn') && !e.target.closest('.history-open-btn')) {
                    if (openedItem === el) {
                        closeOpenedItem();
                    } else {
                        openRight(el);
                    }
                }
                return;
            }

            const isSwipedLeft = el.classList.contains('swiped-left');

            if (isSwipedLeft) {
                // Was showing delete; check if dragged right enough to close
                const currentX = surface ? parseFloat(surface.style.transform.replace(/[^-\d.]/g, '')) || 0 : 0;
                if (currentX > -SWIPE_WIDTH / 2) {
                    closeOpenedItem();
                } else {
                    setOffset(-SWIPE_WIDTH);
                }
            } else {
                // From neutral/right state: check if surface moved left enough
                const currentX = surface ? parseFloat(surface.style.transform.replace(/[^-\d.]/g, '')) || 0 : 0;
                if (currentX < -SWIPE_WIDTH / 2) {
                    closeOpenedItem();
                    el.classList.add('swiped-left');
                    setOffset(-SWIPE_WIDTH);
                    openedItem = el;
                } else {
                    setOffset(0);
                }
            }

            startX = null; dragging = false;
        };

        el.addEventListener('pointerup', finishSwipe);
        el.addEventListener('pointercancel', () => {
            if (el.classList.contains('swiped-left')) setOffset(-SWIPE_WIDTH);
            else if (el.classList.contains('swiped-right')) setOffset(SWIPE_WIDTH);
            else setOffset(0);
            startX = null; dragging = false;
        });

        // --- Open button ---
        const openBtn = el.querySelector('.history-open-btn');
        if (openBtn) {
            openBtn.onclick = (e) => {
                e.stopPropagation();
                const id = el.dataset.id;
                closeOpenedItem();
                if (onSelect) onSelect(id);
            };
        }

        // --- Delete button ---
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
