/**
 * Provider & Model Settings Storage
 */

// ⚗️ 运营密钥（临时方案）——在下方填入您的硬基流动 API Key
// 注意：前端代码可通过 F12 查看，请务必在硬基流动后台设置每日消费限额防止滥用
const _BUILTIN_KEY = '';  // 👈 硬基流动 sk-xxxx 密钥

// OpenRouter API Key（海外模型聚合平台）
const _OPENROUTER_KEY = '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';

export const PROVIDER_DEFAULTS = {
    deepseek: { endpoint: 'https://api.deepseek.com/chat/completions' },
    kimi: { endpoint: 'https://api.moonshot.cn/v1/chat/completions' },
    qwen: { endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions' },
    gemini: { endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions' },
    siliconflow: { endpoint: 'https://api.siliconflow.cn/v1/chat/completions' },
    // 海外大模型聚合平台
    openrouter: { endpoint: 'https://openrouter.ai/api/v1/chat/completions' },
};

export const MODEL_REGISTRY = {
    // 国内模型（免费用户 + Pro 用户）
    'deepseek-combined': {
        provider: 'deepseek',
        model: 'deepseek-reasoner',
        label: '推演引擎 · 主线',
        supportsReasoning: true,
    },
    'sf-deepseek-r1': {
        provider: 'siliconflow',
        model: 'deepseek-ai/DeepSeek-R1',
        label: '推演引擎 · 备线',
        supportsReasoning: true,
    },
    'sf-qwen3-5': {
        provider: 'siliconflow',
        model: 'Qwen/Qwen3.5-397B-A17B',
        label: '推演引擎 · 增强',
        supportsReasoning: true,
    },
    
    // 海外模型（Pro 高级用户专属，通过 OpenRouter）
    'or-claude-35-sonnet': {
        provider: 'openrouter',
        model: 'anthropic/claude-3.5-sonnet',
        label: '推演引擎 · Claude',
        supportsReasoning: true,
        proOnly: true,  // Pro 专属
    },
    'or-gpt-4o': {
        provider: 'openrouter',
        model: 'openai/gpt-4o',
        label: '推演引擎 · GPT-4o',
        supportsReasoning: true,
        proOnly: true,
    },
    'or-gemini-2-flash': {
        provider: 'openrouter',
        model: 'google/gemini-2.0-flash-001',
        label: '推演引擎 · Gemini',
        supportsReasoning: true,
        proOnly: true,
    },
};

export function loadProviderConfigs() {
    try {
        const saved = localStorage.getItem('meihua_provider_configs');
        const configs = saved ? JSON.parse(saved) : {};

        // Ensure endpoint defaults exist
        if (!configs.deepseek?.endpoint) {
            configs.deepseek = { ...configs.deepseek, endpoint: PROVIDER_DEFAULTS.deepseek.endpoint };
        }
        if (!configs.siliconflow?.endpoint) {
            configs.siliconflow = { ...configs.siliconflow, endpoint: PROVIDER_DEFAULTS.siliconflow.endpoint };
        }

        // 如果用户未自行配置 siliconflow key，使用内置运营密钥
        if (!configs.siliconflow?.key && _BUILTIN_KEY) {
            configs.siliconflow = { ...configs.siliconflow, key: _BUILTIN_KEY };
        }
        
        // OpenRouter 默认配置（海外模型）
        if (!configs.openrouter?.endpoint) {
            configs.openrouter = { ...configs.openrouter, endpoint: PROVIDER_DEFAULTS.openrouter.endpoint };
        }
        if (!configs.openrouter?.key && _OPENROUTER_KEY) {
            configs.openrouter = { ...configs.openrouter, key: _OPENROUTER_KEY };
        }

        return configs;
    } catch (e) {
        return {};
    }
}

/**
 * Check if any provider has a valid API key configured
 */
export function hasAnyApiKey() {
    if (_BUILTIN_KEY) return true; // 有内置密钥时始终可用
    const configs = loadProviderConfigs();
    return Object.values(configs).some(c => c?.key && c.key.trim().length > 0);
}

export function saveProviderConfigs(configs) {
    localStorage.setItem('meihua_provider_configs', JSON.stringify(configs));
}

export function getSelectedModel() {
    const saved = localStorage.getItem('selected_model');
    if (saved && MODEL_REGISTRY[saved]) {
        return saved;
    }
    return 'deepseek-combined';
}

export function setSelectedModel(modelKey) {
    localStorage.setItem('selected_model', modelKey);
}
