/**
 * AI API Client with Streaming Support
 * Features: timeout, auto-retry, streaming SSE parsing
 */
import makeLogger from '../utils/logger.js';

const log = makeLogger('AIClient');

const DEFAULT_TIMEOUT_MS = 180000; // 180s — enough for deep reasoning models
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

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
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify({
                model,
                messages,
                stream: true,
                max_tokens: 8192
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

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (let line of lines) {
                line = line.trim();
                if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') continue;

                    try {
                        const json = JSON.parse(data);
                        const delta = json.choices?.[0]?.delta;
                        if (delta) {
                            if (delta.reasoning_content) {
                                reasoningContent += delta.reasoning_content;
                                onChunk({ type: 'reasoning', content: delta.reasoning_content, fullReasoning: reasoningContent, fullContent: assistantContent });
                            }
                            if (delta.content) {
                                assistantContent += delta.content;
                                onChunk({ type: 'content', content: delta.content, fullContent: assistantContent, fullReasoning: reasoningContent });
                            }
                        }
                    } catch (e) {
                        // Skip invalid JSON
                    }
                }
            }
        }

        if (onFinish) {
            onFinish({ content: assistantContent, reasoning: reasoningContent });
        }
    } finally {
        clearTimeout(timeoutId);
    }
}
