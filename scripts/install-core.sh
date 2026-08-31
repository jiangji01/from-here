#!/bin/bash
set -u
ROOT="${FROM_HERE_ROOT:?FROM_HERE_ROOT missing}"
BRIDGE="${FROM_HERE_BRIDGE_DIR:?FROM_HERE_BRIDGE_DIR missing}"
EXTENSION="${FROM_HERE_EXTENSION_DIR:?FROM_HERE_EXTENSION_DIR missing}"
CONFIGURE_CMD="${FROM_HERE_CONFIGURE_CMD:?FROM_HERE_CONFIGURE_CMD missing}"
VERSION="1.1.0"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

say(){ printf '%s\n' "$1"; }
ask_yes(){ local prompt="$1"; local ans; read -r -p "$prompt [Y/n] " ans; case "$ans" in n|N|no|NO) return 1;; *) return 0;; esac; }

printf '\n● From Here %s · Install\n\n' "$VERSION"
if [ "$(uname -s)" != "Darwin" ]; then say '✗ 当前版本仅支持 macOS。'; exit 1; fi

# Official Releases source runtime-env.sh before this script, so bundled Node +
# ncm-cli are already on PATH. Keep the developer/source fallback for local builds,
# but do not expose implementation dependencies to normal Release users.
if [ "${FROM_HERE_BUNDLED_RUNTIME:-0}" = "1" ]; then
  if ! command -v node >/dev/null 2>&1 || ! command -v ncm-cli >/dev/null 2>&1; then
    say '✗ From Here Runtime 不完整。请重新下载当前 Release。'
    exit 1
  fi
  say '✓ From Here Runtime 已就绪'
else
  if ! command -v node >/dev/null 2>&1; then
    say '✗ 开发环境尚未检测到 Node.js 18+。'
    say '  Source 模式需要开发者自行准备 Node.js 与 @music163/ncm-cli。'
    exit 1
  fi
  NODE_MAJOR=$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0)
  if [ "$NODE_MAJOR" -lt 18 ]; then say "✗ Node.js 版本过低：$(node --version)。需要 18+。"; exit 1; fi
  say "✓ Node.js $(node --version)"

  if ! command -v ncm-cli >/dev/null 2>&1; then
    say '○ 开发环境尚未安装 @music163/ncm-cli。'
    if ask_yes '现在通过 npm 安装到这台 Mac？'; then npm install -g @music163/ncm-cli || exit 1; else exit 1; fi
  fi
  say '✓ ncm-cli 已安装'
fi

printf '\nmacOS 当前歌曲\n────────────\n'
MEDIA_SCRIPT="$BRIDGE/now-playing-jxa.js"
MEDIA_OK=0
if [ -x /usr/bin/osascript ] && [ -f "$MEDIA_SCRIPT" ]; then
  MEDIA_OUT=$(/usr/bin/osascript -l JavaScript "$MEDIA_SCRIPT" 2>&1 || true)
  if printf '%s' "$MEDIA_OUT" | grep -q '"ok":true'; then
    MEDIA_OK=1
    say '✓ 使用 macOS 系统媒体接口读取当前歌曲'
    say '  不需要 Homebrew，不下载额外媒体组件。'
  fi
fi
if [ "$MEDIA_OK" -eq 0 ] && command -v nowplaying-cli >/dev/null 2>&1; then
  if nowplaying-cli get title >/dev/null 2>&1; then
    MEDIA_OK=1
    say '✓ macOS 系统媒体接口不可用；已启用本机 nowplaying-cli 兼容回退'
  fi
fi
if [ "$MEDIA_OK" -eq 0 ]; then
  say '✗ 无法初始化 macOS 当前歌曲读取能力。'
  say '  From Here 1.1 不再下载安装 Homebrew/媒体二进制；这是系统媒体接口本身未能响应。'
  say '  请运行 Support/Diagnose.command 查看具体原因。'
  exit 1
fi

# Friendly NetEase onboarding. Never drop a first-time user straight into the raw
# ncm-cli credential prompt without context. A skipped authorization does not
# block AI settings or Chrome extension setup.
NETEASE_READY=1
FROM_HERE_ROOT="$ROOT" bash "$SCRIPT_DIR/configure-netease.sh" || NETEASE_READY=0
if [ "$NETEASE_READY" -eq 0 ]; then
  say '○ 网易云授权尚未完成；其它安装步骤继续。'
fi

printf '\nAI\n'
if node "$BRIDGE/import-ai-config.js" --quiet >/dev/null 2>&1; then
  node - "$BRIDGE/config.local.json" <<'NODE'
const fs=require('fs');const file=process.argv[2];
try{const c=JSON.parse(fs.readFileSync(file,'utf8'));const m=c.ai?.model||c.ai?.localModel||'';console.log(`✓ 已发现本机 AI 配置${m?`：${m}`:''}`)}catch{console.log('✓ 已发现本机 AI 配置')}
NODE
  if ! ask_yes '默认跟随这份本机 AI 配置？'; then "$CONFIGURE_CMD"; fi
else
  say '○ 未发现完整的本机 AI 配置。'
  if ask_yes '现在配置 AI Provider？'; then "$CONFIGURE_CMD"; else say '  已跳过；From Here 会使用本地排序兜底。'; fi
fi

printf '\nChrome Extension\n'
say "✓ 扩展目录：$EXTENSION"
say '  Chrome → chrome://extensions/ → 开发者模式 → 加载未打包的扩展程序。'
say '  选择上面的 Chrome Extension 文件夹。'
if [ -d "$EXTENSION" ]; then open "$EXTENSION" >/dev/null 2>&1 || true; fi

printf '\n安装检查完成。\n'
say '下一步：加载扩展后，双击 Start.command，然后在网易云播放一首歌。'
printf '\n'
read -n 1 -s -r -p '按任意键关闭'
printf '\n'
