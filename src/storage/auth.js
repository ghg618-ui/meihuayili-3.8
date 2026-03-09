/**
 * User Auth & Registry Storage
 */
import { hashPassword } from '../utils/hashing.js';
import makeLogger from '../utils/logger.js';

const log = makeLogger('Auth');

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

export function loginUser(name, password) {
    const users = getRegisteredUsers();
    const hp = hashPassword(password);
    const user = users[name];
    if (user && (user.password === hp || user.passwordHash === hp)) {
        const currentUser = { name };
        localStorage.setItem('meihua_current_user', JSON.stringify(currentUser));
        return currentUser;
    }
    return null;
}

export function registerUser(name, password) {
    const users = getRegisteredUsers();
    if (users[name]) return { error: '用户已存在' };

    users[name] = {
        name,
        password: hashPassword(password),
        created: new Date().toISOString()
    };
    saveRegisteredUsers(users);

    const user = { name };
    localStorage.setItem('meihua_current_user', JSON.stringify(user));
    return user;
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
    const maxQuota = 10;
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
    
    if ((userData.usedQuota || 0) >= 10) return false;

    userData.usedQuota = (userData.usedQuota || 0) + 1;
    saveRegisteredUsers(users);
    return true;
}

