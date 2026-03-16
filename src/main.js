/**
 * main.js - Application Entry Point
 * Orchestrates initialization, event binding, and delegates to controllers
 */
import './index.css';
import { $, $$, showToast } from './utils/dom.js';
import { initModals, openModal, closeModal } from './ui/modals.js';
import { loadHistory, addHistoryRecord, deleteHistoryRecord, addFeedbackRecord, mergeCloudHistory } from './storage/history.js';
import {
    getSelectedModel,
    setSelectedModel,
    hasAnyApiKey,
    MODEL_REGISTRY
} from './storage/settings.js';
import { TRIGRAMS, getShichen } from './core/bagua-data.js';
import DivinationEngine from './core/divination-engine.js';
import GanzhiCalendar from './core/ganzhi-calendar.js';
import { renderHistoryList } from './ui/history-view.js';
import { addMessage, addSystemMessage, appendAssistantMessageActions, scrollChat } from './ui/chat-view.js';
import { renderResultView } from './ui/hex-view.js';
import { normalizeAnalysisText } from './utils/formatter.js';

// Controllers
import state from './controllers/state.js';
import {
    switchToLoginMode,
    switchToRegisterMode,
    initAuthPasswordAssist,
    updateUIForAuth,
    handleAuthSubmit,
    handleLogout,
    handleRedeemVip,
    showForgotPassword,
    hideForgotPassword,
    handleSendCode,
    handleResetSubmit,
    showProfilePanel,
    hideProfilePanel,
    handleBindEmail,
    handleAdminResetPassword,
    handleChangePassword
} from './controllers/auth-controller.js';
import { hasProAccess, hydrateRememberedUser, getCurrentUser } from './storage/auth.js';
import { handleSaveSettings, loadSettingsToModal } from './controllers/settings-controller.js';
import { performAIAnalysis, continueAIAnalysis, performComparisonAnalysis } from './controllers/ai-controller.js';
import makeLogger from './utils/logger.js';

const log = makeLogger('App');
const NON_QUESTION_PATTERNS = [
    /^(你好|您好|嗨|哈喽|hello|hi)$/i,
    /^(在吗|你在吗|有人吗|在不在|忙吗|收到吗)$/,
    /^(测试|试试|test)$/i,
    /^(谢谢|谢了|好的|好)$/,
];
const QUESTION_HINT_RE = /(是否|能否|能不能|可不可以|会不会|行不行|该不该|要不要|如何|怎么办|怎么做|怎么选|何时|什么时候|几时|结果|前景|发展|适不适合|值不值得|有没有机会|问|请问|求问|吗|？|\?)/;
const DIVINATION_TOPIC_RE = /(工作|上班|事业|财运|钱|感情|婚姻|婚礼|关系|学业|考试|升学|留学|学校|合作|投资|买房|搬家|出国|孩子|家庭|官司|创业|求职|offer|录取|健康|病|复合|婚期|项目|结果|前途|对象|申请|签证|贷款|收入|发展|去不去|要不要|参加|赴约|见面|出行|旅行|聚会|活动|婚宴|生日|典礼|手术|面试|告白|喜欢|认真|真心|联系|拉黑|冷淡|暧昧|在一起|分手|相亲|约会|追我|对我|对他|对她)/;
const DIVINATION_ACTION_RE = /(去|不去|参加|不参加|做|不做|见|不见|答应|不答应|继续|放弃|退出|开始|停止|报名|赴约|出发|表白|复合|换|辞|搬|买|卖|投|考|读|去读|申请|签|借|还|合作|联系|见面|相处|追|追求|表态|断联|挽回|结婚|订婚|分开)/;
const DIVINATION_RELATION_RE = /(他喜欢我吗|她喜欢我吗|他对我好不好|她对我好不好|他是认真的吗|她是认真的吗|是否还需要继续联系|还要不要继续联系|该不该继续联系|要不要继续联系|我们还有可能吗|我们会在一起吗|他会联系我吗|她会联系我吗|他会不会回头|她会不会回头)/;

// Pending date clarification state
let _pendingParsedResult = null;
let _pendingDateInfo = null;

function isMeaningfulDivinationQuestion(rawQuestion, hasParsedHex = false) {
    const question = (rawQuestion || '').trim();
    if (!question) return false;
    const normalized = question
        .replace(/[\s,.，。!！?？~～、]/g, '')
        .toLowerCase();

    if (NON_QUESTION_PATTERNS.some((pattern) => pattern.test(normalized))) return false;
    if (hasParsedHex) return true;

    const hasTopic = DIVINATION_TOPIC_RE.test(question);
    const hasQuestionHint = QUESTION_HINT_RE.test(question);
    const hasAction = DIVINATION_ACTION_RE.test(question);

    if (DIVINATION_RELATION_RE.test(question)) return true;
    if (hasTopic && hasQuestionHint) return true;
    if (hasTopic && normalized.length >= 6) return true;
    if (hasAction && hasQuestionHint && normalized.length >= 8) return true;
    if (hasQuestionHint && normalized.length >= 12) return true;
    if (normalized.length >= 18) return true;
    return false;
}

