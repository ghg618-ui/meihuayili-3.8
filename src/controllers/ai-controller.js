/**
 * AI Controller - AI analysis, streaming, system prompts
 */
import { $, showToast, escapeHtml } from '../utils/dom.js';
import { loadProviderConfigs, MODEL_REGISTRY } from '../storage/settings.js';
import { loadHistory, addHistoryRecord, loadFeedback } from '../storage/history.js';
import { addMessage, scrollChat, wrapDualLayout } from '../ui/chat-view.js';
import { fetchAIStream, isProxyMode, PROXY_ENDPOINT } from '../api/ai-client.js';
import { formatMarkdown } from '../utils/formatter.js';
import { openModal } from '../ui/modals.js';
import { hasProAccess } from '../storage/auth.js';
import DivinationEngine from '../core/divination-engine.js';
import state from './state.js';
import { loadSettingsToModal } from './settings-controller.js';
import makeLogger from '../utils/logger.js';

const log = makeLogger('AI');

export async function performAIAnalysis(question, renderHistory) {
    try {
        // 检查是否已经起卦
        if (!state.currentResult) {
            showToast('请先起卦再进行分析', 'error');
            return;
        }
        
        // 自动检测用户权限并设置分析模式
        if (hasProAccess()) {
            state.selectedMode = 'pro';  // 管理员/付费用户自动使用专业版
        } else {
            state.selectedMode = 'simple';  // 普通用户使用简化版
        }
        
        const configs = loadProviderConfigs();
        const modelInfo = MODEL_REGISTRY[state.selectedModelKey];

        // Fallback/Legacy check
        let config = configs[modelInfo.provider];
        if (!config || !config.key) {
            if (modelInfo.provider === 'siliconflow' && configs.siliconflow) {
                config = configs.siliconflow;
            } else if (modelInfo.provider === 'deepseek' && configs.deepseek) {
                config = configs.deepseek;
            }
        }

        if (!isProxyMode && (!config || !config.key)) {
            showToast(`请在设置中配置 ${modelInfo.label} 的 API Key`, 'error');
            loadSettingsToModal();
            openModal('modal-settings');
            return;
        }

        const payload = DivinationEngine.buildPayload(state.currentResult, question, state.selectedMode);
        const feedback = state.currentUser ? loadFeedback(state.currentUser.name) : [];
        const hasFeedbackLearning = feedback.some(f => f.rating === 'off' || f.rating === 'partial' || f.correction);
        const systemPrompt = buildSystemPrompt(state.selectedMode, feedback);

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(payload) }
        ];

        // Capture original model at start time (user may switch during streaming)
        const startModelKey = state.selectedModelKey;

        // Only clear lastAnalysisCtx if no pending comparison is waiting for it
        if (!state.pendingModelComparison) {
            state.lastAnalysisCtx = null;
        }

        const msgEl = addMessage($('#chat-messages'), {
            role: 'assistant',
            content: hasFeedbackLearning ? '<span class="feedback-learning-badge">📚 已载入学习库</span>' : '',
            modelLabel: modelInfo.label
        });
        const targetEl = msgEl.querySelector('.msg-content');

        await _runStream({
            config, modelInfo, messages, targetEl, question, renderHistory,
            onComplete: () => {
                state.lastAnalysisCtx = { msgEl, modelKey: startModelKey, question };
            }
        });
    } catch (err) {
        log.error('performAIAnalysis failed:', err);
        showToast(`解析失败: ${err.message}`, 'error');
    }
}

