/**
 * main.js - Application Entry Point
 * Orchestrates initialization, event binding, and delegates to controllers
 */
import './index.css';
import { $, $$, showToast } from './utils/dom.js';
import { initModals, openModal, closeModal } from './ui/modals.js';
import { loadHistory, addHistoryRecord, deleteHistoryRecord, addFeedbackRecord } from './storage/history.js';
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
import { addMessage, addSystemMessage, scrollChat } from './ui/chat-view.js';
import { renderResultView } from './ui/hex-view.js';

// Controllers
import state from './controllers/state.js';
import {
    switchToLoginMode,
    switchToRegisterMode,
    updateUIForAuth,
    handleAuthSubmit,
    handleLogout
} from './controllers/auth-controller.js';
import { hasProAccess } from './storage/auth.js';
import { handleSaveSettings, loadSettingsToModal } from './controllers/settings-controller.js';
import { performAIAnalysis, continueAIAnalysis, performComparisonAnalysis } from './controllers/ai-controller.js';
import makeLogger from './utils/logger.js';

const log = makeLogger('App');

// Pending date clarification state
let _pendingParsedResult = null;
let _pendingDateInfo = null;

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
}

// ===================== Initialization =====================
function init() {
    log.info('Initializing...');
    initModals();
    restoreTheme();

    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

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
    $('#user-trigger')?.addEventListener('click', () => openModal('modal-auth'));
    $('#btn-register-header')?.addEventListener('click', () => {
        openModal('modal-auth');
        switchToRegisterMode();
    });
    $('#tab-login')?.addEventListener('click', switchToLoginMode);
    $('#tab-register')?.addEventListener('click', switchToRegisterMode);
    $('#btn-auth-submit')?.addEventListener('click', () => handleAuthSubmit(renderHistory));
    $('#btn-logout-header')?.addEventListener('click', () => handleLogout(renderHistory, startNewCase));
    $('#btn-logout-sidebar')?.addEventListener('click', () => handleLogout(renderHistory, startNewCase));
    $('#btn-close-auth')?.addEventListener('click', () => closeModal('modal-auth'));

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

    // New Case
    $('#btn-new-case')?.addEventListener('click', startNewCase);

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

    // Chat follow-up
    $('#btn-chat-send')?.addEventListener('click', handleChatFollowUp);
    $('#input-chat')?.addEventListener('input', handleTextInputChange);
    $('#btn-time-divine')?.addEventListener('click', handleTimeDivineAuto);
    $('#btn-quick-parse')?.addEventListener('click', handleQuickParse);
    $('#btn-stop-generate')?.addEventListener('click', () => {
        state.currentAbortController?.abort();
        state.stopCurrentThinkingProgress?.();  // stop timer immediately (silent-abort path skips onError)
        $('#btn-stop-generate').classList.add('hidden');
        $('#btn-continue-generate')?.classList.remove('hidden');
        $('#chat-status').textContent = '已暂停';
        $('#chat-input-area').classList.remove('hidden');
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

function handleTextInputChange() {
    const text = $('#input-chat').value.trim();
    const hintText = $('#hero-hint');
    const btnTime = $('#btn-time-divine');
    const btnQuick = $('#btn-quick-parse');

    if (!text) {
        btnQuick?.classList.add('hidden');
        btnTime?.classList.remove('hidden');
        if (hintText) hintText.style.display = 'block';
        return;
    }
    const parsed = DivinationEngine.parseFromText(text);
    if (parsed) {
        btnQuick?.classList.remove('hidden');
        btnTime?.classList.add('hidden');
        if (hintText) hintText.style.display = 'none';
    } else {
        btnQuick?.classList.add('hidden');
        btnTime?.classList.remove('hidden');
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
    handleDivineMain();
};

async function handleTimeDivineAuto() {
    const text = $('#input-chat').value.trim();
    if (!text) {
        showToast('请先输入您想占问之事的背景或问题', 'error');
        return;
    }

    // Always use current system time for automatic 'minimalist' cast
    const now = new Date();
    state.currentResult = DivinationEngine.castByTime(now.getHours(), now.getMinutes());
    renderResult(state.currentResult);

    // Hide buttons
    $('#btn-time-divine')?.classList.add('hidden');
    $('#btn-quick-parse')?.classList.add('hidden');

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
        $('#chat-messages').innerHTML = '';
        $('#ai-chat').classList.remove('hidden');
        $('#chat-input-area').classList.remove('hidden');
        $('#btn-divine').classList.add('hidden');
        $('#btn-time-divine')?.classList.add('hidden');
        $('#btn-quick-parse')?.classList.add('hidden');

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

        renderHistory();
        scrollChat($('#chat-messages'), true);
        // 手机端：加载记录后自动收起抽屉
        if (window.innerWidth <= 900) closeMobileDrawer();
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
    $('#chat-input-area').classList.add('hidden');
    $('#btn-divine').classList.add('hidden');
    $('#btn-time-divine')?.classList.remove('hidden');
    $('#btn-quick-parse')?.classList.add('hidden');
    $('#input-chat').value = '';
    renderHistory();
    // 手机端：新起一卦后自动收起抽屉
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
    showToast('报数起卦已成', 'success');
}

function handleCastByManual() {
    const up = parseInt($('#select-upper').value);
    const lo = parseInt($('#select-lower').value);
    const yao = parseInt($('#select-yao').value);
    state.currentResult = DivinationEngine.castManual(up, lo, yao);
    renderResult(state.currentResult);
    showToast('手动选卦已完成', 'success');
}

const MAX_QUESTION_LEN = 500;

async function handleDivineMain() {
    let question = $('#input-chat').value.trim() || '此卦何解？';
    if (question.length > MAX_QUESTION_LEN) question = question.slice(0, MAX_QUESTION_LEN);
    if (!state.currentResult) {
        showToast('请先进行起卦操作', 'error');
        return;
    }
    $('#ai-chat').classList.remove('hidden');
    $('#chat-input-area').classList.add('hidden');
    $('#btn-divine').classList.add('hidden');



    await performAIAnalysis(question, renderHistory);
}

async function handleChatFollowUp() {
    const input = $('#chat-user-input');
    const question = input.value.trim().slice(0, MAX_QUESTION_LEN);
    if (!question) return;

    input.value = '';
    addMessage($('#chat-messages'), { role: 'user', content: question });
    scrollChat($('#chat-messages'), true);

    await performAIAnalysis(question, renderHistory);
}

function renderResult(result, isNew = true) {
    if (isNew) {
        state.lastRecordId = null;
        state.modelAnalyses = [];
        $('#chat-messages').innerHTML = '';
    }
    renderResultView($('#hexagram-display'), result, isNew);
    
    // 权限检测：简化版用户隐藏排盘，专业版用户显示排盘
    if (hasProAccess()) {
        $('#hexagram-display').classList.remove('hidden');  // 管理员/付费用户：显示完整排盘
    } else {
        $('#hexagram-display').classList.add('hidden');  // 普通用户：隐藏排盘
    }
    
    $('#btn-divine').classList.remove('hidden');
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
