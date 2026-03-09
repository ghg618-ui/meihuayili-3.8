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
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '1mb' }));

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
const HISTORY_DIR = join(DATA_DIR, 'history');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(HISTORY_DIR)) mkdirSync(HISTORY_DIR, { recursive: true });

function loadUsers() {
    try { return JSON.parse(readFileSync(USERS_FILE, 'utf8')); }
    catch { return {}; }
}
function saveUsers(users) {
    writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// 用户名只能包含字母、数字、下划线、中文，防止路径遍历
const SAFE_NAME_RE = /^[\w\u4e00-\u9fa5]{1,20}$/;
function safeFileName(name) {
    if (!SAFE_NAME_RE.test(name)) return null;
    return name;
}

// ===== 用户注册 =====
app.post('/api/register', (req, res) => {
    const { name, passwordHash } = req.body;
    if (!name || !passwordHash) return res.status(400).json({ error: '缺少用户名或密码' });
    if (!SAFE_NAME_RE.test(name)) return res.status(400).json({ error: '用户名格式不合法' });

    const users = loadUsers();
    if (users[name]) return res.status(409).json({ error: '用户已存在' });

    users[name] = { name, passwordHash, created: new Date().toISOString() };
    saveUsers(users);
    console.log(`[auth] 新用户注册: ${name}`);
    res.json({ success: true, user: { name } });
});

// ===== 用户登录 =====
app.post('/api/login', (req, res) => {
    const { name, passwordHash } = req.body;
    if (!name || !passwordHash) return res.status(400).json({ error: '缺少用户名或密码' });

    const users = loadUsers();
    const u = users[name];
    if (u && (u.passwordHash === passwordHash || u.password === passwordHash)) {
        console.log(`[auth] 用户登录: ${name}`);
        res.json({ success: true, user: { name } });
    } else {
        res.status(401).json({ error: '用户名或密码错误' });
    }
});

// ===== 管理员统计 =====
const ADMIN_LIST = ['admin', 'gonghg'];
app.get('/api/admin/stats', (req, res) => {
    const { admin } = req.query;
    if (!admin || !ADMIN_LIST.includes(admin)) {
        return res.status(403).json({ error: '无权限' });
    }
    const users = loadUsers();
    const userList = Object.values(users).map(u => ({ name: u.name, created: u.created }));
    res.json({ totalUsers: userList.length, users: userList });
});

// ===== 历史记录保存 =====
app.post('/api/history/save', (req, res) => {
    const { username, records } = req.body;
    if (!username || !safeFileName(username)) return res.status(400).json({ error: '用户名无效' });
    const filePath = join(HISTORY_DIR, `${safeFileName(username)}.json`);
    writeFileSync(filePath, JSON.stringify(records || [], null, 2));
    res.json({ success: true });
});

// ===== 历史记录读取 =====
app.get('/api/history/load', (req, res) => {
    const { username } = req.query;
    if (!username || !safeFileName(username)) return res.status(400).json({ error: '用户名无效' });
    const filePath = join(HISTORY_DIR, `${safeFileName(username)}.json`);
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
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no'); // 关闭 nginx 缓冲
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