// ===================== Icon Utilities =====================
function refreshIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// ===================== Theme =====================
function restoreTheme() {
    const saved = localStorage.getItem('meihua_theme');
    if (saved === 'dark') applyTheme('dark');
}

function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('meihua_theme', next);
}

function applyTheme(theme) {
    const btn = $('#btn-theme-toggle');
    if (theme === 'dark') {
        document.documentElement.dataset.theme = 'dark';
        if (btn) {
            btn.querySelector('.theme-icon').textContent = '\u2600\uFE0F';
            btn.querySelector('.theme-label').textContent = '\u6D45\u8272';
        }
    } else {
        delete document.documentElement.dataset.theme;
        if (btn) {
            btn.querySelector('.theme-icon').textContent = '\uD83C\uDF19';
            btn.querySelector('.theme-label').textContent = '\u6DF1\u8272';
        }
    }
}

// ===================== Mobile Drawer =====================
function openMobileDrawer() {
    $('#app-sidebar')?.classList.add('drawer-open');
    $('#sidebar-overlay')?.classList.add('active');
    document.body.classList.add('drawer-lock');
}

function closeMobileDrawer() {
    $('#app-sidebar')?.classList.remove('drawer-open');
    $('#sidebar-overlay')?.classList.remove('active');
    document.body.classList.remove('drawer-lock');
    requestAnimationFrame(updateMobileNewCaseButtonVisibility);
}

function updateMobileNewCaseButtonVisibility() {
    const button = $('#btn-new-case-mobile');
    if (!button) return;

    if (window.innerWidth > 900) {
        button.classList.add('hidden');
        return;
    }

    if ($('#app-sidebar')?.classList.contains('drawer-open')) {
        button.classList.add('hidden');
        return;
    }

    if (document.body.classList.contains('oracle-waiting')) {
        button.classList.add('hidden');
        return;
    }

    const hasVisibleResult = Boolean(state.currentResult) && !$('#ai-chat')?.classList.contains('hidden');
    if (!hasVisibleResult) {
        button.classList.add('hidden');
        return;
    }

    const actionRow = document.querySelector('.msg-action-row');
    const actionRowVisible = Boolean(actionRow) && (() => {
        const rect = actionRow.getBoundingClientRect();
        return rect.top < window.innerHeight - 20 && rect.bottom > 0;
    })();

    button.classList.toggle('hidden', actionRowVisible);
}

window.syncMobileNewCaseButtonVisibility = () => {
    requestAnimationFrame(updateMobileNewCaseButtonVisibility);
};

// ===================== Initialization =====================
async function init() {
    log.info('Initializing...');
    initModals();
    initAuthPasswordAssist();
    restoreTheme();

    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // 先用本地缓存立即恢复用户（瞬间完成，不等网络）
    state.currentUser = getCurrentUser();

    state.history = loadHistory(state.currentUser?.name);
    state.selectedModelKey = getSelectedModel();

    // 普通用户固定主线，避免历史缓存把线路锁在备线导致不稳定
    if (!hasProAccess()) {
        state.selectedModelKey = 'deepseek-combined';
        setSelectedModel(state.selectedModelKey);
    }

    populateSelects();
    populateModelSelect();
    setCurrentTimeToPicker();
    bindEvents();
    updateUIForAuth();  // 这里会设置模型选择器的显示/隐藏
    renderHistory();

    // 后台静默验证 session，如果失效则清除登录态
    hydrateRememberedUser().then(serverUser => {
        const wasLoggedIn = !!state.currentUser;
        const isLoggedIn = !!serverUser;
        state.currentUser = serverUser;
        // 只有登录状态变化时才刷新UI
        if (wasLoggedIn !== isLoggedIn) {
            updateUIForAuth();
            state.history = loadHistory(state.currentUser?.name);
            renderHistory();
        }
    });

    if (state.currentUser?.name) {
        mergeCloudHistory(state.currentUser.name).then((history) => {
            state.history = history;
            renderHistory();
        });
    }

    // 手机端：日志默认展开（手机私密，无需锁定）
    if (window.innerWidth <= 900) {
        const hList = $('#history-list');
        const hHint = $('#history-hint');
        const hToggle = $('#history-toggle');
        if (hList) {
            hList.classList.remove('collapsed');
            if (hHint) hHint.classList.add('hidden');
            if (hToggle) hToggle.classList.add('expanded');
        }
    }

    // Set initial model
    const modelSelect = $('#model-select');
    if (modelSelect) {
        modelSelect.value = state.selectedModelKey;
        // 再次确保模型选择器的显示状态正确（防止被其他代码覆盖）
        if (!hasProAccess()) {
            modelSelect.classList.remove('show-for-pro');
            modelSelect.style.display = 'none';
        } else {
            modelSelect.classList.add('show-for-pro');
            modelSelect.style.display = '';
        }
    }

    log.info('Ready.');
}

function populateSelects() {
    const selectUpper = $('#select-upper');
    const selectLower = $('#select-lower');
    if (!selectUpper || !selectLower) return;

    for (const [idx, tri] of Object.entries(TRIGRAMS)) {
        const text = `${tri.name} ${tri.symbol} (${tri.nature}·${tri.element})`;
        selectUpper.add(new Option(text, idx));
        selectLower.add(new Option(text, idx));
    }
}

