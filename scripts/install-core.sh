#!/bin/bash
set -u
ROOT="${FROM_HERE_ROOT:?FROM_HERE_ROOT missing}"
BRIDGE="${FROM_HERE_BRIDGE_DIR:?FROM_HERE_BRIDGE_DIR missing}"
EXTENSION="${FROM_HERE_EXTENSION_DIR:?FROM_HERE_EXTENSION_DIR missing}"
CONFIGURE_CMD="${FROM_HERE_CONFIGURE_CMD:?FROM_HERE_CONFIGURE_CMD missing}"
VERSION="1.0.0"

say(){ printf '%s\n' "$1"; }
ask_yes(){ local prompt="$1"; local ans; read -r -p "$prompt [Y/n] " ans; case "$ans" in n|N|no|NO) return 1;; *) return 0;; esac; }

printf '\n● From Here %s · Install\n\n' "$VERSION"
if [ "$(uname -s)" != "Darwin" ]; then say '✗ 当前版本仅支持 macOS。'; exit 1; fi

# Homebrew is only needed to install missing system dependencies.
if ! command -v brew >/dev/null 2>&1; then
  say '○ 未发现 Homebrew。'
  say '  如果 Node.js 和 nowplaying-cli 已经存在，可以继续；否则请先安装 Homebrew：https://brew.sh'
fi

if ! command -v node >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1 && ask_yes '缺少 Node.js。现在通过 Homebrew 安装？'; then brew install node || exit 1; else say '✗ From Here 需要 Node.js 18+。'; exit 1; fi
fi
NODE_MAJOR=$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -lt 18 ]; then say "✗ Node.js 版本过低：$(node --version)。需要 18+。"; exit 1; fi
say "✓ Node.js $(node --version)"

if ! command -v ncm-cli >/dev/null 2>&1; then
  if ask_yes '缺少网易云 ncm-cli。现在安装？'; then npm install -g @music163/ncm-cli || exit 1; else exit 1; fi
fi
say '✓ ncm-cli 已安装'

if ! command -v nowplaying-cli >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1 && ask_yes '缺少 nowplaying-cli。现在通过 Homebrew 安装？'; then brew install nowplaying-cli || exit 1; else say '✗ 需要 nowplaying-cli 才能读取 macOS 当前歌曲。'; exit 1; fi
fi
say '✓ nowplaying-cli 已安装'

printf '\n网易云连接\n'
if ! ncm-cli login --check >/dev/null 2>&1; then
  say '○ 尚未检测到可用的网易云登录。'
  say '  首次使用 ncm-cli 需要你自己的网易云开放平台 AppID / PrivateKey。'
  say '  From Here 不读取、保存或上传这些凭证。'
  if ask_yes '如果还没有配置 ncm-cli，现在运行 configure？'; then ncm-cli configure || true; fi
  say '现在启动网易云登录流程…'
  ncm-cli login || true
fi
ncm-cli config set player orpheus >/dev/null 2>&1 || true
say '✓ 播放器模式设为网易云 macOS 客户端（orpheus）'

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
