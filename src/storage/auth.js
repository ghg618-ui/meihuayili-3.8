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
