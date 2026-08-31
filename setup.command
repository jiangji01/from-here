#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
printf '\n● From Here v1.1.0 · Setup\n\n'
FAIL=0
check_cmd(){ if command -v "$1" >/dev/null 2>&1; then printf '✓ %-18s %s\n' "$1" "$($1 --version 2>/dev/null | head -1)"; else printf '✗ %-18s 未安装\n' "$1"; FAIL=1; fi; }
check_cmd node
check_cmd ncm-cli
if [ -x /usr/bin/osascript ] && [ -f "$ROOT/bridge/now-playing-jxa.js" ]; then
  OUT=$(/usr/bin/osascript -l JavaScript "$ROOT/bridge/now-playing-jxa.js" 2>&1 || true)
  if printf '%s' "$OUT" | grep -q '"ok":true'; then
    printf '✓ %-18s macOS 系统接口（无需额外安装）\n' 'Now Playing'
  elif command -v nowplaying-cli >/dev/null 2>&1; then
    printf '○ %-18s 系统接口未响应；可使用 nowplaying-cli 回退\n' 'Now Playing'
  else
    printf '✗ %-18s macOS 系统接口未响应\n' 'Now Playing'; FAIL=1
  fi
else
  printf '✗ %-18s osascript / adapter 缺失\n' 'Now Playing'; FAIL=1
fi
printf '\n网易云播放器模式：\n'; ncm-cli config get player 2>/dev/null || true
printf '\n网易云授权状态：\n'; ncm-cli login --check 2>/dev/null || true
if [ "$FAIL" -ne 0 ]; then printf '\n有基础能力尚未就绪；请运行 Install.command 获取明确引导。\n'; else printf '\n✓ 基础运行能力齐全。\n'; fi
if command -v node >/dev/null 2>&1 && node bridge/import-ai-config.js --quiet >/dev/null 2>&1; then
  node - <<'NODE'
const fs=require('fs');try{const c=JSON.parse(fs.readFileSync('bridge/config.local.json','utf8'));console.log(`✓ AI 默认跟随本机${c.ai?.model?`：${c.ai.model}`:''}（Key 未显示）`)}catch{}
NODE
else
  printf '○ 未发现完整本机 AI 配置；可运行 configure-ai.command。\n'
fi
printf '\nChrome 扩展目录：\n  %s/extension\n' "$ROOT"
printf '\n加载 extension/ 后运行 start.command。\n\n'
read -n 1 -s -r -p "按任意键关闭"
