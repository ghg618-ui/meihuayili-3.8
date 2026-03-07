import {
    loadProviderConfigs,
    saveProviderConfigs,
    hasAnyApiKey,
    getSelectedModel,
    setSelectedModel,
    MODEL_REGISTRY,
    PROVIDER_DEFAULTS
} from '../src/storage/settings.js';
import {
    registerUser,
    loginUser,
    getCurrentUser,
    logoutUser,
    getRegisteredUsers
} from '../src/storage/auth.js';
import {
    loadHistory,
    addHistoryRecord,
    deleteHistoryRecord,
    getUserHistoryKey
} from '../src/storage/history.js';

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: jest.fn(key => store[key] ?? null),
        setItem: jest.fn((key, value) => { store[key] = String(value); }),
        removeItem: jest.fn(key => { delete store[key]; }),
        clear: jest.fn(() => { store = {}; }),
        get _store() { return store; }
    };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
});

describe('Settings', () => {
    test('loadProviderConfigs should return empty object by default', () => {
        const configs = loadProviderConfigs();
        expect(configs).toBeDefined();
        // Should have default endpoints even with no saved data
        expect(configs.deepseek?.endpoint).toBe(PROVIDER_DEFAULTS.deepseek.endpoint);
        expect(configs.siliconflow?.endpoint).toBe(PROVIDER_DEFAULTS.siliconflow.endpoint);
    });

    test('loadProviderConfigs should NOT return hardcoded API keys', () => {
        const configs = loadProviderConfigs();
        // Verify no keys are returned without user configuration
        expect(configs.deepseek?.key).toBeUndefined();
        expect(configs.siliconflow?.key).toBeUndefined();
    });

    test('saveProviderConfigs should persist to localStorage', () => {
        const configs = { deepseek: { key: 'test-key', endpoint: 'https://test.com' } };
        saveProviderConfigs(configs);
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'meihua_provider_configs',
            JSON.stringify(configs)
        );
    });

    test('hasAnyApiKey should return false when no keys configured', () => {
        expect(hasAnyApiKey()).toBe(false);
    });

    test('hasAnyApiKey should return true after key is saved', () => {
        saveProviderConfigs({ deepseek: { key: 'sk-test123', endpoint: 'https://api.deepseek.com' } });
        expect(hasAnyApiKey()).toBe(true);
    });

    test('MODEL_REGISTRY should have expected models', () => {
        expect(MODEL_REGISTRY['deepseek-combined']).toBeDefined();
        expect(MODEL_REGISTRY['deepseek-combined'].provider).toBe('deepseek');
    });

    test('getSelectedModel should return default when nothing saved', () => {
        expect(getSelectedModel()).toBe('deepseek-combined');
    });

    test('setSelectedModel should persist selection', () => {
        setSelectedModel('sf-deepseek-r1');
        expect(getSelectedModel()).toBe('sf-deepseek-r1');
    });
});

describe('Auth', () => {
    test('registerUser should create new user', () => {
        const user = registerUser('testuser', 'password123');
        expect(user).toBeDefined();
        expect(user.name).toBe('testuser');
        expect(user.error).toBeUndefined();
    });

    test('registerUser should reject duplicate username', () => {
        registerUser('testuser', 'pass1');
        const dup = registerUser('testuser', 'pass2');
        expect(dup.error).toBe('用户已存在');
    });

    test('loginUser should authenticate valid credentials', () => {
        registerUser('john', 'secret');
        const user = loginUser('john', 'secret');
        expect(user).toBeDefined();
        expect(user.name).toBe('john');
    });

    test('loginUser should fail with wrong password', () => {
        registerUser('john', 'secret');
        const user = loginUser('john', 'wrongpass');
        expect(user).toBeNull();
    });

    test('loginUser should fail with non-existent user', () => {
        const user = loginUser('ghost', 'any');
        expect(user).toBeNull();
    });

    test('getCurrentUser should return null when not logged in', () => {
        expect(getCurrentUser()).toBeNull();
    });

    test('getCurrentUser should return user after login', () => {
        registerUser('alice', 'pass');
        loginUser('alice', 'pass');
        const current = getCurrentUser();
        expect(current).toBeDefined();
        expect(current.name).toBe('alice');
    });

    test('logoutUser should clear current user', () => {
        registerUser('bob', 'pass');
        loginUser('bob', 'pass');
        logoutUser();
        expect(getCurrentUser()).toBeNull();
    });
});

describe('History', () => {
    test('getUserHistoryKey should return null for falsy userName', () => {
        expect(getUserHistoryKey(null)).toBeNull();
        expect(getUserHistoryKey('')).toBeNull();
    });

    test('getUserHistoryKey should return key for valid userName', () => {
        expect(getUserHistoryKey('alice')).toBe('meihua_history_alice');
    });

    test('loadHistory should return empty array when no history', () => {
        expect(loadHistory('alice')).toEqual([]);
    });

    test('addHistoryRecord should add and return updated history', () => {
        const record = { id: 1, question: 'test', timestamp: '2026-01-01' };
        const history = addHistoryRecord('alice', record);
        expect(history).toHaveLength(1);
        expect(history[0].question).toBe('test');
    });

    test('addHistoryRecord should prepend new records', () => {
        addHistoryRecord('alice', { id: 1, question: 'first' });
        const history = addHistoryRecord('alice', { id: 2, question: 'second' });
        expect(history[0].question).toBe('second');
        expect(history[1].question).toBe('first');
    });

    test('addHistoryRecord should limit to 100 records', () => {
        for (let i = 0; i < 105; i++) {
            addHistoryRecord('alice', { id: i, question: `q${i}` });
        }
        const history = loadHistory('alice');
        expect(history.length).toBeLessThanOrEqual(100);
    });

    test('deleteHistoryRecord should remove specific record', () => {
        addHistoryRecord('alice', { id: 1, question: 'keep' });
        addHistoryRecord('alice', { id: 2, question: 'remove' });
        const history = deleteHistoryRecord('alice', 2);
        expect(history).toHaveLength(1);
        expect(history[0].id).toBe(1);
    });
});
