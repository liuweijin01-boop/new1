#!/usr/bin/env bash
# 一键安装：卡片渲染依赖 + 公众号发布(wenyan-mcp) + 小红书 MCP(xiaohongshu-mcp)
# 用法：bash scripts/setup.sh        （macOS Apple Silicon / Linux x64；Windows 请看 README 手动步骤）
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> 1/4 安装 Node 依赖（需要 Node.js ≥ 18）"
command -v node >/dev/null || { echo "请先安装 Node.js：https://nodejs.org"; exit 1; }
npm install
npx playwright install chromium

echo "==> 2/4 安装公众号排版发布工具 wenyan-mcp"
npm install -g @wenyan-md/mcp

echo "==> 3/4 下载小红书 MCP（xpzouying/xiaohongshu-mcp）"
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) PLATFORM=darwin-arm64 ;;
  Linux-x86_64) PLATFORM=linux-amd64 ;;
  *) echo "当前平台不在官方预编译列表，请改用 Docker 或 x-mcp 浏览器插件版，见 README"; PLATFORM="" ;;
esac
if [ -n "$PLATFORM" ]; then
  mkdir -p tools
  BASE=https://github.com/xpzouying/xiaohongshu-mcp/releases/latest/download
  for bin in xiaohongshu-mcp xiaohongshu-login; do
    [ -f "tools/$bin" ] || curl -fL "$BASE/$bin-$PLATFORM" -o "tools/$bin"
    chmod +x "tools/$bin"
  done
fi

echo "==> 4/4 渲染示例卡片，验证环境"
node scripts/render-cards.mjs examples/demo/cards.md
node scripts/check.mjs examples/demo/note.md

cat <<'EOF'

✅ 安装完成。接下来：
  1. cp .env.example .env，填写公众号 AppID / AppSecret，并把本机公网 IP 加到公众号后台白名单
  2. 小红书扫码登录：./tools/xiaohongshu-login
  3. 启动小红书服务（保持这个终端开着）：./tools/xiaohongshu-mcp
  4. 新终端：source .env && claude      然后说「帮我做账号定位」或「开始创作」
EOF