function populateModelSelect() {
    const modelSelect = $('#model-select');
    if (!modelSelect) return;
    modelSelect.innerHTML = '';
    if (hasProAccess()) {
        for (const [key, model] of Object.entries(MODEL_REGISTRY)) {
            modelSelect.add(new Option(model.label, key));
        }
    } else {
        const mainModel = MODEL_REGISTRY['deepseek-combined'];
        modelSelect.add(new Option(mainModel.label, 'deepseek-combined'));
        state.selectedModelKey = 'deepseek-combined';
        setSelectedModel(state.selectedModelKey);
    }
}

function setCurrentTimeToPicker() {
    const castTimePicker = $('#cast-time-picker');
    if (!castTimePicker) return;
    const now = new Date();
    castTimePicker.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    updateShichenLabel();
}

function updateShichenLabel() {
    const castTimePicker = $('#cast-time-picker');
    const castShichenLabel = $('#cast-shichen-label');
    if (!castTimePicker || !castShichenLabel) return;
    const [h] = castTimePicker.value.split(':');
    const shichen = getShichen(parseInt(h));
    castShichenLabel.textContent = `${shichen.name}时`;
}

function bindEvents() {
    // Auth
    $('#user-trigger')?.addEventListener('click', () => {
        openModal('modal-auth');
        if (state.currentUser) {
            showProfilePanel();
        } else {
            hideProfilePanel();
        }
    });
    $('#btn-register-header')?.addEventListener('click', () => {
        openModal('modal-auth');
        switchToRegisterMode();
    });
    $('#tab-login')?.addEventListener('click', switchToLoginMode);
    $('#tab-register')?.addEventListener('click', switchToRegisterMode);
    $('#auth-form-main')?.addEventListener('submit', (e) => {
        e.preventDefault();
        handleAuthSubmit(renderHistory);
    });
    $('#btn-redeem-vip')?.addEventListener('click', handleRedeemVip);
    $('#forgot-password-link')?.addEventListener('click', showForgotPassword);
    $('#back-to-login')?.addEventListener('click', hideForgotPassword);
    $('#auth-form-reset')?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!$('#reset-code-section')?.classList.contains('hidden')) {
            handleResetSubmit();
            return;
        }
        handleSendCode();
    });
    $('#btn-bind-email')?.addEventListener('click', handleBindEmail);
    $('#btn-admin-reset')?.addEventListener('click', handleAdminResetPassword);
    $('#profile-change-pwd-section')?.addEventListener('submit', (e) => {
        e.preventDefault();
        handleChangePassword();
    });
    $('#btn-logout-header')?.addEventListener('click', () => handleLogout(renderHistory, startNewCase));
    $('#btn-logout-sidebar')?.addEventListener('click', () => handleLogout(renderHistory, startNewCase));
    $('#btn-close-auth')?.addEventListener('click', () => { hideProfilePanel(); closeModal('modal-auth'); });

    // Time picker
    $('#cast-time-picker')?.addEventListener('input', updateShichenLabel);
    $('#btn-time-now')?.addEventListener('click', setCurrentTimeToPicker);

    // Casting Buttons
    $('#btn-cast-time')?.addEventListener('click', handleCastByTime);
    $('#btn-cast-number')?.addEventListener('click', handleCastByNumber);
    $('#btn-cast-manual')?.addEventListener('click', handleCastByManual);

    // Sidebar
    $('#sidebar-toggle')?.addEventListener('click', () => {
        if (window.innerWidth <= 900) {
            openMobileDrawer();
        } else {
            $('#app-sidebar').classList.toggle('collapsed');
        }
    });

    // Close mobile drawer when overlay is tapped
    $('#sidebar-overlay')?.addEventListener('click', closeMobileDrawer);
    // scroll 节流：最多每 100ms 执行一次
    let _lastScrollTime = 0;
    window.addEventListener('scroll', () => {
        const now = Date.now();
        if (now - _lastScrollTime > 100) {
            updateMobileNewCaseButtonVisibility();
            _lastScrollTime = now;
        }
    }, { passive: true });
    // resize 防抖：停止变化后 100ms 再执行
    let _resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(_resizeTimer);
        _resizeTimer = setTimeout(updateMobileNewCaseButtonVisibility, 100);
    });

    // New Case
    $('#btn-new-case')?.addEventListener('click', startNewCase);
    $('#btn-new-case-mobile')?.addEventListener('click', startNewCase);

    // History toggle (collapsed by default for privacy)
    $('#history-toggle')?.addEventListener('click', (e) => {
        if (e.target.closest('#btn-sync-history')) return;
        const list = $('#history-list');
        const hint = $('#history-hint');
        const toggle = $('#history-toggle');
        if (list) {
            const willCollapse = !list.classList.contains('collapsed');
            list.classList.toggle('collapsed');
            if (hint) hint.classList.toggle('hidden', !willCollapse);
            if (toggle) toggle.classList.toggle('expanded', !willCollapse);
        }
    });

    // Model Change
    $('#model-select')?.addEventListener('change', (e) => {
        state.selectedModelKey = e.target.value;
        setSelectedModel(state.selectedModelKey);
        showToast(`已切换至 ${MODEL_REGISTRY[state.selectedModelKey].label}`, 'success');
        // If analysis is in progress, mark pending comparison (will trigger after current completes)
        if (state.interruptedCtx) {
            state.pendingModelComparison = true;
            return;
        }
        // If a completed analysis exists with a different model, trigger side-by-side comparison
        if (state.lastAnalysisCtx && state.lastAnalysisCtx.modelKey !== state.selectedModelKey) {
            performComparisonAnalysis(renderHistory);
        }
    });


    // Main divine button (the floating one)
    window.handleDivine = handleDivineMain;
    $('#btn-divine')?.addEventListener('click', handleDivineMain);

    // 新起一卦（AI 回复底部按钮回调）
    window.startNewCaseFromChat = startNewCase;

    // 显示易泓录二维码弹窗
    window.showQRCode = function () {
        $('#modal-qrcode')?.classList.remove('hidden');
        $('#btn-new-case-mobile')?.classList.add('hidden');
    };

    window.hideQRCode = function () {
        $('#modal-qrcode')?.classList.add('hidden');
        requestAnimationFrame(updateMobileNewCaseButtonVisibility);
    };

    // 导出断卦结果
    window.exportDivinationResult = function () {
        const question = $('#input-chat')?.value?.trim() || '未记录问题';

        // 优先从 state 中取原始 markdown 文本（保留段落格式）
        let analysisText = '';
        if (state.modelAnalyses && state.modelAnalyses.length > 0) {
            analysisText = state.modelAnalyses.map(a => a.content || '').filter(Boolean).join('\n\n');
        }

        // 降级：如果 state 里没有，从 DOM 提取
        if (!analysisText.trim()) {
            const chatEl = $('#chat-messages');
            if (!chatEl) return showToast('暂无可导出的内容', 'error');
            const assistantMsgs = chatEl.querySelectorAll('.chat-message.assistant .msg-content');
            assistantMsgs.forEach(el => {
                const clone = el.cloneNode(true);
                clone.querySelectorAll('.thinking-block, .msg-feedback-actions, .msg-bottom-actions, .msg-action-row, .wechat-promo').forEach(n => n.remove());
                const text = clone.innerText.trim();
                if (text) analysisText += text + '\n\n';
            });
        }

        analysisText = normalizeAnalysisText(analysisText);

        if (!analysisText.trim()) return showToast('暂无可导出的分析内容', 'error');

        const cleanText = formatAnalysisForExport(analysisText);

        const hexName = state.currentResult?.original?.name || '';
        const now = new Date().toLocaleString();
        const modeLabel = state.selectedMode === 'pro' ? '专业版' : '简化版';
        const modelLabel = MODEL_REGISTRY[state.selectedModelKey]?.label || '未记录模型';
        const exportText = [
            '梅花义理｜断卦纪要',
            '────────────────',
            `时间｜${now}`,
            `卦名｜${hexName || '未记录卦名'}`,
            `模式｜${modeLabel}`,
            `引擎｜${modelLabel}`,
            `问题｜${question}`,
            '────────────────',
            cleanText.trim(),
            '────────────────',
            '梅花义理  meihuayili.com',
            '微信｜易泓录（yhLchat）'
        ].join('\n');

        // 优先用系统分享（手机可分享到微信/备忘录），降级为复制到剪贴板
        if (navigator.share) {
            navigator.share({ title: `梅花义理 - ${hexName}`, text: exportText }).catch(() => {
                _copyToClipboard(exportText);
            });
        } else {
            _copyToClipboard(exportText);
        }
    };

    function _copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('断卦结果已复制到剪贴板，可粘贴分享', 'success');
        }).catch(() => {
            // 最终降级：创建临时textarea复制
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;left:-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('断卦结果已复制到剪贴板', 'success');
        });
    }

    function formatAnalysisForExport(text) {
        return text
            .replace(/^#{1,3}\s*[^【\n]*【([^】]+)】\s*$/gm, '\n〔$1〕')
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/^-\s+/gm, '• ')
            .replace(/^>\s*/gm, '')
            .split('\n')
            .map((line) => {
                const trimmed = line.trim();
                if (!trimmed) return '';
                if (/^〔.+〕$/.test(trimmed)) return trimmed;
                if (/^[0-9]+\./.test(trimmed) || /^•\s/.test(trimmed)) return trimmed;
                return `  ${trimmed}`;
            })
            .join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    $('#input-chat')?.addEventListener('input', handleTextInputChange);
    $('#input-chat')?.addEventListener('input', autoResizeTextarea);
    $('#btn-time-divine')?.addEventListener('click', handleTimeDivineAuto);
    $('#btn-quick-parse')?.addEventListener('click', handleQuickParse);
    $('#btn-stop-generate')?.addEventListener('click', () => {
        state.currentAbortController?.abort();
        state.stopCurrentThinkingProgress?.();  // stop timer immediately (silent-abort path skips onError)
        $('#btn-stop-generate').classList.add('hidden');
        $('#btn-continue-generate')?.classList.remove('hidden');
        $('#chat-status').textContent = '已暂停';
    });
    $('#btn-continue-generate')?.addEventListener('click', () => {
        $('#btn-continue-generate').classList.add('hidden');
        continueAIAnalysis();
    });
    $('#input-chat')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleDivineMain();
    });
    $('#chat-user-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleChatFollowUp();
    });

    // Settings
    $('#fab-settings')?.addEventListener('click', () => {
        loadSettingsToModal();
        openModal('modal-settings');
    });
    $('#btn-save-settings')?.addEventListener('click', handleSaveSettings);
    $('#btn-close-settings')?.addEventListener('click', () => closeModal('modal-settings'));

    // Theme toggle
    $('#btn-theme-toggle')?.addEventListener('click', toggleTheme);
}

