// Authority: Universal Interaction Entry Point
window.handleDivine = window.startDivination = function () {
    console.log('--- GLOBAL DIVINE TRIGGER ---');
    if (window._dispatchDivine) {
        window._dispatchDivine();
    } else {
        console.error('Core Engine Not Ready');
        alert('系统核心引擎加载中，请稍后再试。如果此消息持续出现，请尝试刷新页面。');
    }
};

(function () {
    'use strict';

    // ===================== Model Registry =====================
    // 每个选项对应的 provider、默认模型名、默认端点
    const MODEL_REGISTRY = {
        'deepseek-r1': {
            provider: 'deepseek',
            model: 'deepseek-reasoner',
            label: 'DeepSeek R1',
            supportsReasoning: true,
        },
        'qwen3-thinking': {
            provider: 'siliconflow',
            model: 'Qwen/Qwen3-235B-A22B-Thinking-2507',
            label: 'Qwen3 Thinking',
            supportsReasoning: true,
        },
    };

    // Provider 默认端点
    const PROVIDER_DEFAULTS = {
        deepseek: {
            endpoint: 'https://api.deepseek.com/v1/chat/completions',
        },
        kimi: {
            endpoint: 'https://api.moonshot.cn/v1/chat/completions',
        },
        qwen: {
            endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        },
        gemini: {
            endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        },
        siliconflow: {
            endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
        },
    };

    // ===================== State =====================
    let currentResult = null;
    let selectedModelKey = localStorage.getItem('selected_model') || 'deepseek-r1';
    let currentUser = null;
    let divinationHistory = [];
    let lastRecordId = null;
    let currentAbortController = null;
    let modelAnalyses = []; // Track multiple model analyses for current hexagram

    // Provider configs loaded from localStorage
    let providerConfigs = loadProviderConfigs();

    // Auth mode: 'login' or 'register'
    let authMode = 'login';

    // ===================== Password Hashing (cyrb53) =====================
    function hashPassword(str) {
        const seed = 0x5D2B5D;
        const salt = 'meihua_yili_v3';
        str = salt + str + salt;
        let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
        for (let i = 0; i < str.length; i++) {
            const ch = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
        h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
        h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
    }

    // Get per-user history storage key
    function getUserHistoryKey() {
        return currentUser ? `meihua_history_${currentUser.name}` : null;
    }

    // Get all registered users from localStorage
    function getRegisteredUsers() {
        try {
            return JSON.parse(localStorage.getItem('meihua_users') || '{}');
        } catch (e) {
            console.error('Failed to parse users registry', e);
            return {};
        }
    }

    // Save users registry to localStorage
    function saveRegisteredUsers(users) {
        localStorage.setItem('meihua_users', JSON.stringify(users));
    }

    // Show auth error message
    function showAuthMsg(msg, type = 'error') {
        const errEl = document.getElementById('auth-msg-error');
        const sucEl = document.getElementById('auth-msg-success');
        if (type === 'error') {
            if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
            if (sucEl) { sucEl.style.display = 'none'; }
        } else {
            if (sucEl) { sucEl.textContent = msg; sucEl.style.display = 'block'; }
            if (errEl) { errEl.style.display = 'none'; }
        }
    }

    function clearAuthMsg() {
        const errEl = document.getElementById('auth-msg-error');
        const sucEl = document.getElementById('auth-msg-success');
        if (errEl) errEl.style.display = 'none';
        if (sucEl) sucEl.style.display = 'none';
    }

    // Switch auth mode (login / register)
    function switchAuthMode(mode) {
        authMode = mode;
        const tabLogin = document.getElementById('tab-login');
        const tabRegister = document.getElementById('tab-register');
        const confirmGroup = document.getElementById('confirm-password-group');
        const submitBtn = document.getElementById('btn-auth-submit');

        clearAuthMsg();

        if (mode === 'register') {
            if (tabLogin) tabLogin.classList.remove('active');
            if (tabRegister) tabRegister.classList.add('active');
            if (confirmGroup) confirmGroup.classList.remove('hidden');
            if (submitBtn) submitBtn.textContent = '注册并进入';
        } else {
            if (tabLogin) tabLogin.classList.add('active');
            if (tabRegister) tabRegister.classList.remove('active');
            if (confirmGroup) confirmGroup.classList.add('hidden');
            if (submitBtn) submitBtn.textContent = '登录';
        }
    }

    // ===================== Global Bridge (Defined early for resilience) =====================
    window.handleDivine = function () {
        console.log('Bridge: Divine Signal Received');
        try {
            if (typeof handleDivineInternal === 'function') {
                handleDivineInternal();
            } else {
                alert('易理组件尚未就绪，请稍后（或检查控制台是否有初始化报错）');
            }
        } catch (e) {
            alert('断卦执行链路崩溃: ' + e.message);
        }
    };
    window.startDivination = window.handleDivine;

    // ===================== DOM References =====================
    const $ = (id) => document.getElementById(id);
    const $$ = (sel) => document.querySelectorAll(sel);

    // Casting & Sidebar
    const castingGrid = $$('.cast-card');
    const historyListEl = $('history-list');
    const userNameLabel = $('user-name-label');
    const userAvatar = $('user-avatar');

    // Time mode
    const castTimePicker = $('cast-time-picker');
    const btnTimeNow = $('btn-time-now');
    const castShichenLabel = $('cast-shichen-label');

    // Manual mode selects
    const selectUpper = $('select-upper');
    const selectLower = $('select-lower');

    // Hexagram display
    const hexDisplay = $('hexagram-display');

    // Chat
    const chatMessages = $('chat-messages');
    const inputChat = $('input-chat');
    const btnDivine = $('btn-divine');
    const chatStatus = $('chat-status');
    const modelSelect = $('model-select');



    // ===================== Initialize =====================
    function init() {
        try {
            console.log('System: Initializing Modules...');
            populateSelects();
            setCurrentTimeToPicker();
            bindEvents();
            updateCurrentTimeHeader();

            // Safe Auth & History
            try { checkAuth(); } catch (e) { console.error('Auth Init Fail', e); }
            try { loadHistory(); } catch (e) { console.error('History Init Fail', e); }

            // Restore selected model
            if (modelSelect) {
                modelSelect.value = selectedModelKey;
            }

            // Sidebar Toggle (Mobile Friendly)
            const toggleBtn = $('sidebar-toggle');
            const sidebar = $('app-sidebar');

            // Default collapse on mobile
            if (window.innerWidth < 900) {
                sidebar.classList.add('collapsed');
            }

            if (toggleBtn && sidebar) {
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    sidebar.classList.toggle('collapsed');
                });
            }

            // Close sidebar when clicking main content on mobile
            $('app-main').addEventListener('click', () => {
                if (window.innerWidth < 900) {
                    sidebar.classList.add('collapsed');
                }
            });
            console.log('System: Initialization Complete');
        } catch (criticalErr) {
            alert('系统初始化致命错误: ' + criticalErr.message);
            console.error(criticalErr);
        }
    }

    // Floating Divine Button
    if (btnDivine) {
        btnDivine.onclick = (e) => {
            e.stopPropagation();
            window.startDivination();
        };
    }

    // New Case Action
    const btnNewCase = $('btn-new-case');
    if (btnNewCase) {
        btnNewCase.addEventListener('click', () => {
            lastRecordId = null;
            inputChat.value = '';
            modelAnalyses = [];
            $('divination-console').classList.remove('hidden');
            hexDisplay.classList.add('hidden');
            btnDivine.classList.add('hidden');
            chatMessages.innerHTML = '';
            renderHistory();
            showToast('已准备好新的起卦', 'info');
        });
    }

    function populateSelects() {
        for (const [idx, tri] of Object.entries(TRIGRAMS)) {
            const opt1 = new Option(`${tri.name} ${tri.symbol} (${tri.nature}·${tri.element})`, idx);
            const opt2 = new Option(`${tri.name} ${tri.symbol} (${tri.nature}·${tri.element})`, idx);
            selectUpper.appendChild(opt1);
            selectLower.appendChild(opt2);
        }
    }

    function updateCurrentTimeHeader() {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        const shichen = getShichen(now.getHours());
        $('current-time').textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${h}:${m}:${s} ${shichen.name}时`;
    }

    function setCurrentTimeToPicker() {
        if (!castTimePicker) return;
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        castTimePicker.value = `${hh}:${mm}`;
        updateShichenLabel();
    }

    function updateShichenLabel() {
        if (!castTimePicker || !castTimePicker.value) return;
        const [h, m] = castTimePicker.value.split(':');
        const shichen = getShichen(parseInt(h));
        if (castShichenLabel) {
            castShichenLabel.textContent = `${shichen.name}时`;
        }
    }

    // ===================== Event Binding =====================
    function bindEvents() {
        if (castTimePicker) {
            castTimePicker.addEventListener('input', updateShichenLabel);
        }
        if (btnTimeNow) {
            btnTimeNow.addEventListener('click', setCurrentTimeToPicker);
        }

        // Cast buttons
        $('btn-cast-time').addEventListener('click', castByTime);
        $('btn-cast-number').addEventListener('click', castByNumber);
        $('btn-cast-manual').addEventListener('click', castByManual);

        // Model switcher
        modelSelect.addEventListener('change', () => {
            selectedModelKey = modelSelect.value;
            localStorage.setItem('selected_model', selectedModelKey);
            const reg = MODEL_REGISTRY[selectedModelKey];
            showToast(`已切换至 ${reg.label}`, 'success');
        });

        // Chat & Case Recognition
        inputChat.addEventListener('input', () => {
            const text = inputChat.value.trim();
            const btnQuick = $('btn-quick-parse');
            const hint = $('hero-hint');

            // Show console again if user clears the input (new investigation)
            if (!text) {
                $('divination-console').classList.remove('hidden');
            }

            if (text.length > 3) {
                const parsed = DivinationEngine.parseFromText(text);
                if (parsed) {
                    btnQuick.classList.remove('hidden');
                    hint.innerHTML = `✨ 识别到卦象：<strong>${parsed.original.name}</strong>。可直接点击按钮分析。`;
                    return;
                }
            }
            btnQuick.classList.add('hidden');
            hint.textContent = `💡 请在此输入问题起卦，或直接输入历史卦象（如：山火贲 五爻动）。`;
        });

        inputChat.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                window.startDivination();
            }
        });

        // Atomic bindings
        const btnQuick = $('btn-quick-parse');
        if (btnQuick) btnQuick.onclick = window.startDivination;

        // Auth & Settings
        $('user-trigger').addEventListener('click', () => {
            if (!currentUser) {
                switchAuthMode('login');
                // Clear fields
                $('auth-username').value = '';
                $('auth-password').value = '';
                const confirmPwd = $('auth-confirm-password');
                if (confirmPwd) confirmPwd.value = '';
                clearAuthMsg();
                $('modal-auth').classList.remove('hidden');
            }
        });

        const btnLogout = $('btn-logout-header');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                console.log('Logout button clicked');
                logout();
            });
        }

        $('btn-close-auth').addEventListener('click', () => $('modal-auth').classList.add('hidden'));

        // Auth tabs switching
        const tabLogin = $('tab-login');
        const tabRegister = $('tab-register');
        if (tabLogin) tabLogin.addEventListener('click', () => switchAuthMode('login'));
        if (tabRegister) tabRegister.addEventListener('click', () => switchAuthMode('register'));

        // Auth submit handler (delegates to login or register)
        $('btn-auth-submit').addEventListener('click', () => {
            if (authMode === 'register') {
                register();
            } else {
                login();
            }
        });

        // Allow Enter key to submit auth form
        ['auth-username', 'auth-password', 'auth-confirm-password'].forEach(id => {
            const el = $(id);
            if (el) {
                el.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (authMode === 'register') register(); else login();
                    }
                });
            }
        });



        [$('modal-auth')].forEach(m => {
            if (m) m.addEventListener('click', (e) => {
                if (e.target === m) m.classList.add('hidden');
            });
        });

        $('btn-sync-history').addEventListener('click', loadHistory);


    }

    // ===================== Auth & History Logic =====================
    function checkAuth() {
        const saved = localStorage.getItem('meihua_user');
        const btnLogout = $('btn-logout-header');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Verify this user still exists in registry
                const users = getRegisteredUsers();
                if (users[parsed.name]) {
                    currentUser = parsed;
                    userNameLabel.textContent = currentUser.name;
                    userAvatar.textContent = currentUser.name.charAt(0);
                    if (btnLogout) btnLogout.style.display = 'block';
                } else {
                    // User was deleted or data is stale
                    localStorage.removeItem('meihua_user');
                    currentUser = null;
                    if (btnLogout) btnLogout.style.display = 'none';
                }
            } catch (e) {
                console.error('Failed to parse user data from localStorage', e);
                localStorage.removeItem('meihua_user');
                if (btnLogout) btnLogout.style.display = 'none';
            }
        } else {
            if (btnLogout) btnLogout.style.display = 'none';
        }
    }

    function login() {
        const name = $('auth-username').value.trim();
        const password = $('auth-password').value;

        if (!name) return showAuthMsg('请输入用户名');
        if (!password) return showAuthMsg('请输入密码');

        const users = getRegisteredUsers();
        let user = users[name];
        const inputHash = hashPassword(password);

        if (!user) {
            // Auto-register to prevent "cannot login" confusion when cache is cleared
            users[name] = {
                passwordHash: inputHash,
                createdAt: Date.now()
            };
            saveRegisteredUsers(users);
            user = users[name];
        } else {
            if (user.passwordHash !== inputHash) {
                return showAuthMsg('密码错误，请重试');
            }
        }

        // Login successful
        currentUser = { name, id: user.createdAt };
        localStorage.setItem('meihua_user', JSON.stringify(currentUser));
        if (userNameLabel) userNameLabel.textContent = currentUser.name;
        if (userAvatar) userAvatar.textContent = currentUser.name.charAt(0);

        const btnLogout = $('btn-logout-header');
        if (btnLogout) btnLogout.style.display = 'block';

        $('modal-auth').classList.add('hidden');
        showToast(`欢迎进入断卦系统，${name}`, 'success');
        loadHistory();
    }

    function register() {
        const name = $('auth-username').value.trim();
        const password = $('auth-password').value;
        const confirmPassword = $('auth-confirm-password').value;

        if (!name) return showAuthMsg('请输入用户名');
        if (name.length < 2) return showAuthMsg('用户名至少需要2个字符');
        if (name.length > 20) return showAuthMsg('用户名不能超过20个字符');
        if (!password) return showAuthMsg('请输入密码');
        if (password.length < 4) return showAuthMsg('密码至少需要4个字符');
        if (password !== confirmPassword) return showAuthMsg('两次输入的密码不一致');

        const users = getRegisteredUsers();

        if (users[name]) {
            return showAuthMsg('该用户名已被注册，请换一个');
        }

        // Register new user
        users[name] = {
            passwordHash: hashPassword(password),
            createdAt: Date.now()
        };
        saveRegisteredUsers(users);

        // Auto-login after registration
        currentUser = { name, id: users[name].createdAt };
        localStorage.setItem('meihua_user', JSON.stringify(currentUser));
        userNameLabel.textContent = currentUser.name;
        userAvatar.textContent = currentUser.name.charAt(0);

        const btnLogout = $('btn-logout-header');
        if (btnLogout) btnLogout.style.display = 'block';

        $('modal-auth').classList.add('hidden');
        showToast(`注册成功，欢迎 ${name}！`, 'success');
        loadHistory();
    }

    function logout() {
        localStorage.removeItem('meihua_user');
        currentUser = null;
        userNameLabel.textContent = '未登录';
        userAvatar.textContent = '?';

        const btnLogout = $('btn-logout-header');
        if (btnLogout) btnLogout.style.display = 'none';

        divinationHistory = [];
        lastRecordId = null;
        renderHistory();
        showToast('已退出院馆', 'info');
    }

    function saveToHistory(record) {
        if (!currentUser) return null;
        const storageKey = getUserHistoryKey();
        if (!storageKey) return null;
        let history = [];
        try {
            history = JSON.parse(localStorage.getItem(storageKey) || '[]');
        } catch (e) {
            history = [];
        }
        const id = Date.now();
        const newRecord = {
            id: id,
            user: currentUser.name,
            timestamp: new Date().toLocaleString(),
            ...record
        };
        history.unshift(newRecord);
        if (history.length > 50) history.pop();
        localStorage.setItem(storageKey, JSON.stringify(history));
        loadHistory();
        return id;
    }

    function updateHistoryEntry(id, data) {
        const storageKey = getUserHistoryKey();
        if (!storageKey) return;
        let history = [];
        try {
            history = JSON.parse(localStorage.getItem(storageKey) || '[]');
        } catch (e) {
            console.error('Failed to parse history from localStorage during update', e);
            return;
        }
        const idx = history.findIndex(item => item.id === id);
        if (idx !== -1) {
            history[idx] = { ...history[idx], ...data };
            localStorage.setItem(storageKey, JSON.stringify(history));
            loadHistory();
        }
    }

    function loadHistory() {
        if (!currentUser) {
            divinationHistory = [];
            renderHistory();
            return;
        }
        const storageKey = getUserHistoryKey();
        try {
            divinationHistory = JSON.parse(localStorage.getItem(storageKey) || '[]');
        } catch (e) {
            console.error('Failed to parse history from localStorage', e);
            divinationHistory = [];
        }
        renderHistory();
    }

    function renderHistory() {
        if (!historyListEl) return;
        if (!currentUser) {
            historyListEl.innerHTML = '<div class="history-empty">仅对院馆主客开放，<br>请先由右上角登录。</div>';
            return;
        }
        if (divinationHistory.length === 0) {
            historyListEl.innerHTML = '<div class="history-empty">暂无回响，请先起卦</div>';
            return;
        }

        historyListEl.innerHTML = divinationHistory.map(item => `
            <div class="history-item ${lastRecordId === item.id ? 'active' : ''}" data-id="${item.id}">
                <div class="history-item-top">
                    <span class="history-item-name">${item.result.original.name}</span>
                    <span class="history-item-time" style="font-size: 0.75rem; color: var(--text-tertiary); font-weight: normal;">${item.timestamp.split(' ')[0]}</span>
                </div>
                <div class="history-item-desc">${item.question || '未设问'}</div>
                <div class="history-delete-btn" title="删除记录">🗑️</div>
            </div>
        `).join('');

        // Re-attach listeners after rendering
        $$('.history-item').forEach(el => {
            el.addEventListener('click', (e) => {
                // Precise check for delete button or its children
                if (e.target.closest('.history-delete-btn')) return;

                const id = el.dataset.id;
                console.log('History: Click to load ID:', id);
                const record = divinationHistory.find(h => String(h.id) === String(id));

                if (record) {
                    try {
                        // Mark active
                        lastRecordId = record.id;
                        renderHistory();

                        currentResult = record.result;
                        inputChat.value = record.question || '';

                        // Ensure main components are visible
                        hexDisplay.classList.remove('hidden');
                        $('ai-chat').classList.remove('hidden');

                        renderResult(currentResult, false); // false = isNew

                        // Explicitly hide the casting console when a history case is active
                        $('divination-console').classList.add('hidden');

                        // Restore chat messages
                        chatMessages.innerHTML = '';
                        if (record.analyses && record.analyses.length > 0) {
                            modelAnalyses = [...record.analyses];
                            addAnalysisToChat(record.analysis, record.reasoning, record.analyses);
                        } else if (record.analysis) {
                            modelAnalyses = [{ // Migrate old single record to new format
                                modelKey: 'legacy',
                                modelLabel: '历史记录',
                                content: record.analysis,
                                reasoning: record.reasoning
                            }];
                            addAnalysisToChat(record.analysis, record.reasoning);
                        } else {
                            modelAnalyses = [];
                            addSystemMessage('该历史记录尚未进行 AI 断卦分析。');
                        }

                        showToast('已调取历史卦例', 'info');
                    } catch (err) {
                        console.error('Failed to load history record:', err);
                        showToast('载入案例时出错，请尝试刷新。', 'error');
                    }
                }
            });

            // Delete button click
            const delBtn = el.querySelector('.history-delete-btn');
            if (delBtn) {
                delBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const id = el.dataset.id;
                    if (!id) return;

                    // Brief visual feedback before the confirm or action
                    el.style.opacity = '0.5';

                    if (confirm('确定要永久删除这条卦例记录吗？')) {
                        deleteHistoryEntry(id, el);
                    } else {
                        el.style.opacity = '1';
                    }
                });
            }
        });
    }

    function deleteHistoryEntry(id, elementToRemove = null) {
        console.log('History: Robust Delete triggered for ID:', id);
        try {
            const storageKey = getUserHistoryKey();
            if (!storageKey) {
                showToast('尚未登录，无法删除记录', 'error');
                return;
            }

            let history = [];
            try {
                history = JSON.parse(localStorage.getItem(storageKey) || '[]');
            } catch (pErr) {
                console.error('History: Parse error during delete', pErr);
                history = [];
            }

            const initialLength = history.length;
            // Extremely robust filtering: targetId as string for comparison
            const targetIdStr = String(id);
            const newHistory = history.filter(item => String(item.id) !== targetIdStr);

            if (newHistory.length === initialLength) {
                console.warn('History: Match fail using strict string. Trying loose...', { targetIdStr });
                // Fallback to loose check
                const newerHistory = history.filter(item => item.id != id);
                if (newerHistory.length === initialLength) {
                    showToast('删除失败：未匹配到对应条目', 'error');
                    if (elementToRemove) elementToRemove.style.opacity = '1';
                    return;
                }
                localStorage.setItem(storageKey, JSON.stringify(newerHistory));
            } else {
                localStorage.setItem(storageKey, JSON.stringify(newHistory));
            }

            console.log('History: LocalStorage updated successfully.');

            // Immediate UI feedback with animation
            if (elementToRemove) {
                elementToRemove.style.transition = 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
                elementToRemove.style.transform = 'translateX(-100%)';
                elementToRemove.style.opacity = '0';
                setTimeout(() => {
                    elementToRemove.style.height = '0';
                    elementToRemove.style.padding = '0';
                    elementToRemove.style.margin = '0';
                    elementToRemove.style.border = '0';
                }, 150);
                setTimeout(() => elementToRemove.remove(), 400);
            }

            // Sync global state
            divinationHistory = JSON.parse(localStorage.getItem(storageKey) || '[]');

            // Handle active case reset
            if (lastRecordId && String(lastRecordId) === targetIdStr) {
                lastRecordId = null;
                if (chatMessages) chatMessages.innerHTML = '';
                if (hexDisplay) hexDisplay.classList.add('hidden');
                const consoleEl = $('divination-console');
                if (consoleEl) consoleEl.classList.remove('hidden');
                if (btnDivine) btnDivine.classList.add('hidden');
            }

            // Sync render after shorter delay
            setTimeout(() => renderHistory(), 450);
            showToast('卦例已从馆内移出', 'success');

        } catch (err) {
            console.error('History: Fatal Delete Error', err);
            showToast('删除系统异常: ' + err.message, 'error');
            if (elementToRemove) elementToRemove.style.opacity = '1';
        }
    }

    function addAnalysisToChat(content, reasoning = null, analyses = null) {
        if (!chatMessages) return;

        // Remove welcome
        const welcome = chatMessages.querySelector('.chat-welcome');
        if (welcome) welcome.remove();

        // If there are multiple analyses, render in comparison panel
        if (analyses && analyses.length > 1) {
            const panel = document.createElement('div');
            panel.className = 'model-comparison-panel';

            analyses.forEach(a => {
                const col = document.createElement('div');
                col.className = 'model-column';
                let colHtml = `<div class="model-column-header"><span class="model-dot"></span>${a.modelLabel || '模型'}</div>`;
                colHtml += '<div class="model-column-content">';
                if (a.reasoning) {
                    colHtml += `<details class="thinking-block"><summary>💭 思考过程</summary><pre>${escapeHtml(a.reasoning)}</pre></details>`;
                }
                colHtml += formatMarkdown(a.content);
                colHtml += '</div>';
                colHtml += `<div class="model-column-status">✅ 已完成</div>`;
                col.innerHTML = colHtml;
                panel.appendChild(col);
            });

            chatMessages.appendChild(panel);
        } else {
            // Single analysis - original behavior
            const div = document.createElement('div');
            div.className = 'chat-message assistant';
            let html = '';
            if (reasoning) {
                html += `<details class="thinking-block" open><summary>💭 历史思考过程</summary><pre>${escapeHtml(reasoning)}</pre></details>`;
            }
            html += formatMarkdown(content);
            div.innerHTML = html;
            chatMessages.appendChild(div);
        }
        scrollChat();
    }
    // ===================== Casting Actions =====================
    function castByTime() {
        if (!castTimePicker || !castTimePicker.value) {
            showToast('请选择起卦时间', 'error');
            return;
        }
        const [hourStr, minuteStr] = castTimePicker.value.split(':');
        const hour = parseInt(hourStr);
        const minute = parseInt(minuteStr);

        currentResult = DivinationEngine.castByTime(hour, minute);
        renderResult(currentResult);
        addSystemMessage(`✅ 时间起卦成功：${hour}时${minute}分 → ${currentResult.original.name}`);
    }

    function castByNumber() {
        const num1 = parseInt($('input-num1').value);
        const num2 = parseInt($('input-num2').value);
        const num3Str = $('input-num3').value;
        const num3 = num3Str ? parseInt(num3Str) : NaN;

        if (isNaN(num1) || isNaN(num2) || num1 < 1 || num2 < 1) {
            showToast('请输入有效的前两个正整数', 'error');
            return;
        }

        if (!isNaN(num3) && num3 > 0) {
            currentResult = DivinationEngine.castByThreeNumbers(num1, num2, num3);
            addSystemMessage(`✅ 三数起卦成功：${num1}, ${num2}, ${num3} → ${currentResult.original.name}`);
        } else {
            currentResult = DivinationEngine.castByTwoNumbers(num1, num2);
            addSystemMessage(`✅ 两数起卦成功：${num1}, ${num2} → ${currentResult.original.name}`);
        }
        renderResult(currentResult);
    }

    function castByManual() {
        const upper = parseInt(selectUpper.value);
        const lower = parseInt(selectLower.value);
        const yao = parseInt($('select-yao').value);

        if (!upper || !lower || !yao) {
            showToast('请选择上卦、下卦和动爻', 'error');
            return;
        }

        currentResult = DivinationEngine.castManual(upper, lower, yao);
        renderResult(currentResult);
        addSystemMessage(`✅ 手动选卦成功：${currentResult.original.name}，第${yao}爻动`);
    }

    // ===================== Render Result =====================
    function renderResult(result, isNew = true) {
        hexDisplay.classList.remove('hidden');
        btnDivine.classList.remove('hidden'); // Floating button

        // Hide casting console when reviewing history or focused on results
        if (!isNew) {
            $('divination-console').classList.add('hidden');
        }

        // Month info
        const mi = result.energy.monthInfo;
        const nextDateStr = mi.nextJieDate ? GanzhiCalendar.formatJieDate(mi.nextJieDate) : '';
        if ($('month-info-label')) {
            $('month-info-label').textContent = `${mi.jieQi}后 · ${mi.branch}月(${mi.element})能量场${nextDateStr ? ' → ' + mi.nextJieQi + ' ' + nextDateStr : ''}`;
        }

        // Render Cards with energy
        const monthElement = result.energy.monthInfo.element;

        renderHexCard('original', result.original, result.movingYao, monthElement, result.movingYao);
        renderHexCard('changed', result.changed, null, monthElement, result.movingYao);
        renderHexCard('opposite', result.opposite, null, monthElement, result.movingYao);

        renderTiYong(result);

        if (isNew) {
            lastRecordId = saveToHistory({
                question: inputChat.value.trim(),
                result: result,
                analyses: modelAnalyses // Save current analyses with the record
            });
        }

        // Scroll into view safely
        setTimeout(() => {
            hexDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    function renderHexCard(type, hexData, movingYao, monthElement, originalMovingYao) {
        const cardEl = $(`hex-${type}-card`);
        if (!cardEl) return;

        // Energy mapping
        const uEnergy = getEnergyState(hexData.upperTrigram.element, monthElement);
        const lEnergy = getEnergyState(hexData.lowerTrigram.element, monthElement);
        const getEnergyClass = (e) => ({ '旺': 'energy-wang', '相': 'energy-xiang', '休': 'energy-xiu', '囚': 'energy-qiu', '死': 'energy-si' }[e] || '');

        // Determine Ti/Yong based on the original moving line (1-3 is lower, 4-6 is upper)
        let upperBadge = '';
        let lowerBadge = '';
        if (originalMovingYao) {
            // 张延生理论：动爻所在卦为体。
            if (originalMovingYao >= 4) {
                upperBadge = '<span class="tiyong-badge-mini ti-bg">体</span>';
                lowerBadge = '<span class="tiyong-badge-mini yong-bg">用</span>';
            } else {
                upperBadge = '<span class="tiyong-badge-mini yong-bg">用</span>';
                lowerBadge = '<span class="tiyong-badge-mini ti-bg">体</span>';
            }
        }

        // Inject high-precision grid
        cardEl.innerHTML = `
            <div class="hex-card-header">${type === 'original' ? '本卦' : type === 'changed' ? '变卦' : '错卦'}</div>
            <div class="hex-main-grid">
                <div class="trigram-info-left">
                    <div class="tri-energy-group">
                        ${upperBadge}
                        <div class="tri-text-block">
                            <span class="tri-text">${hexData.upperTrigram.name}${hexData.upperTrigram.element}</span>
                            <span class="tri-energy-state ${getEnergyClass(uEnergy)}">${uEnergy}</span>
                        </div>
                    </div>
                    <div class="tri-energy-group">
                        ${lowerBadge}
                        <div class="tri-text-block">
                            <span class="tri-text">${hexData.lowerTrigram.name}${hexData.lowerTrigram.element}</span>
                            <span class="tri-energy-state ${getEnergyClass(lEnergy)}">${lEnergy}</span>
                        </div>
                    </div>
                </div>
                <div class="hex-symbol" id="hex-${type}-symbol-inner"></div>
                <div class="marker-area" id="hex-${type}-marker-area"></div>
            </div>
            <div class="hex-name">${hexData.name}</div>
        `;

        const symbolInner = $(`hex-${type}-symbol-inner`);
        if (!symbolInner) return;

        // Draw Lines & Marker
        const lines = hexData.lines;
        for (let i = 5; i >= 0; i--) {
            const lineValue = lines[i];
            const div = document.createElement('div');
            div.className = 'yao-line ' + (lineValue === 1 ? 'yang' : 'yin');

            if (lineValue === 0) {
                const s1 = document.createElement('div'); s1.className = 'yin-segment';
                const s2 = document.createElement('div'); s2.className = 'yin-segment';
                div.appendChild(s1); div.appendChild(s2);
            }

            // Professional Moving Yao Tag
            if (movingYao && i === (movingYao - 1)) {
                div.classList.add('is-moving');
                const marker = document.createElement('div');
                marker.className = 'moving-marker';
                div.appendChild(marker);
            }
            symbolInner.appendChild(div);
        }
    }

    function renderTiYong(result) {
        // Disabled old central bottom TiYong indicator
        // as Ti/Yong is now systematically displayed on the left side of trigrams
    }

    // ===================== Divine Command =====================

    function handleDivineInternal() {
        console.log('Divine System: Start Processing');

        const userName = currentUser ? currentUser.name : '访客';
        const text = (inputChat && inputChat.value) ? inputChat.value.trim() : '';

        // Immediate visual response
        if (btnDivine) {
            btnDivine.style.transform = 'scale(0.95)';
            setTimeout(() => { if (btnDivine) btnDivine.style.transform = 'scale(1)'; }, 150);
            btnDivine.classList.add('pulse-once');
            setTimeout(() => { if (btnDivine) btnDivine.classList.remove('pulse-once'); }, 500);
        }

        if (!text && !currentResult) {
            showToast('请在此输入您的问题，或点击侧边栏加载历史卦例。', 'info');
            return;
        }

        showToast(`🔮 ${userName} 正在启请智慧...`, 'info');

        if (text) {
            const parsed = DivinationEngine.parseFromText(text);
            if (parsed) {
                // Check if it's the same hexagram to avoid wiping comparison mode
                const isSameHex = currentResult &&
                    currentResult.original.name === parsed.original.name &&
                    currentResult.movingLine === parsed.movingLine;

                if (!isSameHex) {
                    currentResult = parsed;
                    modelAnalyses = []; // Truly new hexagram, reset analyses
                    renderResult(parsed);
                    if (text.length < 15 && !text.includes('？') && !text.includes('?')) {
                        addSystemMessage(`✅ 卦象已更新，您可以继续针对此卦提问。`);
                        return;
                    }
                }
            }
        }

        if (!currentResult) {
            showToast('请先进行起卦操作。', 'error');
            return;
        }

        const reg = MODEL_REGISTRY[selectedModelKey];
        if (!reg) {
            showToast('未选择模型', 'error');
            return;
        }

        const config = providerConfigs[reg.provider] || {};
        if (!config.key) {
            showToast(`设置中缺少 ${reg.label} 的 API Key`, 'error');
            if (modalSettings) modalSettings.classList.remove('hidden');
            return;
        }

        // Check if this model already has an analysis for this hexagram
        const existingIdx = modelAnalyses.findIndex(a => a.modelKey === selectedModelKey);
        if (existingIdx !== -1) {
            showToast(`${reg.label} 已有分析结果，请切换其他模型进行对比`, 'info');
            return;
        }

        const question = text || '请对此卦象进行全方位的断卦分析。';
        const payload = DivinationEngine.buildPayload(currentResult, question);
        const isComparison = modelAnalyses.length > 0;

        if (!isComparison) {
            // First model - show as user message
            addMessage('user', `🔮 [断卦请求] ${question}`);
        } else {
            addSystemMessage(`🔄 引入 ${reg.label} 进行对比分析...`);
        }

        sendToAI(JSON.stringify(payload, null, 2), buildSystemPrompt(), isComparison, reg.label, selectedModelKey);
    }
    function buildSystemPrompt() {
        return `你是一位精通《周易》的易学大师。你掌握了一套融合了张延生结构学、高岛义理学与传统五行旺衰法的高级断卦体系。你不再仅仅是算命先生，而是“高维主体的战略决策导师”。你的核心视角是“主体本位”——不侧重算“客观事情的成败”，而是推演“主体在特定时空下，该用何种能量与姿态去回应世界，从而主导事物走向”。

【核心指令】
在所有推演中，必须强制引入“月令（季节）”作为五行能量的最高仲裁者。

————————
【前置起卦算法】（如用户未提供具体卦象，后台自动执行）
“⚠️时空获取首要指令：在开始任何起卦运算前，如果你具备内置系统时间接口或联网搜索功能，请务必先自行检索并确认当前的【公历年月日与具体时间】。如果确认无法通过系统或网络获取，再向用户索要。”

* 八卦基础数：乾1，兑2，离3，震4，巽5，坎6，艮7，坤8。
* 时辰对应数（24小时制）：子1(23-1点)，丑2(1-3)，寅3(3-5)，卯4(5-7)，辰5(7-9)，巳6(9-11)，午7(11-13)，未8(13-15)，申9(15-17)，酉10(17-19)，戌11(19-21)，亥12(21-23)。
* 取余运算铁律：除以8若余数为0则视为8；除以6若余数为0则视为6。

* 三种起卦模式（⚠️严禁AI擅自转换变量概念！必须严格按以下规则提取数字）：
    1. 时间起卦法（适用于用户主动报出具体时间，如“16:27”，或AI自动获取当前系统时间）：
       - 变量锁死：【时数】直接取24小时制的数字（如16）；【分数】直接取分钟数字（如27）；【时辰数】取该时间对应的地支序号（如16:27属申时，取9）。
       - 上卦 = 【时数】 ÷ 8 的余数（如16÷8余0，取8坤卦。绝不可将时数16先转为9再除）。
       - 下卦 = 【分数】 ÷ 8 的余数。
       - 动爻 = (【时数】+【分数】+【时辰数】) ÷ 6 的余数。
    2. 两数起卦法（用户报了两个数，如 5, 12）：
       - 上卦=(数1÷8余数)；下卦=(数2÷8余数)；动爻=(数1+数2+起卦时的时辰数) ÷ 6余数。
    3. 三数起卦法（用户报了三个数，如 12, 5, 18）：
       - 上卦=(数1÷8余数)；下卦=(数2÷8余数)；动爻=(数1+数2+数3) ÷ 6余数。（此法绝对不加时辰数）。

（⚠️系统强制防呆预警：若按模式1或2起卦，且你作为AI无法自动获取系统的真实“日期与时间”，或者用户只报了“时分(如16:27)”却没报“月份/日期”，请立即停止运算！必须回复：“时空参数缺失，请补充起卦的具体【月份/日期】与【时间】，否则无法进行月令校准启动引擎。”）

————————————
一、 根基法则：结构与能量场
⚠️【五行生克及八卦属性底座字典（严禁AI自行脑补，必须严格按此核对）】
* 八卦五行： 乾兑属金，震巽属木，坎属水，离属火，坤艮属土。
* 五行相生（单向，绝不可逆）： 金生水，水生木，木生火，火生土，土生金。
* 五行相克（单向，绝不可逆）： 金克木，木克土，土克水，水克火，火克金。
* 对卦（错卦）算法绝对指令： 必须将变卦的六个爻阴阳全部颠倒（阳爻变阴爻，阴爻变阳爻），得出的新经卦组合即为对卦。

1. 体用定性——【动为体，静为用】
   * 含有动爻的经卦为“体”（核心/主体/我）；不含动爻的经卦为“用”（环境/客体/事/他）。
   * 在本卦锁定体用位置（上/下）后，全流程贯穿不变。

2. 时间切片——【ZYS 三维时空观】
   * 本卦（缘起 / 动机与现实的体检） -> 变卦（过程 / 发展推演与破局导航） -> 对卦（终局 / 执行方略后的应许之地）。
   * 注：对卦 = 变卦的错卦（六爻阴阳全反）。

3. 月令能量校准（The Season Filter）
   * 第一步：获取月令。提取起卦日期对应的干支历“月令”（如“寅月属木”）。
   * 第二步：判定旺衰。根据月令五行，对三卦中的“体”和“用”进行能量打分：
     - 旺（同月令）：能量极强，吉凶成倍。
     - 相（月令生）：能量强，有后劲。
     - 休（生月令）、囚（克月令）、死（被月令克）：能量微弱，有心无力。
   * 第三步：系统修正铁律。
     - 用生体本吉，但用休囚死 = 虚情假意，口头支票。
     - 体克用本吉，但体休囚死 = 有心无力，驾驭不了。
     - 体用比和本吉，但用休囚死 = 空有好心，自身虚弱帮不上。
     - 体生用本凶，但体旺 = 我有余力施舍，虽耗无妨。
     - 用克体本凶，但用休囚死或体旺 = 有惊无险，对方没力气或我实力强不受伤害。

二、 灵魂法则：主体本位的三段战略断法

* 第一段：本卦【缘起——动机与现实的体检报告】
  分析主体的起心动念（体）与客观环境（用）的初次碰撞。结合月令，评估主体的初始能量是否具备现实支撑？主观意图与客观时空是相合共振（顺势），还是相背受制（逆势）？精准定位事件开端的能量格局。

* 第二段：变卦与爻辞【过程——发展推演与破局导航】
  分析事物推进过程中，环境客观条件的变化以及主体能量状态的演变（变卦体用生克）。将动爻爻辞视为“天道给予的最高战略方略”，它剥离了主观情绪，直接指导主体在当前阶段应当如何进退、取舍或发力。爻辞拥有一票否决权，指示着最优的“战术密码”。

* 第三段：对卦【终局——执行方略后的应许之地】
  推演主体在吸纳了爻辞方略、顺应天道调整自身行为后，最终导向的终极心理与现实双重定局（对卦的体用关系）。展示战略执行到位后，主客体能量博弈的最终平衡态。

三、 大师级输出流程
（请严格按照以下结构输出解析，语言须保持客观、中立、直击本质：）

* 【第一步：核心卦象与时空基座】
  - 卦象揭晓：第一句话必须明示占得《XX卦》变《XX卦》，第X爻动。
  - 时空月令：明示起卦的时间坐标，及对应的干支月令与五行。
  - 能量成色：明示体卦与用卦在月令下的【旺/相/休/囚/死】真实状态及成色。
  - 阵列排布：列出 本卦、变卦、对卦 三卦阵列（必须标明哪一卦是体，哪一卦是用）。

* 【第二步：缘起透视 —— 动机的体检报告 (本卦)】
  - 结合卦名本意与五行生克，剖析事件开端的能量格局。指出主体的初始预期是否匹配当前的客观环境，是顺遂还是存在阻碍。

* 【第三步：过程演变与天道方略 (变卦+爻辞)】
  - 过程推演：描述事物发展中环境态势的转变，以及主体随之发生的心境与能量变化（变卦的体用关系）。
  - 天道方略：祭出动爻爻辞（高岛义理），将其翻译为直接的“战略行动指南”。明确告知主体当前最优的应对之策。

* 【第四步：终极定局 —— 执行方略后的应许之地 (对卦)】
  - 描述当主体严格按照爻辞指引采取行动后，事物最终将演化为何种形态，以及主体最终所处的能量状态（对卦的体用关系）。

* 【第五步：大师战略决断】
  - 基于月令校准后的能量“强弱”与爻辞“义理”，给出高度凝练的最终结论与一针见血的落地建议。`;
    }

    // ===================== Multi-Model API Gateway =====================

    /**
     * 根据当前选择的模型，获取 API 配置
     * @returns {{ endpoint: string, key: string, model: string, supportsReasoning: boolean }}
     */
    function getActiveModelConfig() {
        const reg = MODEL_REGISTRY[selectedModelKey];
        const config = providerConfigs[reg.provider];

        const actualModel = reg.model;

        return {
            endpoint: (config && config.endpoint) || PROVIDER_DEFAULTS[reg.provider].endpoint,
            key: (config && config.key) || '',
            model: actualModel,
            label: reg.label,
            supportsReasoning: reg.supportsReasoning,
            provider: reg.provider,
        };
    }

    async function sendToAI(content, systemPrompt, isComparison = false, modelLabel = '', modelKey = '') {
        const modelConfig = getActiveModelConfig();

        if (currentAbortController) {
            currentAbortController.abort();
        }
        currentAbortController = new AbortController();

        const btnStop = document.getElementById('btn-stop-generate');
        if (btnStop) {
            btnStop.classList.remove('hidden');
            btnStop.onclick = () => {
                if (currentAbortController) {
                    currentAbortController.abort();
                }
            };
        }

        if (!modelConfig.key) {
            showToast(`请先在设置中配置 ${modelConfig.label} 的 API Key`, 'error');
            modalSettings.classList.remove('hidden');
            return;
        }

        chatStatus.textContent = `${modelConfig.label} 思考中...`;

        // Determine where to render the output
        let targetEl = null;
        let comparisonPanel = null;

        if (isComparison) {
            // Comparison mode: find or create the comparison panel
            comparisonPanel = chatMessages.querySelector('.model-comparison-panel');

            if (!comparisonPanel) {
                // First comparison: wrap the existing first analysis into a panel
                comparisonPanel = document.createElement('div');
                comparisonPanel.className = 'model-comparison-panel';

                // Move the first model's result into a column
                if (modelAnalyses.length > 0) {
                    const firstAnalysis = modelAnalyses[0];
                    const firstCol = document.createElement('div');
                    firstCol.className = 'model-column';
                    let firstHtml = `<div class="model-column-header"><span class="model-dot"></span>${firstAnalysis.modelLabel}</div>`;
                    firstHtml += '<div class="model-column-content">';
                    if (firstAnalysis.reasoning) {
                        firstHtml += `<details class="thinking-block"><summary>💭 思考过程</summary><pre>${escapeHtml(firstAnalysis.reasoning)}</pre></details>`;
                    }
                    firstHtml += formatMarkdown(firstAnalysis.content);
                    firstHtml += '</div>';
                    firstHtml += `<div class="model-column-status">✅ 已完成</div>`;
                    firstCol.innerHTML = firstHtml;
                    comparisonPanel.appendChild(firstCol);
                }

                // Remove the original standalone assistant message
                const existingMsg = chatMessages.querySelector('.chat-message.assistant');
                if (existingMsg) existingMsg.remove();

                chatMessages.appendChild(comparisonPanel);
            }

            // Create new column for this model
            const newCol = document.createElement('div');
            newCol.className = 'model-column';
            const colId = 'col-' + Date.now();
            newCol.innerHTML = `
                <div class="model-column-header"><span class="model-dot"></span>${modelLabel}</div>
                <div class="model-column-content" id="${colId}">
                    <div class="loading-dots"><span></span><span></span><span></span></div>
                </div>
                <div class="model-column-status streaming">${modelLabel} 分析中...</div>
            `;
            comparisonPanel.appendChild(newCol);
            targetEl = document.getElementById(colId);
            scrollChat();
        } else {
            // Standard mode: add loading indicator
            const loadingId = 'loading-' + Date.now();
            const loadingHtml = `<div class="chat-message assistant" id="${loadingId}"><div class="loading-dots"><span></span><span></span><span></span></div></div>`;
            chatMessages.insertAdjacentHTML('beforeend', loadingHtml);
            scrollChat();
        }

        try {
            const messages = [];
            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }
            messages.push({ role: 'user', content });

            const response = await fetch(modelConfig.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${modelConfig.key}`,
                },
                body: JSON.stringify({
                    model: modelConfig.model,
                    messages,
                    stream: true,
                    max_tokens: 8192
                }),
                signal: currentAbortController.signal
            });

            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                throw new Error(`${modelConfig.label} API 请求失败: ${response.status} ${response.statusText}${errText ? ' — ' + errText.slice(0, 200) : ''}`);
            }

            // Remove standalone loading indicator if not comparison mode
            if (!isComparison) {
                const loadingEls = chatMessages.querySelectorAll('.chat-message.assistant .loading-dots');
                if (loadingEls.length > 0) {
                    const parent = loadingEls[loadingEls.length - 1].closest('.chat-message.assistant');
                    if (parent) parent.remove();
                }
            }

            // Stream response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantContent = '';
            let reasoningContent = '';
            let hasReasoning = false;
            let buffer = '';

            // Create or use target element
            if (!isComparison) {
                const msgId = 'msg-' + Date.now();
                const msgHtml = `<div class="chat-message assistant" id="${msgId}"></div>`;
                chatMessages.insertAdjacentHTML('beforeend', msgHtml);
                targetEl = document.getElementById(msgId);
            }

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
                                if (delta.reasoning_content && modelConfig.supportsReasoning) {
                                    reasoningContent += delta.reasoning_content;
                                    hasReasoning = true;
                                }
                                if (delta.content) {
                                    assistantContent += delta.content;
                                }
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }

                // Update display
                let displayHtml = '';
                if (hasReasoning && reasoningContent) {
                    displayHtml += `<details class="thinking-block" open><summary>💭 思考过程</summary><pre>${escapeHtml(reasoningContent)}</pre></details>`;
                }
                if (assistantContent) {
                    displayHtml += formatMarkdown(assistantContent);
                }
                if (targetEl) {
                    targetEl.innerHTML = displayHtml || '<div class="loading-dots"><span></span><span></span><span></span></div>';
                }
                scrollChat();
            }

            // Record this analysis
            const analysisRecord = {
                modelKey: modelKey || selectedModelKey,
                modelLabel: modelLabel || modelConfig.label,
                content: assistantContent,
                reasoning: reasoningContent,
                timestamp: new Date().toLocaleString()
            };
            modelAnalyses.push(analysisRecord);

            // Update status in comparison column
            if (isComparison && targetEl) {
                const statusEl = targetEl.closest('.model-column')?.querySelector('.model-column-status');
                if (statusEl) {
                    statusEl.textContent = '✅ 已完成';
                    statusEl.classList.remove('streaming');
                }
            }

            // Save to history - store ALL analyses
            if (lastRecordId) {
                updateHistoryEntry(lastRecordId, {
                    analysis: modelAnalyses[0]?.content || assistantContent,
                    reasoning: modelAnalyses[0]?.reasoning || reasoningContent,
                    analyses: modelAnalyses
                });
                showToast('分析结果已保存至卦例馆', 'success');
            }

            chatStatus.textContent = '就绪';
        } catch (error) {
            if (!isComparison) {
                const loadingEls = chatMessages.querySelectorAll('.chat-message.assistant .loading-dots');
                if (loadingEls.length > 0) {
                    const parent = loadingEls[loadingEls.length - 1].closest('.chat-message.assistant');
                    if (parent) parent.remove();
                }
            }

            if (error.name === 'AbortError') {
                if (isComparison && targetEl) {
                    targetEl.innerHTML = '<p style="color: #e74c3c;">⚠️ 分析已中止</p>';
                    const statusEl = targetEl.closest('.model-column')?.querySelector('.model-column-status');
                    if (statusEl) { statusEl.textContent = '已中止'; statusEl.classList.remove('streaming'); }
                } else {
                    addMessage('error', '⚠️ 解析已被中止。');
                }
                chatStatus.textContent = '已中止';
            } else {
                if (isComparison && targetEl) {
                    targetEl.innerHTML = `<p style="color: #e74c3c;">❌ ${escapeHtml(error.message)}</p>`;
                    const statusEl = targetEl.closest('.model-column')?.querySelector('.model-column-status');
                    if (statusEl) { statusEl.textContent = '错误'; statusEl.classList.remove('streaming'); }
                } else {
                    addMessage('error', `❌ ${error.message}`);
                }
                chatStatus.textContent = '错误';
                console.error('API Error:', error);
            }
        } finally {
            currentAbortController = null;
            const btnStop = document.getElementById('btn-stop-generate');
            if (btnStop) btnStop.classList.add('hidden');
        }
    }

    // ===================== Chat Helpers =====================
    function addMessage(role, text) {
        // Remove welcome message
        const welcome = chatMessages.querySelector('.chat-welcome');
        if (welcome) welcome.remove();

        const div = document.createElement('div');
        div.className = `chat-message ${role}`;
        div.innerHTML = role === 'assistant' ? formatMarkdown(text) : escapeHtml(text);
        chatMessages.appendChild(div);
        scrollChat();
    }

    function addSystemMessage(text) {
        const welcome = chatMessages.querySelector('.chat-welcome');
        if (welcome) welcome.remove();

        const div = document.createElement('div');
        div.className = 'chat-message system';
        div.textContent = text;
        chatMessages.appendChild(div);
        scrollChat();
    }

    function scrollChat() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatMarkdown(text) {
        // Simple markdown formatting
        let html = escapeHtml(text);
        // Headers
        html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
        // Bold
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Italic
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        // Line breaks
        html = html.replace(/\n/g, '<br>');
        // Lists
        html = html.replace(/^- (.+)$/gm, '• $1');
        return html;
    }

    // ===================== Toast =====================
    let toastTimer = null;
    function showToast(message, type = 'info') {
        let toast = document.querySelector('.toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.className = `toast ${type}`;

        // Trigger show
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    /**
     * Load provider configs - Hardcoded with placeholders
     */
    function loadProviderConfigs() {
        return {
            deepseek: {
                key: 'sk-57d3217330e3426a91cb71964db8d76e',
                endpoint: 'https://api.deepseek.com/v1/chat/completions'
            },
            siliconflow: {
                key: 'sk-wbhfpdbyrsuciaeyvhykkgebhwaluuugohyngiaacegxkzty',
                endpoint: 'https://api.siliconflow.cn/v1/chat/completions'
            }
        };
    }

    // ===================== Bootstrap =====================
    document.addEventListener('DOMContentLoaded', init);
})();
