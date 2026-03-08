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
import { readFileSync } from 'fs';
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
    methods: ['POST', 'OPTIONS'],
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

// ===== 主代理接口 =====
app.post('/api/chat', async (req, res) => {
    const { messages, mode } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: '缺少 messages 字段' });
    }

    // 找到第一条可用线路
    const route = ROUTES.find(r => r.key && r.key.trim());
    if (!route) {
        return res.status(503).json({ error: '服务器未配置 API 密钥，请联系管理员' });
    }

    // 设置 SSE 流式响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no'); // 关闭 nginx 缓冲
    res.flushHeaders();

    const controller = new AbortController();
    req.on('close', () => controller.abort()); // 用户断开时终止上游请求

    try {
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
            signal: controller.signal,
        });

        if (!upstream.ok) {
            const errText = await upstream.text().catch(() => '');
            res.write(`data: ${JSON.stringify({ error: `上游错误 ${upstream.status}: ${errText.slice(0, 200)}` })}\n\n`);
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
