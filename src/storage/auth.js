/**
 * User Auth & Registry Storage
 * 优先调用服务器存储，localStorage 作为本地缓存
 */
import { hashPassword } from '../utils/hashing.js';
import makeLogger from '../utils/logger.js';

const log = makeLogger('Auth');

const API_BASE = 'https://api.meihuayili.com';
const CURRENT_USER_KEY = 'meihua_current_user';

function cacheCurrentUserLocally(currentUser) {
    const users = getRegisteredUsers();
    if (!users[currentUser.name]) {
        users[currentUser.name] = {
            name: currentUser.name,
            created: new Date().toISOString(),
        };
        saveRegisteredUsers(users);
    }
    persistCurrentUser(currentUser);
}

function persistCurrentUser(currentUser) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
}

function clearCurrentUserPersistence() {
    localStorage.removeItem(CURRENT_USER_KEY);
}

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
    name = name.trim().toLowerCase();
    const hp = hashPassword(password);

    // 优先服务器验证
    try {
        const resp = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            credentials: 'include',
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
            const currentUser = { name, hasEmail: !!data.user?.hasEmail };
            cacheCurrentUserLocally(currentUser);
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
        cacheCurrentUserLocally(currentUser);
        return currentUser;
    }
    return { error: '密码错误', code: 'WRONG_PASSWORD' };
}

export async function registerUser(name, password, email) {
    name = name.trim().toLowerCase();
    const hp = hashPassword(password);
    const cleanEmail = (email || '').trim().toLowerCase();

    // 优先在服务器注册
    try {
        const resp = await fetch(`${API_BASE}/api/register`, {
            method: 'POST',
            credentials: 'include',
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
            cacheCurrentUserLocally(currentUser);
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
    cacheCurrentUserLocally(currentUser);
    return currentUser;
}

export async function sendResetCode(name) {
    name = (name || '').trim().toLowerCase();
    const resp = await fetch(`${API_BASE}/api/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
    return resp.json();
}

export async function resetPassword(name, code, newPassword) {
    name = (name || '').trim().toLowerCase();
    const hp = hashPassword(newPassword);
    const resp = await fetch(`${API_BASE}/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code, newPasswordHash: hp }),
    });
    return resp.json();
}

export async function bindEmail(name, email) {
    const resp = await fetch(`${API_BASE}/api/bind-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
    });
    return resp.json();
}

export async function getAdminStats(adminName) {
    const resp = await fetch(`${API_BASE}/api/admin/stats?admin=${encodeURIComponent(adminName)}`);
    return resp.json();
}

export async function adminResetPassword(adminName, targetUser, newPassword) {
    const hp = hashPassword(newPassword);
    const resp = await fetch(`${API_BASE}/api/admin/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin: adminName, targetUser, newPasswordHash: hp }),
    });
    return resp.json();
}

