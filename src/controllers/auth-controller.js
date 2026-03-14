/**
 * Auth Controller - Login/Register/Logout UI logic
 */
import { $, showToast } from '../utils/dom.js';
import { loginUser, registerUser, logoutUser, hasProAccess, getUserQuota, redeemVipCode, isVipUser, getGuestQuota, sendResetCode, resetPassword, bindEmail, getAdminStats, getCurrentUser, adminResetPassword, changePassword } from '../storage/auth.js';
import { MODEL_REGISTRY } from '../storage/settings.js';
import { loadHistory, mergeCloudHistory } from '../storage/history.js';
import { closeModal } from '../ui/modals.js';
import state from './state.js';

export function switchToLoginMode() {
    $('#tab-login').classList.add('active');
    $('#tab-register').classList.remove('active');
    $('#confirm-password-group').classList.add('hidden');
    $('#email-group')?.classList.add('hidden');
    $('#auth-password')?.setAttribute('autocomplete', 'current-password');
    $('#auth-confirm-password')?.setAttribute('autocomplete', 'off');
    $('#btn-auth-submit').textContent = '登录';
    // 确保显示登录表单，隐藏重置表单
    $('#auth-form-main')?.classList.remove('hidden');
    $('#auth-form-reset')?.classList.add('hidden');
}

export function switchToRegisterMode() {
    $('#tab-login').classList.remove('active');
    $('#tab-register').classList.add('active');
    $('#confirm-password-group').classList.remove('hidden');
    $('#email-group')?.classList.remove('hidden');
    $('#auth-password')?.setAttribute('autocomplete', 'new-password');
    $('#auth-confirm-password')?.setAttribute('autocomplete', 'new-password');
    $('#btn-auth-submit').textContent = '注册并进入';
    $('#auth-form-main')?.classList.remove('hidden');
    $('#auth-form-reset')?.classList.add('hidden');
}

export function updateUIForAuth() {
    const userLabel = $('#user-name-label');
    const userAvatar = $('#user-avatar');
    const userQuota = $('#user-quota-label');
    const logoutBtn = $('#btn-logout-header');
    const logoutSidebar = $('#btn-logout-sidebar');
    const sidebarFooter = $('#sidebar-mobile-footer');
    const modelSelect = $('#model-select');

    if (state.currentUser) {
        const isPro = hasProAccess();
        const vip = isVipUser();
        if (userLabel) { userLabel.textContent = state.currentUser.name; userLabel.style.display = ''; }
        if (userAvatar) { userAvatar.textContent = state.currentUser.name.charAt(0); userAvatar.style.display = ''; }
        
        if (userQuota) {
            userQuota.style.cursor = '';
            userQuota.style.fontWeight = '';
            userQuota.style.fontSize = '0.75rem';
            if (isPro) {
                userQuota.textContent = 'Pro';
                userQuota.style.display = 'inline-block';
                userQuota.style.color = 'var(--status-success)';
            } else if (vip) {
                const q = getUserQuota();
                userQuota.textContent = `VIP · 剩${q}次`;
                userQuota.style.display = 'inline-block';
                userQuota.style.color = 'var(--accent-plum)';
            } else {
                userQuota.textContent = '';
                userQuota.style.display = 'none';
                userQuota.style.color = '';
            }
        }

        // Logout buttons are visible for ALL logged-in users
        if (logoutBtn) logoutBtn.style.display = 'block';
        if (sidebarFooter) sidebarFooter.style.display = ''; // Fallback to CSS media query (flex on mobile, none on desktop)
        if (logoutSidebar) logoutSidebar.style.display = '';

        // 权限检测：只有管理员/付费用户才显示模型选择器
        if (modelSelect) {
            modelSelect.innerHTML = '';
            if (isPro) {
                for (const [key, model] of Object.entries(MODEL_REGISTRY)) {
                    modelSelect.add(new Option(model.label, key));
                }
                modelSelect.classList.add('show-for-pro');
                modelSelect.style.display = ''; // 清除内联样式，让CSS类生效
            } else {
                modelSelect.add(new Option(MODEL_REGISTRY['deepseek-combined'].label, 'deepseek-combined'));
                state.selectedModelKey = 'deepseek-combined';
                modelSelect.classList.remove('show-for-pro');
                modelSelect.style.display = 'none'; // 强制隐藏
            }
        }
    } else {
        if (userLabel) { userLabel.textContent = ''; userLabel.style.display = 'none'; }
        if (userAvatar) { userAvatar.textContent = ''; userAvatar.style.display = 'none'; }
        if (userQuota) {
            userQuota.innerHTML = '登录 / 注册';
            userQuota.style.display = 'inline-block';
            userQuota.style.color = 'var(--accent-plum)';
            userQuota.style.cursor = 'pointer';
            userQuota.style.fontWeight = '500';
            userQuota.style.fontSize = '0.85rem';
        }
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (sidebarFooter) sidebarFooter.style.display = 'none';
        if (logoutSidebar) logoutSidebar.style.display = 'none';
        if (modelSelect) {
            modelSelect.innerHTML = '';
            modelSelect.add(new Option(MODEL_REGISTRY['deepseek-combined'].label, 'deepseek-combined'));
            modelSelect.classList.remove('show-for-pro');  // 未登录用户隐藏模型选择器
            modelSelect.style.display = 'none';
        }
    }
}

