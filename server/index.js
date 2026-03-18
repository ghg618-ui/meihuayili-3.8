/**
 * 梅花义理 AI 代理服务器
 * 运行在 Mac Mini 上，把 API 密钥藏在服务端，用户永远看不到
 *
 * 启动方式：
 *   cd server
 *   npm install
 *   cp .env.example .env     ← 填入你的密钥
 *   npm start
 */

import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';
import { createTransport } from 'nodemailer';

// 加载 .env 文件（密钥就放这里）
try {
    const __dir = dirname(fileURLToPath(import.meta.url));
    const env = readFileSync(join(__dir, '.env'), 'utf8');
    for (const line of env.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx < 0) continue;
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (key && !process.env[key]) process.env[key] = val;
    }
} catch {
    // .env 不存在时继续（可以直接用系统环境变量）
}

// ===== 配置区 =====
const PORT = process.env.PORT || 3210;
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 120000);
const ANALYSIS_TEMPERATURE = 0.35;

// 多条线路，自动按顺序备用
const ROUTES = [
    {
        name: '主线（SiliconFlow DeepSeek R1）',
        endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
        key: process.env.SF_API_KEY,
        model: 'deepseek-ai/DeepSeek-R1',
    },
    {
        name: '备线（DeepSeek 官方）',
        endpoint: 'https://api.deepseek.com/chat/completions',
        key: process.env.DS_API_KEY,
        model: 'deepseek-reasoner',
    },
];

// 允许访问的来源（你的域名）
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://meihuayili.com,http://localhost:5173')
    .split(',')
    .map(s => s.trim());
// =================

const app = express();

app.use(cors({
    origin: (origin, cb) => {
        // 允许无 origin（curl 测试用）或白名单内的来源
        if (!origin || ALLOWED_ORIGINS.some(o => origin === o || origin.endsWith('.meihuayili.com'))) {
            cb(null, true);
        } else {
            cb(new Error(`不允许的来源: ${origin}`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '1mb' }));

// ===== 托管前端静态文件（国内加速） =====
const __serverDir = dirname(fileURLToPath(import.meta.url));
const distPath = join(__serverDir, '..', 'dist');
if (existsSync(distPath)) {
    // assets 目录（带哈希的 JS/CSS）长期缓存
    app.use('/assets', express.static(join(distPath, 'assets'), { maxAge: '30d' }));
    // 其他文件（HTML、manifest等）不缓存，每次都拿最新
    app.use(express.static(distPath, { maxAge: 0, etag: false }));
}

// ===== 健康检查 =====
app.get('/health', (_req, res) => {
    const configured = ROUTES.filter(r => r.key).map(r => r.name);
    res.json({
        status: 'ok',
        configured,
        time: new Date().toISOString(),
    });
});

// ===== 数据存储层 =====
const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, 'data');
const USERS_FILE = join(DATA_DIR, 'users.json');
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');
const HISTORY_DIR = join(DATA_DIR, 'history');
const SESSION_COOKIE_NAME = 'meihua_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 180;

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(HISTORY_DIR)) mkdirSync(HISTORY_DIR, { recursive: true });

// ===== 邮件发送 =====
const mailTransporter = createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER || '1742249@qq.com',
        pass: process.env.SMTP_PASS || 'tgdnhnterrzmbhbi',
    },
});

// 验证码内存存储 { email: { code, expires, attempts } }
const verifyCodeStore = new Map();

function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendVerifyEmail(toEmail, code) {
    await mailTransporter.sendMail({
        from: '"梅花义理" <1742249@qq.com>',
        to: toEmail,
        subject: '梅花义理 - 验证码',
        html: `
            <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 24px; border: 1px solid #e0d0e0; border-radius: 12px;">
                <h2 style="color: #5d2b5d; text-align: center;">梅花义理 · AI 断卦</h2>
                <p style="font-size: 14px; color: #555;">您的验证码为：</p>
                <p style="font-size: 28px; font-weight: bold; text-align: center; color: #5d2b5d; letter-spacing: 6px; margin: 20px 0;">${code}</p>
                <p style="font-size: 13px; color: #999;">验证码 10 分钟内有效，请勿泄露给他人。</p>
            </div>
        `,
    });
}