export async function changePassword(name, oldPassword, newPassword) {
    const oldHash = hashPassword(oldPassword);
    const newHash = hashPassword(newPassword);
    const resp = await fetch(`${API_BASE}/api/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, oldPasswordHash: oldHash, newPasswordHash: newHash }),
    });
    return resp.json();
}

export function getCurrentUser() {
    try {
        const localUser = JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || 'null');
        if (localUser?.name) return localUser;
    } catch (e) {
        log.warn('Failed to parse current user from localStorage', e);
    }

    return null;
}

export async function hydrateRememberedUser() {
    const localUser = getCurrentUser();

    try {
        const resp = await fetch(`${API_BASE}/api/session/current`, {
            credentials: 'include',
        });
        const data = await resp.json().catch(() => null);
        if (resp.ok && data.success && data.user?.name) {
            const currentUser = { name: data.user.name, hasEmail: !!data.user.hasEmail };
            cacheCurrentUserLocally(currentUser);
            return currentUser;
        }

        if (resp.status === 401) {
            clearCurrentUserPersistence();
            return null;
        }
    } catch (e) {
        log.warn('服务器会话恢复失败', e);
    }

    return localUser?.name ? localUser : null;
}

export function logoutUser() {
    clearCurrentUserPersistence();
    fetch(`${API_BASE}/api/logout`, {
        method: 'POST',
        credentials: 'include',
    }).catch((e) => log.warn('服务器退出登录失败', e));
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
    
    // Pro 用户无限次
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
    
    // 免费注册用户每日3次（与游客一致）
    const maxQuota = 3;
    return Math.max(0, maxQuota - (userData.usedQuota || 0));
}

export function decreaseUserQuota() {
    const user = getCurrentUser();
    if (!user) return decreaseGuestQuota();
    
    // Pro 用户不扣额度
    if (hasProAccess()) return true;

    const users = getRegisteredUsers();
    const userData = users[user.name];
    if (!userData) return false;

    const today = new Date().toISOString().split('T')[0];
    if (userData.lastDivinationDate !== today) {
        userData.lastDivinationDate = today;
        userData.usedQuota = 0;
    }
    
    // 免费用户每日3次
    const maxQuota = 3;
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

// ===== 兑换码系统（商业化）=====

/**
 * 兑换码类型定义
 * M: 月度 Pro (Monthly)
 * Y: 年度 Pro (Yearly)  
 * L: 终身 Pro (Lifetime)
 */
const REDEEM_CODE_TYPES = {
    'M': { name: '月度 Pro', days: 30, price: '¥19.9' },
    'Y': { name: '年度 Pro', days: 365, price: '¥99' },
    'L': { name: '终身 Pro', days: 36500, price: '¥299' },
};

/**
 * 验证兑换码格式并解析
 * 格式: MHYL-{TYPE}-{CODE}
 * 示例: MHYL-M-A1B2-C3D4 (月度)
 *       MHYL-Y-X7Y8-Z9W0 (年度)
 *       MHYL-L-P1Q2-R3S4 (终身)
 */
function parseRedeemCode(code) {
    const trimmed = (code || '').trim().toUpperCase();
    const match = trimmed.match(/^MHYL-([MYL])-([A-Z0-9]{4})-([A-Z0-9]{4})$/);
    if (!match) return null;
    
    return {
        fullCode: trimmed,
        type: match[1],
        part1: match[2],
        part2: match[3],
        typeInfo: REDEEM_CODE_TYPES[match[1]],
    };
}

/**
 * 获取已使用的兑换码列表（防止重复使用）
 */
function getUsedRedeemCodes() {
    try {
        return JSON.parse(localStorage.getItem('meihua_used_redeem_codes') || '[]');
    } catch { return []; }
}

function addUsedRedeemCode(code) {
    const used = getUsedRedeemCodes();
    used.push(code);
    localStorage.setItem('meihua_used_redeem_codes', JSON.stringify(used));
}

/**
 * 兑换 Pro 会员
 */
export function redeemProCode(code) {
    const user = getCurrentUser();
    if (!user) return { error: '请先登录再兑换' };

    const parsed = parseRedeemCode(code);
    if (!parsed) return { error: '兑换码格式错误，正确格式：MHYL-M-XXXX-XXXX' };

    // 检查是否已被使用
    const usedCodes = getUsedRedeemCodes();
    if (usedCodes.includes(parsed.fullCode)) {
        return { error: '该兑换码已被使用' };
    }

    const users = getRegisteredUsers();
    const userData = users[user.name];
    if (!userData) return { error: '用户数据异常' };

    // 计算过期时间
    const now = Date.now();
    const existingExpiry = userData.proExpiry || 0;
    
    // 如果已有 Pro 且未过期，在原有基础上延长
    const baseTime = existingExpiry > now ? existingExpiry : now;
    const newExpiry = baseTime + (parsed.typeInfo.days * 24 * 60 * 60 * 1000);

    // 更新用户数据
    userData.proType = parsed.type; // M/Y/L
    userData.proExpiry = newExpiry;
    userData.proActivatedAt = now;
    
    // 标记兑换码为已使用
    addUsedRedeemCode(parsed.fullCode);
    saveRegisteredUsers(users);

    return { 
        success: true, 
        type: parsed.type,
        typeName: parsed.typeInfo.name,
        expiryDate: new Date(newExpiry).toLocaleDateString('zh-CN'),
    };
}

/**
 * 获取用户 Pro 状态详情
 */
export function getProStatus() {
    const user = getCurrentUser();
    if (!user) return { isPro: false, type: null, expiry: null };

    const users = getRegisteredUsers();
    const userData = users[user.name];
    if (!userData) return { isPro: false, type: null, expiry: null };

    // 管理员始终有 Pro
    const adminList = ['admin', 'gonghg'];
    if (adminList.includes(user.name)) {
        return { isPro: true, type: 'ADMIN', expiry: null, isLifetime: true };
    }

    const now = Date.now();
    const expiry = userData.proExpiry || 0;
    const isPro = expiry > now;
    const isLifetime = userData.proType === 'L';

    return {
        isPro,
        type: userData.proType,
        expiry: isPro ? new Date(expiry).toLocaleDateString('zh-CN') : null,
        isLifetime,
        daysLeft: isPro && !isLifetime ? Math.ceil((expiry - now) / (24 * 60 * 60 * 1000)) : null,
    };
}

/**
 * 检查是否有 Pro 权限（兼容旧代码）
 */
export function hasProAccess() {
    const status = getProStatus();
    return status.isPro;
}

/**
 * 获取 Pro 类型（用于区分不同层级）
 * 返回: 'free' | 'monthly' | 'yearly' | 'lifetime' | 'admin'
 */
export function getUserTier() {
    const status = getProStatus();
    if (!status.isPro) return 'free';
    if (status.type === 'ADMIN') return 'admin';
    if (status.type === 'M') return 'monthly';
    if (status.type === 'Y') return 'yearly';
    if (status.type === 'L') return 'lifetime';
    return 'free';
}

/**
 * 检查是否是终身 Pro（专业版功能）
 */
export function isLifetimePro() {
    const status = getProStatus();
    return status.isPro && status.isLifetime;
}

// ===== 旧版 VIP 码兼容（保留但标记为已弃用）=====
export function redeemVipCode(code) {
    return redeemProCode(code);
}

export function isVipUser() {
    return hasProAccess();
}