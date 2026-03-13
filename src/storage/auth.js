/**
 * User Auth & Registry Storage
 * 优先调用服务器存储，localStorage 作为本地缓存
 */
import { hashPassword } from '../utils/hashing.js';
import makeLogger from '../utils/logger.js';

const log = makeLogger('Auth');

const API_BASE = 'https://api.meihuayili.com';

export function getRegisteredUsers() {
    try {
        return JSON.parse(localStorage.getItem('meihua_users') || '{}');
    } catch (e) {
        log.error('Failed to parse users registry', e);
        return {};
    }
}

export function saveRegisteredUsers(users) {
    localStorage.setItem('meihua_users', JSON.stringify(users));
}

export async function loginUser(name, password) {
    const hp = hashPassword(password);

    // 优先服务器验证
    try {
        const resp = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, passwordHash: hp }),
        });
        const data = await resp.json();
        if (resp.ok && data.success) {
            // 同步到 localStorage 缓存
            const users = getRegisteredUsers();
            if (!users[name]) {
                users[name] = { name, password: hp, created: new Date().toISOString() };
                saveRegisteredUsers(users);
            }
            const currentUser = { name };
            localStorage.setItem('meihua_current_user', JSON.stringify(currentUser));
            return currentUser;
        }
        return { error: data.error || '用户名或密码错误', code: data.code };
    } catch (e) {
        log.warn('服务器登录失败，使用本地验证', e);
    }

    // 服务器不可用时回退到 localStorage
    const users = getRegisteredUsers();
    const user = users[name];
    if (!user) {
        return { error: '用户尚未注册', code: 'USER_NOT_FOUND' };
    }
    if (user.password === hp || user.passwordHash === hp) {
        const currentUser = { name };
        localStorage.setItem('meihua_current_user', JSON.stringify(currentUser));
        return currentUser;
    }
    return { error: '密码错误', code: 'WRONG_PASSWORD' };
}

export async function registerUser(name, password, email) {
    const hp = hashPassword(password);
    const cleanEmail = (email || '').trim().toLowerCase();

    // 优先在服务器注册
    try {
        const resp = await fetch(`${API_BASE}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, passwordHash: hp, email: cleanEmail }),
        });
        const data = await resp.json();
        if (resp.ok && data.success) {
            // 同步到 localStorage 缓存
            const users = getRegisteredUsers();
            users[name] = { name, password: hp, created: new Date().toISOString() };
            saveRegisteredUsers(users);
            const currentUser = { name };
            localStorage.setItem('meihua_current_user', JSON.stringify(currentUser));
            return currentUser;
        }
        return { error: data.error || '注册失败' };
    } catch (e) {
        log.warn('服务器注册失败，使用本地存储', e);
    }

    // 服务器不可用时回退到 localStorage
    const users = getRegisteredUsers();
    if (users[name]) return { error: '用户已存在' };
    users[name] = { name, password: hp, created: new Date().toISOString() };
    saveRegisteredUsers(users);
    const currentUser = { name };
    localStorage.setItem('meihua_current_user', JSON.stringify(currentUser));
    return currentUser;
}

export async function sendResetCode(name) {
    const resp = await fetch(`${API_BASE}/api/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
    return resp.json();
}

export async function resetPassword(name, code, newPassword) {
    const hp = hashPassword(newPassword);
    const resp = await fetch(`${API_BASE}/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code, newPasswordHash: hp }),
    });
    return resp.json();
}

export function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('meihua_current_user') || 'null');
    } catch (e) {
        return null;
    }
}

export function logoutUser() {
    localStorage.removeItem('meihua_current_user');
}

/**
 * 检查用户是否有专业版权限
 * 目前支持：管理员账户、付费用户（未来扩展）
 * @returns {boolean}
 */
export function hasProAccess() {
    const user = getCurrentUser();
    if (!user) return false;
    
    const users = getRegisteredUsers();
    const userData = users[user.name];
    if (!userData) return false;
    
    // 管理员白名单（当前阶段仅管理员显示专业功能，避免普通用户被误判）
    const adminList = ['admin', 'gonghg'];
    if (adminList.includes(user.name)) return true;

    // 付费体系未正式上线：先全部按普通用户处理
    // 后续接入订阅时，再改为严格字段校验（如 status==='active' 且未过期）。
    return false;
}

export function getUserQuota() {
    const user = getCurrentUser();
    if (!user) return getGuestQuota();
    if (hasProAccess()) return 999;

    const users = getRegisteredUsers();
    const userData = users[user.name];
    if (!userData) return 0;

    const today = new Date().toISOString().split('T')[0];
    if (userData.lastDivinationDate !== today) {
        userData.lastDivinationDate = today;
        userData.usedQuota = 0;
        saveRegisteredUsers(users);
    }
    const maxQuota = userData.vipCode ? 15 : 10;
    return Math.max(0, maxQuota - (userData.usedQuota || 0));
}

export function decreaseUserQuota() {
    const user = getCurrentUser();
    if (!user) return decreaseGuestQuota();
    if (hasProAccess()) return true;

    const users = getRegisteredUsers();
    const userData = users[user.name];
    if (!userData) return false;

    const today = new Date().toISOString().split('T')[0];
    if (userData.lastDivinationDate !== today) {
        userData.lastDivinationDate = today;
        userData.usedQuota = 0;
    }
    
    const maxQuota = userData.vipCode ? 15 : 10;
    if ((userData.usedQuota || 0) >= maxQuota) return false;

    userData.usedQuota = (userData.usedQuota || 0) + 1;
    saveRegisteredUsers(users);
    return true;
}

// ===== 游客额度系统 =====
const GUEST_KEY = 'meihua_guest_quota';
const GUEST_MAX = 3;

function getGuestData() {
    try {
        return JSON.parse(localStorage.getItem(GUEST_KEY) || '{}');
    } catch { return {}; }
}

function saveGuestData(data) {
    localStorage.setItem(GUEST_KEY, JSON.stringify(data));
}

export function getGuestQuota() {
    const data = getGuestData();
    const today = new Date().toISOString().split('T')[0];
    if (data.date !== today) return GUEST_MAX;
    return Math.max(0, GUEST_MAX - (data.used || 0));
}

function decreaseGuestQuota() {
    const data = getGuestData();
    const today = new Date().toISOString().split('T')[0];
    if (data.date !== today) {
        data.date = today;
        data.used = 0;
    }
    if ((data.used || 0) >= GUEST_MAX) return false;
    data.used = (data.used || 0) + 1;
    saveGuestData(data);
    return true;
}

// ===== VIP 码兑换 =====
const VALID_VIP_CODES = ['YIHONG2026', 'MEIHUA888'];

export function redeemVipCode(code) {
    const user = getCurrentUser();
    if (!user) return { error: '请先登录再兑换' };

    const trimmed = (code || '').trim().toUpperCase();
    if (!VALID_VIP_CODES.includes(trimmed)) return { error: '兑换码无效' };

    const users = getRegisteredUsers();
    const userData = users[user.name];
    if (!userData) return { error: '用户数据异常' };
    if (userData.vipCode) return { error: '您已兑换过VIP码' };

    userData.vipCode = trimmed;
    saveRegisteredUsers(users);
    return { success: true };
}

export function isVipUser() {
    const user = getCurrentUser();
    if (!user) return false;
    const users = getRegisteredUsers();
    return !!users[user.name]?.vipCode;
}