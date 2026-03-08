/**
 * Auth Controller - Login/Register/Logout UI logic
 */
import { $, showToast } from '../utils/dom.js';
import { loginUser, registerUser, logoutUser } from '../storage/auth.js';
import { loadHistory } from '../storage/history.js';
import { closeModal } from '../ui/modals.js';
import state from './state.js';

export function switchToLoginMode() {
    $('#tab-login').classList.add('active');
    $('#tab-register').classList.remove('active');
    $('#confirm-password-group').classList.add('hidden');
    $('#btn-auth-submit').textContent = '登录';
}

export function switchToRegisterMode() {
    $('#tab-login').classList.remove('active');
    $('#tab-register').classList.add('active');
    $('#confirm-password-group').classList.remove('hidden');
    $('#btn-auth-submit').textContent = '注册并进入';
}

export function updateUIForAuth() {
    const userLabel = $('#user-name-label');
    const userAvatar = $('#user-avatar');
    const logoutBtn = $('#btn-logout-header');
    const logoutSidebar = $('#btn-logout-sidebar');
    const sidebarFooter = $('#sidebar-mobile-footer');

    if (state.currentUser) {
        if (userLabel) userLabel.textContent = state.currentUser.name;
        if (userAvatar) userAvatar.textContent = state.currentUser.name.charAt(0);
        if (logoutBtn) logoutBtn.style.display = 'block';
        if (sidebarFooter) sidebarFooter.style.display = 'flex';
    } else {
        if (userLabel) userLabel.textContent = '未登录';
        if (userAvatar) userAvatar.textContent = '?';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (sidebarFooter) sidebarFooter.style.display = 'none';
    }
}

const MAX_USERNAME_LEN = 20;
const MAX_PASSWORD_LEN = 64;
const USERNAME_RE = /^[\w\u4e00-\u9fa5]+$/; // letters, digits, _, Chinese

export function handleAuthSubmit(renderHistory) {
    const username = $('#auth-username').value.trim();
    const password = $('#auth-password').value;
    const mode = $('#tab-register').classList.contains('active') ? 'register' : 'login';

    if (!username || !password) {
        showToast('请填写用户名和密码', 'error');
        return;
    }
    if (username.length > MAX_USERNAME_LEN) {
        showToast(`用户名不可超过${MAX_USERNAME_LEN}个字符`, 'error');
        return;
    }
    if (!USERNAME_RE.test(username)) {
        showToast('用户名仅限中英文、数字和下划线', 'error');
        return;
    }
    if (password.length < 4) {
        showToast('密码至少需要4个字符', 'error');
        return;
    }
    if (password.length > MAX_PASSWORD_LEN) {
        showToast(`密码不可超过${MAX_PASSWORD_LEN}个字符`, 'error');
        return;
    }

    let user;
    if (mode === 'register') {
        const confirm = $('#auth-confirm-password').value;
        if (password !== confirm) {
            showToast('两次密码输入不一致', 'error');
            return;
        }
        user = registerUser(username, password);
    } else {
        user = loginUser(username, password);
    }

    if (user && !user.error) {
        state.currentUser = user;
        state.history = loadHistory(user.name);
        updateUIForAuth();
        renderHistory();
        closeModal('modal-auth');
        showToast(`已以此身份进入：${user.name}`, 'success');
    } else {
        showToast(user?.error || '认证失败，请检查用户名密码', 'error');
    }
}

export function handleLogout(renderHistory, startNewCase) {
    logoutUser();
    state.currentUser = null;
    state.history = [];
    state.lastRecordId = null;
    updateUIForAuth();
    renderHistory();
    startNewCase();
    showToast('已退出院馆', 'info');
}