// ===================== Handlers =====================

function autoResizeTextarea() {
    const el = $('#input-chat');
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
}

function handleTextInputChange() {
    // 如果已经在分析中（有结果了），不再操控按钮和引导动画
    if (state.currentResult) return;

    const text = $('#input-chat').value.trim();
    const hintText = $('#hero-hint');
    const btnTime = $('#btn-time-divine');
    const btnQuick = $('#btn-quick-parse');
    const ritual = $('#ritual-guide');

    if (!text) {
        btnQuick?.classList.add('hidden');
        btnTime?.classList.remove('hidden');
        btnTime?.classList.remove('breathing');
        ritual?.classList.add('hidden');
        if (hintText) hintText.style.display = 'block';
        return;
    }
    const parsed = DivinationEngine.parseFromText(text);
    const meaningful = isMeaningfulDivinationQuestion(text, Boolean(parsed));
    if (parsed) {
        btnQuick?.classList.remove('hidden');
        btnTime?.classList.add('hidden');
        btnTime?.classList.remove('breathing');
        ritual?.classList.add('hidden');
        if (hintText) hintText.style.display = 'none';
    } else if (meaningful) {
        btnQuick?.classList.add('hidden');
        btnTime?.classList.remove('hidden');
        // 显示净心引导 + 按钮呼吸光晕
        ritual?.classList.remove('hidden');
        btnTime?.classList.add('breathing');
        if (hintText) hintText.style.display = 'none';
    } else {
        btnQuick?.classList.add('hidden');
        btnTime?.classList.add('hidden');
        btnTime?.classList.remove('breathing');
        ritual?.classList.add('hidden');
        if (hintText) hintText.style.display = 'block';
    }
}

