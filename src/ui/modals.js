/**
 * Modal Management
 */
import { $ } from '../utils/dom.js';

export function openModal(id) {
    const el = $(`#${id}`);
    if (el) el.classList.remove('hidden');
}

export function closeModal(id) {
    const el = $(`#${id}`);
    if (el) el.classList.add('hidden');
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
