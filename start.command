#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/bridge" || exit 1
printf '\n● From Here v1.1.0\n'
printf '保持这个窗口开启。Chrome 点击扩展图标会打开 Side Panel。\n\n'
if command -v lsof >/dev/null 2>&1; then
  for PID in $(lsof -tiTCP:19428 -sTCP:LISTEN 2>/dev/null); do
    CMD=$(ps -p "$PID" -o command= 2>/dev/null || true)
    HEALTH=$(curl -fsS --max-time 1 http://127.0.0.1:19428/api/health 2>/dev/null || true)
    if printf '%s' "$CMD" | grep -Eq 'from-here[^ ]*/bridge/server\.js|From-Here-v[^/]+-macOS/\.from-here/bridge/server\.js' || \
       printf '%s' "$HEALTH" | grep -q '"app":"from-here"'; then
      printf '发现旧版 From Here，正在切换到 v1.1.0…\n'
      kill "$PID" 2>/dev/null || true; sleep 0.6
    else
      printf '端口 19428 被其它程序占用：%s\n' "$CMD"; printf '请先释放该端口。\n'; read -n 1 -s -r -p "按任意键关闭"; exit 1
    fi
  done
fi
if [ ! -f config.local.json ]; then node import-ai-config.js --quiet >/dev/null 2>&1 || true; fi
node server.js
