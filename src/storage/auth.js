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

export async function registerUser(name, password) {
    const hp = hashPassword(password);

    // 优先在服务器注册
    try {
        const resp = await fetch(`${API_BASE}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, passwordHash: hp }),
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
    if (!user) return 0;
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
    const maxQuota = 15;
    return Math.max(0, maxQuota - (userData.usedQuota || 0));
}

export function decreaseUserQuota() {
    const user = getCurrentUser();
    if (!user) return false;
    if (hasProAccess()) return true;

    const users = getRegisteredUsers();
    const userData = users[user.name];
    if (!userData) return false;

    const today = new Date().toISOString().split('T')[0];
    if (userData.lastDivinationDate !== today) {
        userData.lastDivinationDate = today;
        userData.usedQuota = 0;
    }
    
    if ((userData.usedQuota || 0) >= 15) return false;

    userData.usedQuota = (userData.usedQuota || 0) + 1;
    saveRegisteredUsers(users);
    return true;
}

