/**
 * History List View
 * 点击 → 直接打开，左滑 → 露出"删除"按钮
 */
import { $, $$, escapeHtml } from '../utils/dom.js';

export function renderHistoryList(container, history, currentId, onSelect, onDelete) {
    if (!container) return;

    if (history.length === 0) {
        container.innerHTML = '<div class="history-empty">暂无回响，请先起卦</div>';
        return;
    }

    const SWIPE_WIDTH = 68;
    const SWIPE_THRESHOLD = 30; // 手指至少移动 30px 才算滑动

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

    let openedItem = null;

    const closeOpenedItem = () => {
        if (!openedItem) return;
        const s = openedItem.querySelector('.history-item-surface');
        openedItem.classList.remove('swiped-left');
        if (s) s.style.transform = '';
        const delBtn = openedItem.querySelector('.history-delete-btn');
        if (delBtn) { delBtn.dataset.confirming = 'false'; delBtn.textContent = '删除'; }
        openedItem = null;
    };

    container.querySelectorAll('.history-item').forEach(el => {
        let startX = null;
        let startY = 0;
        let dragging = false;
        let lockedAxis = null; // 'h' or 'v' — lock to prevent accidental triggers
        const surface = el.querySelector('.history-item-surface');

        const setOffset = (px) => {
            if (surface) surface.style.transform = `translateX(${px}px)`;
        };

        el.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            startX = e.clientX;
            startY = e.clientY;
            dragging = false;
            lockedAxis = null;
        });

        el.addEventListener('pointermove', (e) => {
            if (startX === null) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            // Determine axis lock after 8px movement
            if (!lockedAxis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
                lockedAxis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
            }

            // If scrolling vertically, bail out
            if (lockedAxis === 'v') return;

            // Need clear leftward gesture past threshold to start drag
            if (!dragging && lockedAxis === 'h' && dx < -SWIPE_THRESHOLD) {
                dragging = true;
                el.setPointerCapture(e.pointerId);
            }
            if (!dragging) return;
            e.preventDefault();

            if (el.classList.contains('swiped-left')) {
                // Already showing delete, allow drag to close
                setOffset(Math.max(-SWIPE_WIDTH, Math.min(0, -SWIPE_WIDTH + dx)));
            } else {
                setOffset(Math.max(-SWIPE_WIDTH, Math.min(0, dx)));
            }
        });

        const finishSwipe = (e) => {
            if (startX === null) return;

            if (!dragging) {
                startX = null;
                lockedAxis = null;
                // Tap → directly open the case (unless tapping the delete button)
                if (e && !e.target.closest('.history-delete-btn')) {
                    if (openedItem) {
                        // If any item has delete showing, just close it
                        closeOpenedItem();
                    } else {
                        const id = el.dataset.id;
                        if (onSelect) onSelect(id);
                    }
                }
                return;
            }

            const isSwipedLeft = el.classList.contains('swiped-left');

            if (isSwipedLeft) {
                const currentX = surface ? parseFloat(surface.style.transform.replace(/[^-\d.]/g, '')) || 0 : 0;
                if (currentX > -SWIPE_WIDTH / 2) {
                    closeOpenedItem();
                } else {
                    setOffset(-SWIPE_WIDTH);
                }
            } else {
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

            startX = null; dragging = false; lockedAxis = null;
        };

        el.addEventListener('pointerup', finishSwipe);
        el.addEventListener('pointercancel', () => {
            if (el.classList.contains('swiped-left')) setOffset(-SWIPE_WIDTH);
            else setOffset(0);
            startX = null; dragging = false; lockedAxis = null;
        });

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
                    delBtn.textContent = '确认?';
                    setTimeout(() => {
                        if (delBtn.dataset.confirming === 'true') {
                            delBtn.dataset.confirming = 'false';
                            delBtn.textContent = '删除';
                        }
                    }, 3000);
                }
            };
        }
    });
}