function handleQuickParse() {
    const text = $('#input-chat').value.trim();
    const parsed = DivinationEngine.parseFromText(text);
    if (!parsed) return;

    const dateParsed = DivinationEngine.parseDateFromQuestion(text);

    if (dateParsed?.type === 'month_only') {
        const jie = GanzhiCalendar.getJieInMonth(dateParsed.year, dateParsed.month);
        if (jie) {
            // Ambiguous month — need user to pick before/after the 节
            _pendingParsedResult = parsed;
            _pendingDateInfo = { dateParsed, jie };
            showDateClarificationModal(dateParsed, jie);
            return;
        }
    }

    // Specific date given: recalculate monthly energy with that date
    let finalResult = parsed;
    if (dateParsed?.type === 'specific') {
        finalResult = DivinationEngine.recalculateMonthlyEnergy(parsed, dateParsed.date);
    }

    state.currentResult = finalResult;
    renderResult(finalResult);
    $('#btn-quick-parse')?.classList.add('hidden');
    $('#btn-time-divine')?.classList.add('hidden');
    $('#ritual-guide')?.classList.add('hidden');
    $('#btn-time-divine')?.classList.remove('breathing');
    if (window.innerWidth <= 900) requestAnimationFrame(updateMobileNewCaseButtonVisibility);
    handleDivineMain();
}

function showDateClarificationModal(dateParsed, jie) {
    const { year, month } = dateParsed;
    // Monthly info one minute before the jie
    const minuteBeforeJie = new Date(jie.date.getTime() - 60000);
    const beforeInfo = GanzhiCalendar.getMonthlyInfo(minuteBeforeJie);
    const jieTimeStr = GanzhiCalendar.formatJieDate(jie.date); // e.g. "1月5日 14:32"

    $('#date-clarify-desc').innerHTML =
        `您指定的起卦时间为 <strong>${year}年${month}月</strong>，该月在 <strong>${jieTimeStr}（${jie.name}）</strong> 前后所属月令不同。<br>请确认起卦时间即可锁定正确月令：`;

    $('#date-clarify-options').innerHTML = `
        <button class="date-clarify-btn" onclick="window.completeDateClarification(true)">
            <div class="clarify-branch">${beforeInfo.branch}月（${beforeInfo.element}能量场）</div>
            <div class="clarify-range">${year}年${month}月 1日 — ${jieTimeStr}（${jie.name}）之前</div>
        </button>
        <button class="date-clarify-btn" onclick="window.completeDateClarification(false)">
            <div class="clarify-branch">${jie.branch}月（${jie.element}能量场）</div>
            <div class="clarify-range">${jieTimeStr}（${jie.name}）之后</div>
        </button>
    `;
    $('#modal-date-clarify').classList.remove('hidden');
}

