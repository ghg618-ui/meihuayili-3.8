/**
 * Settings Controller - API settings modal UI logic
 */
import { $, showToast } from '../utils/dom.js';
import {
    loadProviderConfigs,
    saveProviderConfigs,
    PROVIDER_DEFAULTS
} from '../storage/settings.js';
import { closeModal } from '../ui/modals.js';

export function handleSaveSettings() {
    const configs = loadProviderConfigs();
    const dsKey = $('#settings-deepseek-key')?.value.trim();
    const dsEndpoint = $('#settings-deepseek-endpoint')?.value.trim();
    const sfKey = $('#settings-siliconflow-key')?.value.trim();
    const sfEndpoint = $('#settings-siliconflow-endpoint')?.value.trim();

    // Validate endpoint URLs to prevent SSRF
    const isValidEndpoint = (url) => {
        try {
            const u = new URL(url);
            return u.protocol === 'https:';
        } catch { return false; }
    };

    if (dsEndpoint && !isValidEndpoint(dsEndpoint)) {
        showToast('主线路服务地址必须是有效的 HTTPS 地址', 'error');
        return;
    }
    if (sfEndpoint && !isValidEndpoint(sfEndpoint)) {
        showToast('备用线路服务地址必须是有效的 HTTPS 地址', 'error');
        return;
    }

    if (dsKey) configs.deepseek = { ...configs.deepseek, key: dsKey };
    if (dsEndpoint) configs.deepseek = { ...configs.deepseek, endpoint: dsEndpoint };
    if (sfKey) configs.siliconflow = { ...configs.siliconflow, key: sfKey };
    if (sfEndpoint) configs.siliconflow = { ...configs.siliconflow, endpoint: sfEndpoint };

    // Warn if no key at all
    if (!dsKey && !sfKey && !configs.deepseek?.key && !configs.siliconflow?.key) {
        const warning = document.getElementById('settings-key-warning');
        if (warning) warning.style.display = 'block';
        showToast('请至少配置一个 API Key 后再保存', 'error');
        return;
    }

    saveProviderConfigs(configs);
    const warning = document.getElementById('settings-key-warning');
    if (warning) warning.style.display = 'none';
    closeModal('modal-settings');
    showToast('设置已保存', 'success');
}

export function loadSettingsToModal() {
    const configs = loadProviderConfigs();
    if (configs.deepseek) {
        const dsKeyEl = $('#settings-deepseek-key');
        const dsEndEl = $('#settings-deepseek-endpoint');
        if (dsKeyEl) dsKeyEl.value = configs.deepseek.key || '';
        if (dsEndEl) dsEndEl.value = configs.deepseek.endpoint || PROVIDER_DEFAULTS.deepseek.endpoint;
    }
    if (configs.siliconflow) {
        const sfKeyEl = $('#settings-siliconflow-key');
        const sfEndEl = $('#settings-siliconflow-endpoint');
        if (sfKeyEl) sfKeyEl.value = configs.siliconflow.key || '';
        if (sfEndEl) sfEndEl.value = configs.siliconflow.endpoint || PROVIDER_DEFAULTS.siliconflow.endpoint;
    }
}
