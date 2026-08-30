#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
printf '\n● From Here v1.0.0 · Setup\n\n'
FAIL=0
check_cmd(){ if command -v "$1" >/dev/null 2>&1; then printf '✓ %-18s %s\n' "$1" "$($1 --version 2>/dev/null | head -1)"; else printf '✗ %-18s 未安装\n' "$1"; FAIL=1; fi; }
check_cmd node
check_cmd ncm-cli
if command -v nowplaying-cli >/dev/null 2>&1; then printf '✓ %-18s 已安装\n' 'nowplaying-cli'; else printf '✗ %-18s 未安装\n' 'nowplaying-cli'; FAIL=1; fi
printf '\n网易云播放器模式：\n'; ncm-cli config get player 2>/dev/null || true
printf '\n网易云登录状态：\n'; ncm-cli login --check 2>/dev/null || true
if [ "$FAIL" -ne 0 ]; then printf '\n缺少依赖：npm install -g @music163/ncm-cli；brew install nowplaying-cli\n'; else printf '\n✓ 基础运行依赖齐全。\n'; fi
if node bridge/import-ai-config.js --quiet >/dev/null 2>&1; then
  node - <<'NODE'
const fs=require('fs');try{const c=JSON.parse(fs.readFileSync('bridge/config.local.json','utf8'));console.log(`✓ AI 默认跟随本机${c.ai?.model?`：${c.ai.model}`:''}（Key 未显示）`)}catch{}
NODE
else
  printf '○ 未发现完整本机 AI 配置；可运行 configure-ai.command。\n'
fi
printf '\nChrome 扩展目录：\n  %s/extension\n' "$ROOT"
printf '\n加载 extension/ 后运行 start.command。\n\n'
read -n 1 -s -r -p "按任意键关闭"