window.completeDateClarification = function (useBeforeJie) {
    if (!_pendingParsedResult || !_pendingDateInfo) return;
    const { dateParsed, jie } = _pendingDateInfo;
    const parsed = _pendingParsedResult;

    // Pick a representative date for the chosen period
    const date = useBeforeJie
        ? new Date(dateParsed.year, dateParsed.month - 1, 1, 12, 0, 0)          // first of month
        : new Date(jie.date.getTime() + 60000);                                 // one minute after 节（精确节后）

    const finalResult = DivinationEngine.recalculateMonthlyEnergy(parsed, date);
    state.currentResult = finalResult;
    _pendingParsedResult = null;
    _pendingDateInfo = null;

    $('#modal-date-clarify').classList.add('hidden');
    renderResult(finalResult);
    $('#btn-quick-parse')?.classList.add('hidden');
    $('#btn-time-divine')?.classList.add('hidden');
    $('#ritual-guide')?.classList.add('hidden');
    $('#btn-time-divine')?.classList.remove('breathing');
    handleDivineMain();
};

async function handleTimeDivineAuto() {
    const text = $('#input-chat').value.trim();
    if (!text) {
        showToast('请先输入您想占问之事的背景或问题', 'error');
        return;
    }

    // 隐藏净心引导
    $('#ritual-guide')?.classList.add('hidden');
    $('#btn-time-divine')?.classList.remove('breathing');

    // Always use current system time for automatic 'minimalist' cast
    const now = new Date();
    state.currentResult = DivinationEngine.castByTime(now.getHours(), now.getMinutes());
    renderResult(state.currentResult);

    // Hide buttons
    $('#btn-time-divine')?.classList.add('hidden');
    $('#btn-quick-parse')?.classList.add('hidden');

    if (window.innerWidth <= 900) requestAnimationFrame(updateMobileNewCaseButtonVisibility);

    // Start analysis
    await handleDivineMain();
}

function renderHistory() {
    renderHistoryList(
        $('#history-list'),
        state.history,
        state.lastRecordId,
        loadHistoryRecord,
        handleDeleteRecord
    );
    // Update count badge
    const countEl = $('#history-count');
    if (countEl) countEl.textContent = state.history.length > 0 ? state.history.length : '';
    // Update hint visibility: show hint only when collapsed AND has records
    const hint = $('#history-hint');
    const list = $('#history-list');
    if (hint) {
        if (state.history.length === 0) {
            hint.classList.add('hidden');
        } else if (list?.classList.contains('collapsed')) {
            hint.classList.remove('hidden');
        }
    }
}

function loadHistoryRecord(id) {
    // Abort any in-flight stream before wiping the DOM
    state.currentAbortController?.abort();
    state.stopCurrentThinkingProgress?.();
    state.interruptedCtx = null;
    state.lastAnalysisCtx = null;
    state.pendingModeComparison = false;
    state.pendingModelComparison = false;

    const record = state.history.find(r => String(r.id) === String(id));
    if (record) {
        state.lastRecordId = record.id;
        state.currentResult = record.result;
        state.modelAnalyses = record.analyses || [];

        // 权限检测：简化版用户隐藏排盘
        if (hasProAccess()) {
            $('#hexagram-display').classList.remove('hidden');
        } else {
            $('#hexagram-display').classList.add('hidden');
        }
        $('#divination-console').classList.add('hidden');
        $('#input-chat').value = record.question || '';
        autoResizeTextarea();
        $('#chat-messages').innerHTML = '';
        $('#chat-messages')?.classList.add('history-replay-mode');
        $('#ai-chat').classList.remove('hidden');
        $('#btn-divine').classList.add('hidden');
        $('#btn-time-divine')?.classList.add('hidden');
        $('#btn-quick-parse')?.classList.add('hidden');

        $('#chat-status').textContent = '历史记录';

        renderResult(state.currentResult, false);

        if (state.modelAnalyses.length > 0) {
            state.modelAnalyses.forEach(analysis => {
                addMessage($('#chat-messages'), {
                    role: 'assistant',
                    content: analysis.content,
                    reasoning: analysis.reasoning,
                    modelLabel: analysis.modelLabel
                });
            });
        } else if (record.analysis) { // Fallback for legacy
            addMessage($('#chat-messages'), {
                role: 'assistant',
                content: record.analysis,
                reasoning: record.reasoning,
                modelLabel: '历史记录'
            });
        }

        const assistantMessages = $('#chat-messages')?.querySelectorAll('.chat-message.assistant');
        const lastAssistantMessage = assistantMessages?.[assistantMessages.length - 1];
        if (lastAssistantMessage) {
            appendAssistantMessageActions(lastAssistantMessage);
        }

        renderHistory();
        scrollChat($('#chat-messages'), true);
        // 手机端：加载记录后自动收起抽屉 + 显示新起一卦
        if (window.innerWidth <= 900) {
            closeMobileDrawer();
            requestAnimationFrame(updateMobileNewCaseButtonVisibility);
        }
    }
}

function handleDeleteRecord(id) {
    state.history = deleteHistoryRecord(state.currentUser.name, id);
    if (String(state.lastRecordId) === String(id)) state.lastRecordId = null;
    renderHistory();
    showToast('记录已从卦例馆移除', 'info');
}