function loadUsers() {
    try { return JSON.parse(readFileSync(USERS_FILE, 'utf8')); }
    catch { return {}; }
}
function saveUsers(users) {
    writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function loadSessions() {
    try { return JSON.parse(readFileSync(SESSIONS_FILE, 'utf8')); }
    catch { return {}; }
}

function saveSessions(sessions) {
    writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

function pruneExpiredSessions(sessions) {
    let changed = false;
    const now = Date.now();
    for (const [token, session] of Object.entries(sessions)) {
        if (!session?.expiresAt || session.expiresAt <= now) {
            delete sessions[token];
            changed = true;
        }
    }
    if (changed) saveSessions(sessions);
}

function createSession(name) {
    const sessions = loadSessions();
    pruneExpiredSessions(sessions);
    const token = randomBytes(24).toString('hex');
    sessions[token] = {
        name,
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_TTL_MS,
    };
    saveSessions(sessions);
    return token;
}

function getCookieValue(req, cookieName) {
    const cookieHeader = req.headers.cookie || '';
    const target = cookieHeader
        .split(';')
        .map(part => part.trim())
        .find(part => part.startsWith(`${cookieName}=`));
    if (!target) return null;
    return decodeURIComponent(target.slice(cookieName.length + 1));
}

function getSessionUser(req) {
    const token = getCookieValue(req, SESSION_COOKIE_NAME);
    if (!token) return null;

    const sessions = loadSessions();
    pruneExpiredSessions(sessions);
    const session = sessions[token];
    if (!session?.name) return null;

    session.expiresAt = Date.now() + SESSION_TTL_MS;
    sessions[token] = session;
    saveSessions(sessions);

    return { token, name: session.name };
}

function destroySession(token) {
    if (!token) return;
    const sessions = loadSessions();
    if (sessions[token]) {
        delete sessions[token];
        saveSessions(sessions);
    }
}

function setSessionCookie(res, token) {
    res.cookie(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: SESSION_TTL_MS,
        path: '/',
    });
}

function clearSessionCookie(res) {
    res.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
    });
}

function requireSessionUser(req, res, rawName) {
    const name = normalizeName(rawName);
    if (!name || !safeFileName(name)) {
        res.status(400).json({ error: '用户名无效' });
        return null;
    }

    const sessionUser = getSessionUser(req);
    if (!sessionUser?.name) {
        clearSessionCookie(res);
        res.status(401).json({ error: '请先登录' });
        return null;
    }

    if (sessionUser.name !== name) {
        res.status(403).json({ error: '无权限访问该历史记录' });
        return null;
    }

    return name;
}

// 用户名只能包含字母、数字、下划线、中文，防止路径遍历
const SAFE_NAME_RE = /^[\w\u4e00-\u9fa5]{1,20}$/;
function safeFileName(name) {
    if (!SAFE_NAME_RE.test(name)) return null;
    return name.toLowerCase();
}

// 统一将用户名转小写，避免大小写不同导致重复账户
function normalizeName(raw) {
    return (raw || '').trim().toLowerCase();
}

// ===== 用户注册 =====
app.post('/api/register', (req, res) => {
    const { passwordHash, email } = req.body;
    const name = normalizeName(req.body.name);
    if (!name || !passwordHash) return res.status(400).json({ error: '缺少用户名或密码' });
    if (!SAFE_NAME_RE.test(name)) return res.status(400).json({ error: '用户名格式不合法' });

    const users = loadUsers();
    if (users[name]) return res.status(409).json({ error: '用户已存在' });

    // 如果提供了邮箱，检查格式
    const cleanEmail = (email || '').trim().toLowerCase();
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: '邮箱格式不正确' });
    }

    users[name] = { name, passwordHash, email: cleanEmail || '', created: new Date().toISOString() };
    saveUsers(users);
    setSessionCookie(res, createSession(name));
    console.log(`[auth] 新用户注册: ${name}${cleanEmail ? ' (' + cleanEmail + ')' : ''}`);
    res.json({ success: true, user: { name } });
});