const MAX_USERNAME_LEN = 20;
const MAX_PASSWORD_LEN = 64;
const USERNAME_RE = /^[\w\u4e00-\u9fa5]+$/; // letters, digits, _, Chinese

export async function handleAuthSubmit(renderHistory) {
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
        const email = $('#auth-email')?.value?.trim() || '';
        user = await registerUser(username, password, email);
    } else {
        user = await loginUser(username, password);
        // 如果用户不存在，自动切换到注册模式，让用户确认密码后完成注册
        if (user?.code === 'USER_NOT_FOUND') {
            switchToRegisterMode();
            $('#auth-confirm-password').value = '';
            $('#auth-confirm-password').focus();
            showToast('该用户尚未注册，请再次输入密码以确认注册', 'info');
            return;
        }
    }

    if (user && !user.error) {
        state.currentUser = user;
        updateUIForAuth();
        closeModal('modal-auth');
        // 历史记录在后台加载，不阻塞登录流程
        mergeCloudHistory(user.name).then(h => {
            state.history = h;
            renderHistory();
        });
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
    showToast('已退出', 'info');
}

export function handleRedeemVip() {
    const input = $('#vip-code-input');
    if (!input) return;
    const code = input.value.trim();
    if (!code) { showToast('请输入兑换码', 'error'); return; }
    const result = redeemVipCode(code);
    if (result.success) {
        showToast('🎉 VIP兑换成功！每日可用15次', 'success');
        input.value = '';
        updateUIForAuth();
    } else {
        showToast(result.error, 'error');
    }
}

// ===== 忘记密码流程 =====
export function showForgotPassword() {
    $('#auth-form-main')?.classList.add('hidden');
    $('#auth-form-reset')?.classList.remove('hidden');
    $('#reset-code-section')?.classList.add('hidden');
    $('#reset-username').value = '';
    $('#reset-code')&& ($('#reset-code').value = '');
    $('#reset-new-password') && ($('#reset-new-password').value = '');
}

export function hideForgotPassword() {
    $('#auth-form-reset')?.classList.add('hidden');
    $('#auth-form-main')?.classList.remove('hidden');
    switchToLoginMode();
}