export async function performComparisonAnalysis(renderHistory) {
    const ctx = state.lastAnalysisCtx;
    if (!ctx) return;

    const newModelKey = state.selectedModelKey;
    const modelChanged = newModelKey !== ctx.modelKey;

    if (!modelChanged) return;

    // Resolve API config for the new model
    const configs = loadProviderConfigs();
    const modelInfo = MODEL_REGISTRY[newModelKey];
    let config = configs[modelInfo.provider];
    if (!config || !config.key) {
        if (modelInfo.provider === 'siliconflow' && configs.siliconflow) config = configs.siliconflow;
        else if (modelInfo.provider === 'deepseek' && configs.deepseek) config = configs.deepseek;
    }
    if (!isProxyMode && (!config || !config.key)) {
        showToast(`请在设置中配置 ${modelInfo.label} 的 API Key`, 'error');
        return;
    }

    // Build labels for model comparison
    const oldModelInfo = MODEL_REGISTRY[ctx.modelKey];
    const oldLabel = oldModelInfo ? oldModelInfo.label : ctx.modelKey;
    const newLabel = modelInfo.label;

    // Restructure single message → dual layout
    const { targetEl } = wrapDualLayout(ctx.msgEl, oldLabel, newLabel);

    // Build new messages
    const payload = DivinationEngine.buildPayload(state.currentResult, ctx.question, state.selectedMode);
    const feedback = state.currentUser ? loadFeedback(state.currentUser.name) : [];
    const systemPrompt = buildSystemPrompt(state.selectedMode, feedback);
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(payload) }
    ];

    state.lastAnalysisCtx = null; // Consumed — no further comparison

    try {
        await _runStream({ config, modelInfo, messages, targetEl, question: ctx.question, renderHistory });
    } catch (err) {
        log.error('performComparisonAnalysis failed:', err);
        showToast(`对比分析失败: ${err.message}`, 'error');
    }
}

export async function continueAIAnalysis() {
    const ctx = state.interruptedCtx;
    if (!ctx) {
        showToast('没有可继续的分析', 'error');
        return;
    }
    try {
        const configs = loadProviderConfigs();
        const modelInfo = MODEL_REGISTRY[state.selectedModelKey];
        let config = configs[modelInfo.provider];
        if (!config || !config.key) {
            if (modelInfo.provider === 'siliconflow' && configs.siliconflow) config = configs.siliconflow;
            else if (modelInfo.provider === 'deepseek' && configs.deepseek) config = configs.deepseek;
        }
        if (!isProxyMode && (!config || !config.key)) {
            showToast(`请在设置中配置 ${modelInfo.label} 的 API Key`, 'error');
            return;
        }

        // Build continuation messages: original messages + partial assistant reply + continue instruction
        const messages = [...ctx.messages];
        if (ctx.partialContent) {
            messages.push({ role: 'assistant', content: ctx.partialContent });
            messages.push({ role: 'user', content: '请从中断处继续，不要重复已输出的内容。' });
        }

        await _runStream({
            config, modelInfo, messages,
            targetEl: ctx.targetEl,
            question: ctx.question,
            renderHistory: ctx.renderHistory,
            prefixContent: ctx.partialContent || '',
            prefixReasoning: ctx.partialReasoning || ''
        });
    } catch (err) {
        log.error('continueAIAnalysis failed:', err);
        showToast(`继续分析失败: ${err.message}`, 'error');
    }
}