function startNewCase() {
    // Abort any in-flight stream
    state.currentAbortController?.abort();
    state.stopCurrentThinkingProgress?.();
    state.interruptedCtx = null;
    state.lastAnalysisCtx = null;
    state.pendingModeComparison = false;
    state.pendingModelComparison = false;

    state.lastRecordId = null;
    state.currentResult = null;
    state.modelAnalyses = [];
    $('#hexagram-display').classList.add('hidden');
    $('#divination-console').classList.remove('hidden');
    $('#chat-messages').innerHTML = '';
    $('#ai-chat').classList.add('hidden');
    $('#btn-divine').classList.add('hidden');
    $('#btn-time-divine')?.classList.remove('hidden');
    $('#btn-quick-parse')?.classList.add('hidden');
    $('#input-chat').value = '';
    autoResizeTextarea();
    renderHistory();
    // 手机端：隐藏顶部新起一卦按钮 + 收起抽屉
    $('#btn-new-case-mobile')?.classList.add('hidden');
    if (window.innerWidth <= 900) closeMobileDrawer();
}

function handleCastByTime() {
    const [h, m] = $('#cast-time-picker').value.split(':');
    const hour = parseInt(h), min = parseInt(m);
    if (isNaN(hour) || isNaN(min) || hour < 0 || hour > 23 || min < 0 || min > 59) {
        showToast('请选择有效的时间', 'error');
        return;
    }
    state.currentResult = DivinationEngine.castByTime(hour, min);
    renderResult(state.currentResult);
    $('#btn-divine').classList.remove('hidden');
    showToast('时空卦象已成', 'success');
}

function handleCastByNumber() {
    const num1 = parseInt($('#input-num1').value);
    const num2 = parseInt($('#input-num2').value);
    const num3 = $('#input-num3').value ? parseInt($('#input-num3').value) : null;

    if (isNaN(num1) || isNaN(num2) || num1 < 1 || num2 < 1 || num1 > 99999 || num2 > 99999) {
        showToast('请输入有效的卦数（1-99999）', 'error');
        return;
    }
    if (num3 !== null && (isNaN(num3) || num3 < 1 || num3 > 99999)) {
        showToast('第三个数须为 1-99999', 'error');
        return;
    }

    if (num3 !== null && !isNaN(num3)) {
        state.currentResult = DivinationEngine.castByThreeNumbers(num1, num2, num3);
    } else {
        state.currentResult = DivinationEngine.castByTwoNumbers(num1, num2);
    }
    renderResult(state.currentResult);
    $('#btn-divine').classList.remove('hidden');
    showToast('报数起卦已成', 'success');
}

function handleCastByManual() {
    const up = parseInt($('#select-upper').value);
    const lo = parseInt($('#select-lower').value);
    const yao = parseInt($('#select-yao').value);
    state.currentResult = DivinationEngine.castManual(up, lo, yao);
    renderResult(state.currentResult);
    $('#btn-divine').classList.remove('hidden');
    showToast('手动选卦已完成', 'success');
}

const MAX_QUESTION_LEN = 500;

async function handleDivineMain() {
    let question = $('#input-chat').value.trim();
    if (question.length > MAX_QUESTION_LEN) question = question.slice(0, MAX_QUESTION_LEN);
    if (!state.currentResult) {
        showToast('请先进行起卦操作', 'error');
        return;
    }
    if (!isMeaningfulDivinationQuestion(question, Boolean(DivinationEngine.parseFromText(question)))) {
        showToast('先写下具体疑问，再来断卦。比如：我今年适合换工作吗？', 'info');
        $('#input-chat')?.focus();
        return;
    }
    $('#ai-chat').classList.remove('hidden');
    $('#btn-divine').classList.add('hidden');



    await performAIAnalysis(question, renderHistory);
}

async function handleChatFollowUp() {
    const input = $('#chat-user-input');
    const question = input.value.trim().slice(0, MAX_QUESTION_LEN);
    if (!question) return;
    if (!isMeaningfulDivinationQuestion(question, Boolean(DivinationEngine.parseFromText(question)))) {
        showToast('请直接补充你的疑问，不要只发寒暄语。', 'info');
        input.focus();
        return;
    }

    input.value = '';
    addMessage($('#chat-messages'), { role: 'user', content: question });
    scrollChat($('#chat-messages'), true);

    await performAIAnalysis(question, renderHistory, true);
}

function renderResult(result, isNew = true) {
    if (isNew) {
        state.lastRecordId = null;
        state.modelAnalyses = [];
        $('#chat-messages').innerHTML = '';
        $('#chat-messages')?.classList.remove('history-replay-mode');
    }
    renderResultView($('#hexagram-display'), result, isNew);
    
    // 权限检测：简化版用户隐藏排盘，专业版用户显示排盘
    if (hasProAccess()) {
        $('#hexagram-display').classList.remove('hidden');  // 管理员/付费用户：显示完整排盘
    } else {
        $('#hexagram-display').classList.add('hidden');  // 普通用户：隐藏排盘
    }
    
    $('#divination-console').classList.add('hidden');
}

