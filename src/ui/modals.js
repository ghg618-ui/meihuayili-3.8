/**
 * Modal Management
 */
import { $ } from '../utils/dom.js';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isWeChat = /MicroMessenger/i.test(navigator.userAgent);
const useStandaloneAuthView = isIOS && isWeChat;

export function openModal(id) {
    const el = $(`#${id}`);
    if (el) {
        el.classList.remove('hidden');
        if (id === 'modal-auth' && useStandaloneAuthView && window.innerWidth <= 900) {
            document.documentElement.classList.add('auth-sheet-mode');
            document.body.classList.add('auth-sheet-mode');
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
    }
}

export function closeModal(id) {
    const el = $(`#${id}`);
    if (el) {
        el.classList.add('hidden');
        if (id === 'modal-auth') {
            document.documentElement.classList.remove('auth-sheet-mode');
            document.body.classList.remove('auth-sheet-mode');
        }
    }
}

export function initModals() {
    // Global close button listener
    document.addEventListener('click', (e) => {
        if (e.target.matches('.modal-bg') || e.target.matches('.btn-close-modal')) {
            const modal = e.target.closest('.modal-overlay');
            if (modal?.id) closeModal(modal.id);
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const visibleModals = document.querySelectorAll('.modal-overlay:not(.hidden)');
            visibleModals.forEach((modal) => {
                if (modal.id) closeModal(modal.id);
            });
        }
    });
}