async function _runStream({ config, modelInfo, messages, targetEl, question, renderHistory, prefixContent = '', prefixReasoning = '', onComplete }) {
    // Stop any lingering thinking-progress timer from a previously aborted stream
    state.stopCurrentThinkingProgress?.();

    if (state.currentAbortController) state.currentAbortController.abort();
    state.currentAbortController = new AbortController();

    $('#chat-status').textContent = `${modelInfo.label} 思考中...`;
    $('#btn-stop-generate')?.classList.remove('hidden');
    $('#btn-continue-generate')?.classList.add('hidden');
    $('#chat-input-area').classList.add('hidden');

    // If continuing, clear leftover thinking UI so it re-initialises cleanly
    if (targetEl.querySelector('.thinking-status')) {
        targetEl.innerHTML = '';
    }

    // Save context for potential continuation
    state.interruptedCtx = { targetEl, messages, mode: state.selectedMode, partialContent: prefixContent, partialReasoning: prefixReasoning, question, renderHistory };
        let thinkingPhase = true;
        let thinkingTimer = null;
        let thinkingProgress = 0;
        const thinkingStartTime = Date.now();
        let hasReceivedAnyChunk = false;
        let stalledHintTimer = null;

        // Render progress UI immediately so users can see the request is running,
        // even before the first model chunk arrives.
        targetEl.innerHTML = `
            <div class="thinking-status">
                <span class="thinking-indicator"></span>
                <span class="thinking-text">正在深度参悟卦象中<span class="thinking-dots"></span></span>
                <span class="thinking-pct">0%</span>
            </div>
            <div class="thinking-progress-bar">
                <div class="thinking-progress-fill"></div>
            </div>`;

        // Simulated progress: fast at start, slows down approaching 90%, never reaches 100% until content arrives
        function startThinkingProgress() {
            thinkingTimer = setInterval(() => {
                const elapsed = (Date.now() - thinkingStartTime) / 1000; // seconds
                // Logarithmic curve: quick to 60%, slow to 90%, crawls after
                thinkingProgress = Math.min(92, 30 * Math.log10(elapsed + 1) + elapsed * 0.8);
                const bar = targetEl.querySelector('.thinking-progress-fill');
                const pct = targetEl.querySelector('.thinking-pct');
                if (bar) bar.style.width = thinkingProgress.toFixed(1) + '%';
                if (pct) pct.textContent = Math.floor(thinkingProgress) + '%';
                // Update dots
                const dotsEl = targetEl.querySelector('.thinking-dots');
                if (dotsEl) {
                    const dotFrames = ['', '.', '..', '...'];
                    dotsEl.textContent = dotFrames[Math.floor(Date.now() / 500) % 4];
                }
            }, 200);
        }

        function stopThinkingProgress() {
            if (thinkingTimer) { clearInterval(thinkingTimer); thinkingTimer = null; }
            state.stopCurrentThinkingProgress = null;
        }

        // Expose so the stop button can kill the timer even on user-abort (silent path)
        state.stopCurrentThinkingProgress = stopThinkingProgress;

        // If backend has no first chunk for a while, show an explicit hint.
        stalledHintTimer = setTimeout(() => {
            if (!hasReceivedAnyChunk) {
                const note = targetEl.querySelector('.thinking-text');
                if (note) {
                    note.innerHTML = '服务器响应较慢，正在重试通道<span class="thinking-dots"></span>';
                }
            }
        }, 12000);

        startThinkingProgress();

        // Route to proxy if available, else direct
        const apiEndpoint = isProxyMode ? PROXY_ENDPOINT : config.endpoint;
        const apiKey = isProxyMode ? '' : config.key;

        await fetchAIStream({
        endpoint: apiEndpoint,
        key: apiKey,
        model: modelInfo.model,
        messages,
        signal: state.currentAbortController.signal,
        onChunk: ({ type, fullContent, fullReasoning }) => {
            hasReceivedAnyChunk = true;
            if (stalledHintTimer) {
                clearTimeout(stalledHintTimer);
                stalledHintTimer = null;
            }
            const totalContent = prefixContent + fullContent;
            const totalReasoning = prefixReasoning + fullReasoning;

            // Update interrupted context with latest partial state
            if (state.interruptedCtx) {
                state.interruptedCtx.partialContent = totalContent;
                state.interruptedCtx.partialReasoning = totalReasoning;
            }

            if (totalReasoning && !totalContent) {
                // Thinking phase: preserve DOM to keep animations alive
                // Keep the already-rendered thinking UI alive until content starts.
                if (thinkingPhase) {
                    const existing = targetEl.querySelector('.thinking-status');
                    if (!existing) {
                        targetEl.innerHTML = `
                            <div class="thinking-status">
                                <span class="thinking-indicator"></span>
                                <span class="thinking-text">正在深度参悟卦象中<span class="thinking-dots"></span></span>
                                <span class="thinking-pct">0%</span>
                            </div>
                            <div class="thinking-progress-bar">
                                <div class="thinking-progress-fill"></div>
                            </div>`;
                        startThinkingProgress();
                    }
                }
            } else {
                // Content has started — complete progress and exit thinking phase
                if (thinkingPhase) {
                    thinkingPhase = false;
                    stopThinkingProgress();
                    // Flash to 100%
                    const bar = targetEl.querySelector('.thinking-progress-fill');
                    const pct = targetEl.querySelector('.thinking-pct');
                    if (bar) bar.style.width = '100%';
                    if (pct) pct.textContent = '100%';
                }

                let html = '';
                if (totalReasoning && totalContent) {
                    html += `<details class="thinking-block"><summary>💭 已完成深度分析</summary><pre>${escapeHtml(totalReasoning)}</pre></details>`;
                }
                if (totalContent) {
                    html += formatMarkdown(totalContent);
                } else if (!totalReasoning) {
                    html += '<div class="loading-dots"><span></span><span></span><span></span></div>';
                }
                targetEl.innerHTML = html;
            }

            scrollChat($('#chat-messages'));
        },
        onFinish: ({ content, reasoning }) => {
            if (stalledHintTimer) {
                clearTimeout(stalledHintTimer);
                stalledHintTimer = null;
            }
            stopThinkingProgress();
            const totalContent = prefixContent + content;
            const totalReasoning = prefixReasoning + reasoning;

            $('#chat-status').textContent = '就绪';
            $('#btn-stop-generate')?.classList.add('hidden');
            $('#chat-input-area').classList.remove('hidden');
            state.interruptedCtx = null; // Clear — analysis complete

            if (totalContent) {
                let finalHtml = '';
                if (totalReasoning) finalHtml += `<details class="thinking-block"><summary>💭 深度推演逻辑</summary><pre>${escapeHtml(totalReasoning)}</pre></details>`;
                finalHtml += formatMarkdown(totalContent);
                targetEl.innerHTML = finalHtml;
            }

            // Restore feedback button (streaming overwrites it)
            const parentMsg = targetEl.closest('.chat-message');
            if (parentMsg) {
                const fbHtml = `<div class="msg-feedback-actions">
                    <button class="btn-feedback icon-btn" onclick="window.openFeedbackModal('${parentMsg.id}')" title="提供卦例反馈">
                        <span class="fb-icon" style="font-size:1.1rem">📋</span> 卦例点评
                    </button>
                </div>`;
                targetEl.insertAdjacentHTML('beforeend', fbHtml);
            }

            scrollChat($('#chat-messages'), true);

            const analysis = {
                modelKey: state.selectedModelKey,
                modelLabel: modelInfo.label,
                content: totalContent,
                reasoning: totalReasoning,
                timestamp: new Date().toISOString()
            };
            state.modelAnalyses.push(analysis);

            // Auto-save
            let saveDone = false;
            try {
                if (state.currentUser) {
                    const record = {
                        id: state.lastRecordId || Date.now(),
                        timestamp: new Date().toLocaleString(),
                        result: state.currentResult ? JSON.parse(JSON.stringify(state.currentResult)) : null,
                        question: $('#input-chat')?.value?.trim() || question,
                        analyses: [...state.modelAnalyses],
                        analysis: totalContent,
                        reasoning: totalReasoning
                    };

                    if (!state.lastRecordId) {
                        state.lastRecordId = record.id;
                        addHistoryRecord(state.currentUser.name, record);
                    } else {
                        const history = loadHistory(state.currentUser.name);
                        const idx = history.findIndex(h => String(h.id) === String(state.lastRecordId));
                        if (idx !== -1) {
                            history[idx] = { ...history[idx], ...record };
                            try {
                                localStorage.setItem(`meihua_history_${state.currentUser.name}`, JSON.stringify(history));
                            } catch (quotaErr) {
                                if (history.length > 5) {
                                    history.splice(5);
                                    localStorage.setItem(`meihua_history_${state.currentUser.name}`, JSON.stringify(history));
                                    log.warn('Storage near full, trimmed old records');
                                } else {
                                    throw quotaErr;
                                }
                            }
                        }
                    }
                    saveDone = true;
                }
            } catch (saveErr) {
                log.error('Auto-save failed:', saveErr.name, saveErr.message, saveErr.stack);
                if (saveErr.name === 'QuotaExceededError' || saveErr.code === 22) {
                    showToast('存储空间不足，请清理旧卦例后重试', 'error');
                } else {
                    showToast('分析完成，但保存失败', 'error');
                }
            }

            // Refresh history UI (separated from save to prevent render errors masking save success)
            if (saveDone) {
                try {
                    state.history = loadHistory(state.currentUser.name);
                    renderHistory();
                    // Auto-expand history list so user sees the new record
                    const histList = $('#history-list');
                    const histHint = $('#history-hint');
                    if (histList?.classList.contains('collapsed')) {
                        histList.classList.remove('collapsed');
                        if (histHint) histHint.classList.add('hidden');
                    }
                    showToast('分析结果已存入卦例馆', 'success');
                } catch (renderErr) {
                    log.warn('History render failed after save:', renderErr.message);
                    showToast('分析结果已保存', 'success');
                }
            }

            if (onComplete) onComplete();

            // If model was switched during analysis, auto-trigger comparison
            if (state.pendingModelComparison && state.lastAnalysisCtx) {
                state.pendingModelComparison = false;
                if (state.lastAnalysisCtx.modelKey !== state.selectedModelKey) {
                    performComparisonAnalysis(renderHistory);
                }
            }
        },
        onError: (err) => {
            if (stalledHintTimer) {
                clearTimeout(stalledHintTimer);
                stalledHintTimer = null;
            }
            stopThinkingProgress();
            $('#chat-status').textContent = '错误';
            $('#btn-stop-generate')?.classList.add('hidden');
            $('#btn-continue-generate')?.classList.remove('hidden');
            $('#chat-input-area').classList.remove('hidden');

            const safeMsg = escapeHtml(err.message || '未知错误');
            const errorHtml = `
                <div class="error-msg" style="color: var(--status-critical); background: rgba(255,0,0,0.05); padding: 15px; border-radius: 12px; border: 1px solid rgba(255,0,0,0.1); margin-top: 10px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 1rem;">❌ 解析中断 (${safeMsg.includes('503') ? '解析服务器繁忙' : '接口调用异常'})</h4>
                    <p style="margin: 0; font-size: 0.85rem; line-height: 1.5; color: var(--text-secondary);">
                        原因可能是：${safeMsg}<br>
                        建议：请检查 [设置] 中的 API Key 是否正确，或尝试更换其他模型线路。
                    </p>
                </div>
            `;
            targetEl.innerHTML += errorHtml;
            scrollChat($('#chat-messages'), true);
            showToast(`解析出错: ${err.message}`, 'error');
        }
    });
}

