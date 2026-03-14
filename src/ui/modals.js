/**
 * Modal Management
 */
import { $ } from '../utils/dom.js';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function openModal(id) {
    const el = $(`#${id}`);
    if (el) {
        el.classList.remove('hidden');
        // 手机端：锁 body 滚动，把页面拉到顶部让 modal 可见
        if (window.innerWidth <= 900) {
            document.body.style.overflow = 'hidden';
            window.scrollTo(0, 0);
        }
    }
}

export function closeModal(id) {
    const el = $(`#${id}`);
    if (el) {
        el.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

// iOS 键盘修复：focus 时强制 scrollIntoView
export function initIOSKeyboardFix() {
    if (!isIOS) return;
    document.addEventListener('focusin', (e) => {
        const el = e.target;
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            const modal = el.closest('.modal-overlay');
            if (modal && !modal.classList.contains('hidden')) {
                setTimeout(() => {
                    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }, 300);
            }
        }
    });
}

export function initModals() {
    // Global close button listener
    document.addEventListener('click', (e) => {
        if (e.target.matches('.modal-bg') || e.target.matches('.btn-close-modal')) {
            const modal = e.target.closest('.modal-container');
            if (modal) modal.classList.add('hidden');
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const visibleModals = document.querySelectorAll('.modal-container:not(.hidden)');
            visibleModals.forEach(m => m.classList.add('hidden'));
        }
    });
}