export async function handleSendCode() {
    const name = $('#reset-username')?.value?.trim();
    if (!name) { showToast('请输入用户名', 'error'); return; }

    const btn = $('#btn-send-code');
    btn.disabled = true;
    btn.textContent = '发送中...';

    try {
        const data = await sendResetCode(name);
        if (data.success) {
            $('#reset-code-section')?.classList.remove('hidden');
            $('#reset-email-hint').textContent = `验证码已发送到 ${data.maskedEmail}，10分钟内有效`;
            showToast('验证码已发送，请查收邮件', 'success');
            // 60秒倒计时
            let sec = 60;
            btn.textContent = `${sec}s 后可重发`;
            const timer = setInterval(() => {
                sec--;
                if (sec <= 0) {
                    clearInterval(timer);
                    btn.disabled = false;
                    btn.textContent = '重新发送验证码';
                } else {
                    btn.textContent = `${sec}s 后可重发`;
                }
            }, 1000);
        } else {
            // 如果没绑定邮箱，显示更醒目的提示
            const hint = $('#reset-email-hint');
            if (data.error && data.error.includes('未绑定邮箱') && hint) {
                hint.innerHTML = `<span style="color:var(--status-warning,#e6a23c);">${data.error}</span>`;
                $('#reset-code-section')?.classList.remove('hidden');
            }
            showToast(data.error || '发送失败', 'error');
            btn.disabled = false;
            btn.textContent = '发送验证码到邮箱';
        }
    } catch (e) {
        showToast('网络错误，请稍后再试', 'error');
        btn.disabled = false;
        btn.textContent = '发送验证码到邮箱';
    }
}

export async function handleResetSubmit() {
    const name = $('#reset-username')?.value?.trim();
    const code = $('#reset-code')?.value?.trim();
    const newPwd = $('#reset-new-password')?.value;

    if (!name || !code || !newPwd) {
        showToast('请填写所有字段', 'error');
        return;
    }
    if (newPwd.length < 4) {
        showToast('新密码至少需要4个字符', 'error');
        return;
    }

    try {
        const data = await resetPassword(name, code, newPwd);
        if (data.success) {
            showToast('密码重置成功！请用新密码登录', 'success');
            hideForgotPassword();
            $('#auth-username').value = name;
            $('#auth-password').value = '';
            $('#auth-password').focus();
        } else {
            showToast(data.error || '重置失败', 'error');
        }
    } catch (e) {
        showToast('网络错误，请稍后再试', 'error');
    }
}

// ===== 个人面板 =====
const ADMIN_LIST = ['admin', 'gonghg'];

export async function showProfilePanel() {
    const user = getCurrentUser();
    if (!user) return;

    // 隐藏登录/注册/重置表单，显示个人面板
    $('#auth-form-main')?.classList.add('hidden');
    $('#auth-form-reset')?.classList.add('hidden');
    $('#auth-form-profile')?.classList.remove('hidden');
    $('.auth-tabs')?.classList.add('hidden');
    $('#auth-title').textContent = '我的账户';

    // 头像和名字
    $('#profile-avatar').textContent = user.name.charAt(0);
    $('#profile-name').textContent = user.name;

    // 邮箱绑定状态
    const emailStatus = $('#profile-email-status');
    const inputGroup = $('#profile-bind-input-group');

    if (user.hasEmail) {
        emailStatus.textContent = '✅ 已绑定邮箱（可自助找回密码）';
        emailStatus.style.color = 'var(--status-success)';
        inputGroup?.classList.add('hidden');
    } else {
        emailStatus.textContent = '⚠️ 尚未绑定邮箱，绑定后可自助找回密码';
        emailStatus.style.color = 'var(--status-warning, #e6a23c)';
        inputGroup?.classList.remove('hidden');
    }

    // 管理员面板
    const adminSection = $('#profile-admin-section');
    if (ADMIN_LIST.includes(user.name)) {
        adminSection?.classList.remove('hidden');
        $('#admin-user-count').textContent = '加载中...';
        $('#admin-user-list').innerHTML = '';
        try {
            const stats = await getAdminStats(user.name);
            $('#admin-user-count').textContent = `注册会员总数：${stats.totalUsers} 人`;
            // 渲染用户列表
            const listEl = $('#admin-user-list');
            if (stats.users && stats.users.length > 0) {
                const rows = stats.users.map((u, i) => {
                    const emailTag = u.email ? `<span style="color:var(--status-success);">✉</span>` : `<span style="color:#ccc;">—</span>`;
                    const date = u.created ? u.created.split('T')[0] : '';
                    return `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border-color);">
                        <span>${i + 1}. ${u.name}</span>
                        <span>${emailTag} ${date}</span>
                    </div>`;
                });
                listEl.innerHTML = rows.join('');
            }
        } catch {
            $('#admin-user-count').textContent = '获取失败';
        }
    } else {
        adminSection?.classList.add('hidden');
    }
}