export function buildSystemPrompt(mode = 'simple', feedbackRecords = []) {
    // ═══════════════════════════════════════════════════════
    // 共享分析内核：无论简化版/专业版，断卦逻辑完全一致
    // ═══════════════════════════════════════════════════════
    const coreLogic = `你是一位精通《周易》的易学大师——"高维主体的战略决策导师"。你掌握了一套融合张延生结构学、高岛义理学与传统五行旺衰法的高级断卦体系。

【角色核心视角】
"主体本位"——不侧重单纯算"客观事情的成败"，而是推演"主体在特定时空下，该用何种能量与姿态去回应世界，从而主导事物走向"。

【核心指令】
1. 月令（节气月）是五行能量的最高仲裁者，必须强制引入。
2. 强制执行"事理双轨并行制"：将现实成败与高维吉凶剥离判定。
3. 输出遵循"结论先行"原则。

————————————
一、根基法则：结构与能量场

* 八卦五行：乾兑属金，震巽属木，坎属水，离属火，坤艮属土。
* 五行生克：生（金生水，水生木，木生火，火生土，土生金）；克（金克木，木克土，土克水，水克火，火克金）。
* 对卦生成算法：必须将【变卦】六个爻位的阴阳属性逐一反转，由此组合而成的新六爻卦象即为【对卦】（即传统错卦，全流程统一称"对卦"）。

1. 体用定性——【动为体，静为用】
   含有动爻的经卦为"体"（主体/我）；不含动爻的经卦为"用"（客体/环境/事）。位置锁定后全流程贯穿不变。

2. 时间切片——【ZYS 三维时空观】
   本卦（缘起/动机体检）→ 变卦（过程/客观态势演变）→ 对卦（终局/最终能量平衡态）。

3. 月令能量校准与修正铁律
   第一步：获取月令。将起卦日期转换为干支历，以"节气"为界定出当前月令。
   第二步：判定旺衰。依据月令五行给三卦的体用打分：
   - 旺（同月令）：能量极强，吉凶成倍。
   - 相（月令生）：能量强，有后劲。
   - 休（生月令）、囚（克月令）、死（被月令克）：能量微弱，有心无力。
   第三步：系统修正铁律（⚠️ 铁律总纲：修正只改变吉凶的烈度与质感，绝不改变成/败的基本方向）：
   - 用生体本吉，但用休囚死 = 虚情假意，口头支票。（吉→轻吉，事仍可成但依赖力有限）
   - 体克用本吉，但体休囚死 = 有心无力，驾驭不了。（吉→轻吉或持平）
   - 体用比和本吉，但用休囚死 = 空有好心，自身虚弱帮不上。（吉→轻吉）
   - 体生用本凶，但体旺 = 我有余力施舍，虽耗无妨。（凶→轻凶，仍有消耗但可承受）
   - 用克体本凶，但用休囚死或体旺 = 有惊无险。（凶→轻凶）
     ⚠️【关键区分】"有惊无险"专指：主体不受严重实质损害、安全撤出或损失有限。但事件所求目标（如赚钱、合作成功）在现实层仍判"败"——此修正不让事情"成功"，只让主体"不受大伤"。绝对禁止将"有惊无险"误解为"事情有阻力但能成功"。

————————————
二、灵魂法则：事理双轨并行制（核心高维断法）

将"物质世界的客观成败"与"事件对主体的长远高维意义"彻底剥离。

▶ 轨一·现实层（事相成败）——强制执行三段式动态推演，以"对卦"定终局：
  - 开端（看本卦）：评估现实基本盘。主体初始能量是否具备启动条件？
  - 过程（看变卦）：评估推进阻力/助力。环境发生了什么变化？主体被克制消耗还是得到生扶？
  - 终局定性（看对卦——现实成败的唯一裁判）：客观现实最终能不能成，完全取决于对卦的体用生克与旺衰结果。各关系成败映射如下：
    * 用克体（无论旺衰）→ 现实层一律判"败"；区别仅是败的轻重：用旺体衰=重败受损，用囚/死或体旺=轻败有惊无险（主体安全但赚钱/合作目标仍难达成）。
    * 体克用 → 现实层判"成"（主体主导事态）。
    * 用生体 → 现实层判"成"（外部助力助推目标）；但用休囚死时降为轻成。
    * 体生用 → 现实层判"凶"（主体付出难有回报）；体旺时降为轻凶可承受。
    * 比和 → 现实层持平或轻成，视旺衰而定。
    ⚠️ 禁止：因"体旺"或"用囚"就把"用克体"的终局升格为"成"或"有阻力但能成"——用克体哪怕修正后仍判"败"，只是主体不受大伤而已。

▶ 轨二·高维层（道相吉凶）——卦辞定底色 + 爻辞定方略：
  1. 宏观底座（本卦卦辞）：提取卦辞定调整个事件的大背景/大前提——扩张、收敛、蛰伏还是突破？
  2. 微观指针（动爻爻辞）：在卦辞大背景下，解读动爻爻辞，指明主体当前最优战术动作与因果定性。
  注意：绝对禁止脱离卦辞单独解释爻辞。天道定性是卦辞大势与爻辞微观动作的综合共振结果。

【四大双轨矩阵判定法】
横轴（事相成败）取自对卦推演；纵轴（高维吉凶）取自卦辞+爻辞综合义理：
- 第一象限【大胜】：现实成（对卦吉）＋天道顺（卦爻同吉）→ 名正言顺，大胆推进。
- 第二象限【大败】：现实败（对卦凶）＋天道逆（卦爻同凶）→ 全盘皆输，立刻止损。
- 第三象限【假胜】：现实成（对卦吉）＋天道逆（卦爻藏凶）→ 饮鸩止渴，必埋隐患。
- 第四象限【挡灾】：现实败（对卦凶）＋天道顺（卦爻定吉）→ 塞翁失马，用现实挫折挡住未来大祸。

【矩阵术语输出铁律】
"大胜/大败/假胜/挡灾"仅作内部逻辑判断依据，对用户输出时绝不可直接使用这些标签。必须结合用户所问的具体事项，将象限含义转化为贴合语境的解读。`;

    // ═══════════════════════════════════════════════════════
    // 反馈学习注入：基于历史案例自我迭代
    // ═══════════════════════════════════════════════════════
    let learningBlock = '';
    const relevantFeedback = feedbackRecords.filter(f => f.rating === 'off' || f.rating === 'partial' || f.correction);
    if (relevantFeedback.length > 0) {
        const cases = relevantFeedback.slice(0, 5).map((f, i) => {
            const parts = [`案例${i + 1}`];
            if (f.hexagramName) parts.push(`卦象: ${f.hexagramName}`);
            const ratingMap = { accurate: '神准', partial: '基本准确', helpful: '有启发', off: '偏离现实' };
            if (f.rating) parts.push(`用户评价: ${ratingMap[f.rating] || f.rating}`);
            if (f.actualOutcome) parts.push(`实际结果: "${f.actualOutcome}"`);
            if (f.correction) parts.push(`偏差指正: "${f.correction}"`);
            return parts.join('，');
        }).join('\n');

        learningBlock = `

————————————
【⚠️ 历史案例反馈校准库】
以下是该用户对过去推演结果的真实反馈。请在本次推演中主动参考这些历史教训，避免重复类似偏差：
${cases}
请在分析中有意识地校正上述偏差模式，提高推演精度。`;
    }

    // 根据用户权限选择输出格式
    if (mode === 'simple') {
        return coreLogic + learningBlock + `

————————————
三、输出流程（简化版：非专业客户直读指南）

你必须在内部完整执行上述所有分析逻辑（月令校准、三段式推演、双轨矩阵判定），但输出时将专业结论翻译为通俗易懂的自然语言，禁止直接使用"旺相休囚死"、"体生用"、"比和"等专业术语。严格按以下 Markdown 格式输出：

### 🔮 【一语定调】
（先在内部完成双轨矩阵判定，再根据所落象限，用2-3句话给出综合性、已消化完毕的行动建议。禁止把"现实层"和"高维层"拆开各说一句，必须合并为一个一致的总结论。定调规则：
- 【大胜】→ "可以做，条件好，大胆推进。"
- 【大败】→ "不宜做，现实和天道都不支持，应及时止损。"
- 【假胜】→ "短期可能有收获，但存在隐患，谨慎推进、留好退路。"
- 【挡灾】→ "这个具体目标（如赚钱）难以达成，但整体方向对你有价值，建议调整期望后可以参与——重心放在成长和积累，而非短期回报。"
切忌：遇到【挡灾】时直接说"不行"或"无法达成"，这会与后续高维建议自相矛盾。）

### 📊 【现状与大势】
（翻译卦辞+本卦：你当下处在一个什么样的宏观大环境里？基础底盘如何？用比喻和直白语言讲清楚。）

### 🔄 【过程与结局】
（翻译变卦+对卦的体用演变：事情接下来会遇到什么助力/阻力？最终的客观结果是什么？结局由对卦定性，但需结合旺衰修正后给出准确判断，而不是简单说"失败"。）

### 💡 【高维生存锦囊】
（综合卦辞大背景与爻辞微观指针：在这个大环境下，面对必然的现实走向，你现在具体该怎么做？给出一针见血的落地行动建议，须与一语定调结论保持一致。）

### ⚠️ 【慎行事项】
（指出当前最不该做的一件事或需要回避的风险。）`;
    }

    // 专业版（管理员/付费用户专享）
    return coreLogic + learningBlock + `

————————————
三、输出流程（专业版：高维能量与双轨推演系统报告）

严格按以下 Markdown 格式输出：

## 🎯 【核心战略决断】
> 用最精炼的2-3句话直接回答用户问题。明确指出：基于对卦的"现实成败结果"，以及基于卦辞+爻辞综合的"天道长远战略定性"。

## 🏛️ 【第一步：核心卦象与时空基座】
明示时空月令、三卦阵列（本、变、对）、体用位置及旺相休囚死状态。

## 🔍 【第二步：现实事相的时间线推演（轨一）】
1. **缘起（本卦体用）**：初始基本盘与动机体检。
2. **过程（变卦体用）**：态势演变与助力/阻力分析。
3. **现实终局（对卦定调）**：依据对卦体用关系与旺衰，直接宣判现实物质世界的客观成/败。

## 📜 【第三步：天道战略与双轨矩阵（轨二）】
1. **战略大背景（读卦辞）**：提取本卦卦辞，描述事件宏观底色与天道大势。
2. **战术行动点（读爻辞）**：在卦辞大背景下，解读动爻爻辞，给出具体操作指南与因果定性。
3. **双轨矩阵归类**：将对卦现实结果与卦爻综合吉凶放入矩阵，指明终极象限（大胜/大败/假胜/挡灾）。

## ⚖️ 【大师智断】
给出高度凝练的最终结论：一针见血的战略定性与落地建议。`;
}