// ===== 用户登录 =====
app.post('/api/login', (req, res) => {
    const { passwordHash } = req.body;
    const name = normalizeName(req.body.name);
    if (!name || !passwordHash) return res.status(400).json({ error: '缺少用户名或密码' });

    const users = loadUsers();
    const u = users[name];
    if (!u) {
        return res.status(404).json({ error: '用户尚未注册', code: 'USER_NOT_FOUND' });
    }
    if (u.passwordHash === passwordHash || u.password === passwordHash) {
        console.log(`[auth] 用户登录: ${name}`);
        setSessionCookie(res, createSession(name));
        res.json({ success: true, user: { name, hasEmail: !!u.email } });
    } else {
        res.status(401).json({ error: '密码错误', code: 'WRONG_PASSWORD' });
    }
});

app.get('/api/session/current', (req, res) => {
    const sessionUser = getSessionUser(req);
    if (!sessionUser?.name) {
        clearSessionCookie(res);
        return res.status(401).json({ success: false });
    }

    const users = loadUsers();
    const user = users[sessionUser.name];
    if (!user) {
        destroySession(sessionUser.token);
        clearSessionCookie(res);
        return res.status(401).json({ success: false });
    }

    setSessionCookie(res, sessionUser.token);
    res.json({ success: true, user: { name: user.name, hasEmail: !!user.email } });
});

app.post('/api/logout', (req, res) => {
    const token = getCookieValue(req, SESSION_COOKIE_NAME);
    destroySession(token);
    clearSessionCookie(res);
    res.json({ success: true });
});

// ===== 管理员统计 =====
const ADMIN_LIST = ['admin', 'gonghg'];
app.get('/api/admin/stats', (req, res) => {
    const admin = normalizeName(req.query.admin);
    if (!admin || !ADMIN_LIST.includes(admin)) {
        return res.status(403).json({ error: '无权限' });
    }
    const users = loadUsers();
    const userList = Object.values(users).map(u => ({ name: u.name, email: u.email || '', created: u.created }));
    res.json({ totalUsers: userList.length, users: userList });
});

// ===== 绑定邮箱 =====
app.post('/api/bind-email', (req, res) => {
    const name = normalizeName(req.body.name);
    const { email } = req.body;
    if (!name || !email) return res.status(400).json({ error: '缺少用户名或邮箱' });

    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: '邮箱格式不正确' });
    }

    const users = loadUsers();
    if (!users[name]) return res.status(404).json({ error: '用户不存在' });

    users[name].email = cleanEmail;
    saveUsers(users);
    console.log(`[auth] 用户绑定邮箱: ${name} -> ${cleanEmail}`);
    res.json({ success: true });
});

// ===== 修改密码 =====
app.post('/api/change-password', (req, res) => {
    const name = normalizeName(req.body.name);
    const { oldPasswordHash, newPasswordHash } = req.body;
    if (!name || !oldPasswordHash || !newPasswordHash) {
        return res.status(400).json({ error: '缺少必填字段' });
    }
    const users = loadUsers();
    const u = users[name];
    if (!u) return res.status(404).json({ error: '用户不存在' });

    if (u.passwordHash !== oldPasswordHash && u.password !== oldPasswordHash) {
        return res.status(401).json({ error: '当前密码不正确' });
    }

    users[name].passwordHash = newPasswordHash;
    delete users[name].password;
    saveUsers(users);
    console.log(`[auth] 用户修改密码: ${name}`);
    res.json({ success: true });
});

// ===== 管理员重置密码 =====
app.post('/api/admin/reset-password', (req, res) => {
    const admin = normalizeName(req.body.admin);
    const targetUser = normalizeName(req.body.targetUser);
    const { newPasswordHash } = req.body;
    if (!admin || !ADMIN_LIST.includes(admin)) {
        return res.status(403).json({ error: '无权限' });
    }
    if (!targetUser || !newPasswordHash) {
        return res.status(400).json({ error: '缺少目标用户名或新密码' });
    }
    const users = loadUsers();
    if (!users[targetUser]) {
        return res.status(404).json({ error: '用户不存在' });
    }
    users[targetUser].passwordHash = newPasswordHash;
    saveUsers(users);
    console.log(`[admin] 密码重置: ${targetUser} (by ${admin})`);
    res.json({ success: true, message: `已重置 ${targetUser} 的密码` });
});

