/**
 * AI API Client with Streaming Support
 * Features: timeout, auto-retry, streaming SSE parsing
 *
 * 代理模式：将 PROXY_BASE_URL 设为你的 Mac Mini 地址后，
 * 密钥不再经过浏览器，全程由服务器中转。
 */
import makeLogger from '../utils/logger.js';

const log = makeLogger('AIClient');

// ====== 代理服务器配置 ======
// 填入 Mac Mini 的 Cloudflare Tunnel 地址，例如：
//   'https://api.meihuayili.com'
// 留空 '' 则继续直连模式（密钥从浏览器发出）
const PROXY_BASE_URL = 'https://api.meihuayili.com';
// ============================

export const PROXY_ENDPOINT = PROXY_BASE_URL ? `${PROXY_BASE_URL.replace(/\/$/, '')}/api/chat` : null;
export const isProxyMode = !!PROXY_ENDPOINT;

const DEFAULT_TIMEOUT_MS = 180000; // 180s — enough for deep reasoning models
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;
const ANALYSIS_TEMPERATURE = 0.35;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchAIStream({
    endpoint,
    key,
    model,
    messages,
    onChunk,
    onFinish,
    onError,
    signal,
    timeout = DEFAULT_TIMEOUT_MS,
    maxRetries = MAX_RETRIES
}) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                await sleep(RETRY_DELAY_MS * attempt);
                onChunk?.({ type: 'status', content: `正在重试 (${attempt}/${maxRetries})...`, fullContent: '', fullReasoning: '' });
            }

            await _doStream({ endpoint, key, model, messages, onChunk, onFinish, signal, timeout });
            return; // Success
        } catch (error) {
            lastError = error;
            if (error.name === 'AbortError') {
                // Distinguish user-initiated abort from timeout
                if (signal?.aborted) {
                    log.info('Fetch aborted by user');
                    return; // User stop — silent exit, UI handled by stop button
                }
                // Timeout — report as error so user can retry/continue
                lastError = new Error('分析超时，请点击“继续”以接续未完成的内容');
                break;
            }
            // Don't retry on auth errors (401/403)
            if (error.message?.includes('401') || error.message?.includes('403')) break;
            // Don't retry if out of attempts
            if (attempt >= maxRetries) break;
        }
    }

    // All retries exhausted
    if (onError) onError(lastError);
    else throw lastError;
}

async function _doStream({ endpoint, key, model, messages, onChunk, onFinish, signal, timeout }) {
    // Create a timeout abort controller that chains with the user signal
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeout);

    // Combine user signal with timeout
    const combinedSignal = signal
        ? AbortSignal.any([signal, timeoutController.signal])
        : timeoutController.signal;

    try {
        const headers = {
            'Content-Type': 'application/json',
        };
        // Only add Authorization if key is present (direct mode, not proxy)
        if (key) {
            headers['Authorization'] = `Bearer ${key}`;
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model,
                messages,
                stream: true,
                max_tokens: 8192,
                temperature: ANALYSIS_TEMPERATURE,
            }),
            signal: combinedSignal
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new Error(`API 请求失败: ${response.status} ${response.statusText}${errText ? ' — ' + errText.slice(0, 200) : ''}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let assistantContent = '';
        let reasoningContent = '';

        const handleDataLine = (line) => {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) return;

            const data = trimmed.slice(5).trim();
            if (!data || data === '[DONE]') return;

            try {
                const json = JSON.parse(data);
                if (json.error?.message) {
                    throw new Error(json.error.message);
                }

                const choice = json.choices?.[0] || {};
                const delta = choice.delta || {};
                const reasoningDelta = delta.reasoning_content ?? delta.reasoning ?? '';
                const contentDelta = delta.content ?? '';

                if (reasoningDelta) {
                    reasoningContent += reasoningDelta;
                    onChunk?.({ type: 'reasoning', content: reasoningDelta, fullReasoning: reasoningContent, fullContent: assistantContent });
                }

                if (contentDelta) {
                    assistantContent += contentDelta;
                    onChunk?.({ type: 'content', content: contentDelta, fullContent: assistantContent, fullReasoning: reasoningContent });
                }

                // 兼容某些网关返回“非流式 JSON”但仍走了 stream 通道
                const msgContent = choice.message?.content;
                if (!assistantContent && typeof msgContent === 'string' && msgContent.trim()) {
                    assistantContent = msgContent;
                    onChunk?.({ type: 'content', content: msgContent, fullContent: assistantContent, fullReasoning: reasoningContent });
                }
            } catch (e) {
                // Skip invalid JSON line
            }
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                handleDataLine(line);
            }
        }

        // Handle the final buffered line (some gateways don't end with trailing newline)
        if (buffer.trim()) {
            handleDataLine(buffer);
        }

        if (onFinish) {
            onFinish({ content: assistantContent, reasoning: reasoningContent });
        }
    } finally {
        clearTimeout(timeoutId);
    }
}
