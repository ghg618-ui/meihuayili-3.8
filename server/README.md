# 梅花义理 — Mac Mini 代理服务器

这个服务运行在你的 Mac Mini 上，把硅基流动/DeepSeek 的 API 密钥完全藏在本地，用户永远看不到。

---

## 第一次启动（只需做一次）

打开 Mac 上的"终端"App，复制粘贴以下命令逐行执行：

```bash
# 1. 进入 server 目录
cd "/Users/gonghg/Downloads/ai project/梅花义理 v3.8/server"

# 2. 安装依赖（只需一次）
npm install

# 3. 创建密钥配置文件
cp .env.example .env
```

然后用文本编辑器打开 `server/.env` 文件，把你的硅基流动密钥填进去：
```
SF_API_KEY=sk-你的密钥填这里
```

---

## 日常启动

每次开机后，打开终端执行：

```bash
cd "/Users/gonghg/Downloads/ai project/梅花义理 v3.8/server"
npm start
```

看到 `🌸 梅花义理代理服务已启动` 就说明成功了。

**测试是否正常：** 浏览器打开 http://localhost:3210/health，显示 `{"status":"ok",...}` 即可。

---

## 让 Mac Mini 开机自动启动（可选）

```bash
# 创建 launchd 服务（开机自启）
cat > ~/Library/LaunchAgents/com.meihua.proxy.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.meihua.proxy</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/gonghg/Downloads/ai project/梅花义理 v3.8/server/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/gonghg/Downloads/ai project/梅花义理 v3.8/server</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/meihua-proxy.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/meihua-proxy-error.log</string>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.meihua.proxy.plist
```

---

## 第二阶段：开通外网访问（Cloudflare Tunnel）

服务器在本地启动后，需要让 meihuayili.com 的请求能到达你家 Mac Mini。

```bash
# 1. 安装 cloudflared
brew install cloudflare/cloudflare/cloudflared

# 2. 登录（会打开浏览器，授权你的 Cloudflare 账号）
cloudflared tunnel login

# 3. 创建隧道
cloudflared tunnel create meihua-proxy

# 4. 配置路由（把 api.meihuayili.com 指向本地 3210 端口）
cloudflared tunnel route dns meihua-proxy api.meihuayili.com

# 5. 启动（保持终端开着）
cloudflared tunnel --url http://localhost:3210 run meihua-proxy
```

完成后告诉我，我把前端的 PROXY_BASE_URL 改为 `https://api.meihuayili.com`，就彻底切换到安全代理模式了。