// ===== 发送验证码（忘记密码） =====
app.post('/api/send-code', async (req, res) => {
    const name = normalizeName(req.body.name);
    if (!name) return res.status(400).json({ error: '请输入用户名' });

    const users = loadUsers();
    const u = users[name];
    if (!u) return res.status(404).json({ error: '用户不存在' });
    if (!u.email) return res.status(400).json({ error: '该账号未绑定邮箱，请联系微信公众号 易泓录 重置密码' });

    // 防刷：同一邮箱60秒内只能发一次
    const existing = verifyCodeStore.get(u.email);
    if (existing && existing.expires > Date.now() && (existing.expires - Date.now()) > 9 * 60 * 1000) {
        return res.status(429).json({ error: '验证码已发送，请稍后再试' });
    }

    const code = generateCode();
    verifyCodeStore.set(u.email, { code, expires: Date.now() + 10 * 60 * 1000, attempts: 0 });

    try {
        await sendVerifyEmail(u.email, code);
        // 对邮箱脱敏显示
        const masked = u.email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.min(b.length, 4)) + c);
        console.log(`[mail] 验证码已发送: ${name} -> ${u.email}`);
        res.json({ success: true, maskedEmail: masked });
    } catch (e) {
        console.error('[mail] 发送失败:', e.message);
        res.status(500).json({ error: '验证码发送失败，请稍后再试' });
    }
});

// ===== 验证码重置密码 =====
app.post('/api/reset-password', (req, res) => {
    const name = normalizeName(req.body.name);
    const { code, newPasswordHash } = req.body;
    if (!name || !code || !newPasswordHash) {
        return res.status(400).json({ error: '缺少必要信息' });
    }

    const users = loadUsers();
    const u = users[name];
    if (!u || !u.email) return res.status(400).json({ error: '用户不存在或未绑定邮箱' });

    const stored = verifyCodeStore.get(u.email);
    if (!stored || stored.expires < Date.now()) {
        return res.status(400).json({ error: '验证码已过期，请重新发送' });
    }

    // 防暴力：最多尝试5次
    if (stored.attempts >= 5) {
        verifyCodeStore.delete(u.email);
        return res.status(429).json({ error: '验证码错误次数过多，请重新发送' });
    }

    if (stored.code !== code.trim()) {
        stored.attempts++;
        return res.status(400).json({ error: '验证码错误' });
    }

    // 验证通过，重置密码
    users[name].passwordHash = newPasswordHash;
    saveUsers(users);
    verifyCodeStore.delete(u.email);
    console.log(`[auth] 用户自助重置密码: ${name}`);
    res.json({ success: true });
});

// ===== 历史记录保存 =====
app.post('/api/history/save', (req, res) => {
    const { username, records } = req.body;
    const name = requireSessionUser(req, res, username);
    if (!name) return;
    const filePath = join(HISTORY_DIR, `${safeFileName(name)}.json`);
    writeFileSync(filePath, JSON.stringify(records || [], null, 2));
    res.json({ success: true });
});

// ===== 历史记录读取 =====
app.get('/api/history/load', (req, res) => {
    const { username } = req.query;
    const name = requireSessionUser(req, res, username);
    if (!name) return;
    const filePath = join(HISTORY_DIR, `${safeFileName(name)}.json`);
    try {
        const records = JSON.parse(readFileSync(filePath, 'utf8'));
        res.json({ success: true, records });
    } catch {
        res.json({ success: true, records: [] });
    }
});

