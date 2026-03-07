/**
 * Provider & Model Settings Storage
 */
export const PROVIDER_DEFAULTS = {
    deepseek: { endpoint: 'https://api.deepseek.com/chat/completions' },
    kimi: { endpoint: 'https://api.moonshot.cn/v1/chat/completions' },
    qwen: { endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions' },
    gemini: { endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions' },
    siliconflow: { endpoint: 'https://api.siliconflow.cn/v1/chat/completions' },
};

export const MODEL_REGISTRY = {
    'deepseek-combined': {
        provider: 'deepseek',
        model: 'deepseek-reasoner',
        label: 'DeepSeek R1 (官方)',
        supportsReasoning: true,
    },
    'sf-deepseek-r1': {
        provider: 'siliconflow',
        model: 'deepseek-ai/DeepSeek-R1',
        label: 'DeepSeek R1 (硅基流动)',
        supportsReasoning: true,
    },
    'sf-qwen3-5': {
        provider: 'siliconflow',
        model: 'Qwen/Qwen3.5-397B-A17B',
        label: 'Qwen 3.5 397B (硅基流动)',
        supportsReasoning: true,
    }
};

export function loadProviderConfigs() {
    try {
        const saved = localStorage.getItem('meihua_provider_configs');
        const configs = saved ? JSON.parse(saved) : {};

        // Ensure endpoint defaults exist (keys must be user-provided)
        if (!configs.deepseek?.endpoint) {
            configs.deepseek = { ...configs.deepseek, endpoint: PROVIDER_DEFAULTS.deepseek.endpoint };
        }
        if (!configs.siliconflow?.endpoint) {
            configs.siliconflow = { ...configs.siliconflow, endpoint: PROVIDER_DEFAULTS.siliconflow.endpoint };
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