// ============================================
// Feedback Mechanism (Self-Iteration System)
// ============================================
window.openFeedbackModal = function (msgId) {
    const modal = $('#modal-feedback');
    modal.dataset.msgId = msgId;
    modal.classList.remove('hidden');

    // Reset form
    document.querySelectorAll('#modal-feedback .rating-btn').forEach(btn => btn.classList.remove('active'));
    $('#feedback-text').value = '';
    const outcomeEl = $('#feedback-outcome');
    if (outcomeEl) outcomeEl.value = '';
};

window.selectRating = function (btn) {
    document.querySelectorAll('#modal-feedback .rating-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
};

window.submitFeedback = function () {
    const activeBtn = document.querySelector('#modal-feedback .rating-btn.active');
    const correctionText = $('#feedback-text').value.trim();
    const outcomeText = ($('#feedback-outcome')?.value || '').trim();
    const rating = activeBtn ? activeBtn.dataset.value : null;

    if (!rating && !correctionText && !outcomeText) {
        showToast('请至少选择一项反馈维度或填写内容', 'error');
        return;
    }

    // Build feedback record with full context
    const record = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        rating,
        actualOutcome: outcomeText,
        correction: correctionText,
        hexagramName: state.currentResult?.original?.name || null,
        question: $('#input-chat')?.value?.trim() || null,
        recordId: state.lastRecordId || null
    };

    // Save to feedback learning store
    if (state.currentUser) {
        addFeedbackRecord(state.currentUser.name, record);
    }

    // Close modal & confirmation
    $('#modal-feedback').classList.add('hidden');
    showToast('感谢卦例点拨！反馈已纳入学习库，后续推演将自动参考。', 'success');

    // Disable feedback button in chat
    const msgId = $('#modal-feedback').dataset.msgId;
    if (msgId) {
        const btn = document.querySelector(`#${msgId} .btn-feedback`);
        if (btn) {
            btn.innerHTML = `<span class="fb-icon" style="font-size:1.1rem">✅</span> 反馈已入库`;
            btn.onclick = null;
            btn.style.opacity = '0.6';
            btn.style.cursor = 'default';
        }
    }
};

// Bootstrap
document.addEventListener('DOMContentLoaded', init);

// ---- PWA Install Banner ----
(function() {
    const markPwaPromptHandled = () => {
        localStorage.setItem('pwa_dismissed', '1');
    };

    const hidePwaPrompts = () => {
        document.getElementById('pwa-install-banner')?.classList.add('hidden');
        document.getElementById('pwa-ios-guide')?.classList.add('hidden');
        document.getElementById('pwa-wechat-guide')?.classList.add('hidden');
    };

    // 已经以 standalone 模式运行（已安装），不显示
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
        localStorage.setItem('pwa_installed', '1');
        markPwaPromptHandled();
        return;
    }
    // 电脑端不显示，仅手机/平板
    if (!/Mobi|Android|iPad|iPhone|iPod|MicroMessenger/.test(navigator.userAgent)) return;

    const banner = document.getElementById('pwa-install-banner');
    const btnInstall = document.getElementById('btn-pwa-install');
    const btnDismiss = document.getElementById('btn-pwa-dismiss');
    const iosGuide = document.getElementById('pwa-ios-guide');
    const btnIosClose = document.getElementById('btn-pwa-ios-close');
    const wechatGuide = document.getElementById('pwa-wechat-guide');
    const btnWechatClose = document.getElementById('btn-pwa-wechat-close');
    if (!banner) return;

    let deferredPrompt = null;
    const ua = navigator.userAgent;
    const isWeChat = /MicroMessenger/i.test(ua);
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isInstalled = Boolean(localStorage.getItem('pwa_installed'));
    const shouldSuppressBanner = Boolean(localStorage.getItem('pwa_dismissed'));

    if (isInstalled) {
        hidePwaPrompts();
        return;
    }

    // iPhone 浏览器无法可靠识别“是否已添加到主屏幕”，这里不再自动弹提示，避免误报骚扰。
    if (isIOS && !isWeChat) {
        hidePwaPrompts();
        return;
    }

    // Android Chrome: 捕获系统安装事件
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (!shouldSuppressBanner) banner?.classList.remove('hidden');
    });

    // 微信内: 仅在未安装且未关闭时，显示页面下方提示
    if (isWeChat && !shouldSuppressBanner) {
        banner?.classList.remove('hidden');
    }

    const openInstallFlow = () => {
        if (deferredPrompt) {
            // Android: 触发系统安装弹窗
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(() => {
                deferredPrompt = null;
                banner?.classList.add('hidden');
                localStorage.setItem('pwa_installed', '1');
                markPwaPromptHandled();
            });
        } else if (isWeChat) {
            // 微信内: 引导用户用浏览器打开
            markPwaPromptHandled();
            banner?.classList.add('hidden');
            wechatGuide?.classList.remove('hidden');
        } else if (isIOS) {
            iosGuide?.classList.remove('hidden');
        }
    };

    btnInstall?.addEventListener('click', openInstallFlow);

    btnDismiss?.addEventListener('click', () => {
        markPwaPromptHandled();
        hidePwaPrompts();
    });

    btnIosClose?.addEventListener('click', () => {
        markPwaPromptHandled();
        hidePwaPrompts();
    });

    btnWechatClose?.addEventListener('click', () => {
        markPwaPromptHandled();
        hidePwaPrompts();
    });
})();