// ===== 主代理接口 =====
app.post('/api/chat', async (req, res) => {
    const { messages, mode } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: '缺少 messages 字段' });
    }

    // 找到所有可用线路（按顺序自动降级）
    const availableRoutes = ROUTES.filter(r => r.key && r.key.trim());
    if (availableRoutes.length === 0) {
        return res.status(503).json({ error: '服务器未配置 API 密钥，请联系管理员' });
    }

    // 设置 SSE 流式响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 关闭 nginx 缓冲
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.flushHeaders();

    const clientAbort = new AbortController();
    req.on('close', () => clientAbort.abort()); // 用户断开时终止上游请求

    const fetchWithTimeout = async (route) => {
        let timeoutId = null;
        let fetchAborted = false;

        const timeoutAbort = new AbortController();
        
        timeoutId = setTimeout(() => {
            fetchAborted = true;
            timeoutAbort.abort();
        }, UPSTREAM_TIMEOUT_MS);

        try {
            // 监听用户断开，也中止 fetch
            if (clientAbort.signal.aborted) {
                fetchAborted = true;
                timeoutAbort.abort();
            }

            const upstream = await fetch(route.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${route.key}`,
                },
                body: JSON.stringify({
                    model: route.model,
                    messages,
                    stream: true,
                    max_tokens: 8192,
                    temperature: ANALYSIS_TEMPERATURE,
                }),
                signal: timeoutAbort.signal,
            });
            
            if (timeoutId) clearTimeout(timeoutId);
            return upstream;
        } catch (err) {
            if (timeoutId) clearTimeout(timeoutId);
            throw err;
        }
    };

    try {
        let lastErrMsg = '';

        for (let i = 0; i < availableRoutes.length; i++) {
            const route = availableRoutes[i];
            const hasNext = i < availableRoutes.length - 1;

            try {
                const upstream = await fetchWithTimeout(route);

                if (!upstream.ok) {
                    const errText = await upstream.text().catch(() => '');
                    lastErrMsg = `${route.name} 返回 ${upstream.status}: ${errText.slice(0, 200)}`;
                    if (hasNext) continue;
                    res.write(`data: ${JSON.stringify({ error: `上游错误 ${lastErrMsg}` })}\n\n`);
                    return res.end();
                }

                // 透明转发 SSE 数据流
                const reader = upstream.body.getReader();
                const decoder = new TextDecoder();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    res.write(chunk);
                    // 强制立即发出，避免 Cloudflare / 中间层攒包
                    if (typeof res.flush === 'function') {
                        res.flush();
                    } else if (res.socket && !res.socket.destroyed) {
                        res.socket.uncork?.();
                        res.socket.cork?.();
                    }
                }

                return res.end();
            } catch (err) {
                if (err.name === 'AbortError' && clientAbort.signal.aborted) {
                    return;
                }

                const isTimeout = err?.name === 'AbortError';
                lastErrMsg = isTimeout
                    ? `${route.name} 连接超时（>${UPSTREAM_TIMEOUT_MS}ms）`
                    : `${route.name} 请求失败: ${err.message}`;

                if (hasNext) continue;
                res.write(`data: ${JSON.stringify({ error: lastErrMsg })}\n\n`);
                return res.end();
            }
        }

        res.write(`data: ${JSON.stringify({ error: lastErrMsg || '所有上游线路均不可用' })}\n\n`);
        res.end();
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('[proxy]', err.message);
            if (!res.headersSent) {
                res.status(500).json({ error: '代理请求失败: ' + err.message });
            } else {
                res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
                res.end();
            }
        }
    }
});

// ===== SPA 回退：非API请求返回 index.html =====
if (existsSync(distPath)) {
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api/') || req.path === '/health') return;
        res.sendFile(join(distPath, 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`\n🌸 梅花义理代理服务已启动`);
    console.log(`   本地访问: http://localhost:${PORT}`);
    console.log(`   健康检查: http://localhost:${PORT}/health`);
    const configured = ROUTES.filter(r => r.key).map(r => r.name);
    if (configured.length === 0) {
        console.warn('\n⚠️  警告：未找到任何 API 密钥，请在 .env 文件中配置 SF_API_KEY');
    } else {
        console.log(`   已配置线路: ${configured.join(' | ')}`);
    }
    console.log('');
});