export function hideProfilePanel() {
    $('#auth-form-profile')?.classList.add('hidden');
    $('.auth-tabs')?.classList.remove('hidden');
    $('#auth-title').textContent = '登录 / 注册';
    switchToLoginMode();
}

export async function handleBindEmail() {
    const user = getCurrentUser();
    if (!user) return;

    const email = $('#profile-email-input')?.value?.trim();
    if (!email) { showToast('请输入邮箱地址', 'error'); return; }

    const btn = $('#btn-bind-email');
    btn.disabled = true;
    btn.textContent = '绑定中...';

    try {
        const data = await bindEmail(user.name, email);
        if (data.success) {
            // 更新本地用户信息
            user.hasEmail = true;
            localStorage.setItem('meihua_current_user', JSON.stringify(user));
            state.currentUser = user;
            showToast('邮箱绑定成功！', 'success');
            // 刷新面板
            showProfilePanel();
        } else {
            showToast(data.error || '绑定失败', 'error');
        }
    } catch {
        showToast('网络错误，请稍后再试', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '绑定';
    }
}

// ===== 管理员帮用户重置密码 =====
export async function handleAdminResetPassword() {
    const user = getCurrentUser();
    if (!user || !ADMIN_LIST.includes(user.name)) return;

    const target = $('#admin-reset-target')?.value?.trim();
    const newPwd = $('#admin-reset-newpwd')?.value?.trim();
    if (!target || !newPwd) { showToast('请填写用户名和新密码', 'error'); return; }
    if (newPwd.length < 4) { showToast('密码至少4个字符', 'error'); return; }

    const btn = $('#btn-admin-reset');
    btn.disabled = true;
    btn.textContent = '重置中...';

    try {
        const data = await adminResetPassword(user.name, target, newPwd);
        if (data.success) {
            showToast(`已重置 ${target} 的密码`, 'success');
            $('#admin-reset-target').value = '';
            $('#admin-reset-newpwd').value = '';
        } else {
            showToast(data.error || '重置失败', 'error');
        }
    } catch {
        showToast('网络错误', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '重置该用户密码';
    }
}

// ===== 用户修改密码 =====
export async function handleChangePassword() {
    const user = getCurrentUser();
    if (!user) return;

    const oldPwd = $('#profile-old-pwd')?.value;
    const newPwd = $('#profile-new-pwd')?.value;
    if (!oldPwd || !newPwd) { showToast('请填写当前密码和新密码', 'error'); return; }
    if (newPwd.length < 4) { showToast('新密码至少4个字符', 'error'); return; }

    const btn = $('#btn-change-pwd');
    btn.disabled = true;
    btn.textContent = '修改中...';

    try {
        const data = await changePassword(user.name, oldPwd, newPwd);
        if (data.success) {
            showToast('密码修改成功！', 'success');
            $('#profile-old-pwd').value = '';
            $('#profile-new-pwd').value = '';
        } else {
            showToast(data.error || '修改失败', 'error');
        }
    } catch {
        showToast('网络错误', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '确认修改';
    }
}
