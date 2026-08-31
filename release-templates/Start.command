#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
source "$ROOT/.from-here/scripts/runtime-env.sh"
BRIDGE="$ROOT/.from-here/bridge"
DATA="$BRIDGE/.data"
PIDFILE="$DATA/bridge.pid"
LOGFILE="$DATA/bridge.log"
mkdir -p "$DATA"
printf '\n● From Here 1.1.0\n\n'
if ! command -v node >/dev/null 2>&1; then printf '✗ From Here Runtime 不完整：找不到 Node.js。请重新下载当前 Release。\n'; read -n 1 -s -r -p '按任意键关闭'; exit 1; fi

# Stop only a previously recorded From Here process.
if [ -f "$PIDFILE" ]; then
  OLD_PID=$(cat "$PIDFILE" 2>/dev/null || true)
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then kill "$OLD_PID" 2>/dev/null || true; sleep 0.4; fi
fi

# Replace any clearly identified older From Here Bridge, while leaving
# unrelated software on the same port untouched.
if command -v lsof >/dev/null 2>&1; then
  for PID in $(lsof -tiTCP:19428 -sTCP:LISTEN 2>/dev/null); do
    CMD=$(ps -p "$PID" -o command= 2>/dev/null || true)
    HEALTH=$(curl -fsS --max-time 1 http://127.0.0.1:19428/api/health 2>/dev/null || true)
    if printf '%s' "$CMD" | grep -q "${BRIDGE}/server.js" || \
       printf '%s' "$CMD" | grep -Eq '/From-Here-v[^/]+-macOS/\.from-here/bridge/server\.js|/from-here-v[^/]+/bridge/server\.js' || \
       printf '%s' "$HEALTH" | grep -q '"app":"from-here"'; then
      printf '○ 发现已有 From Here 正在运行，正在切换到 1.1.0…\n'
      kill "$PID" 2>/dev/null || true; sleep 0.6
    else
      printf '✗ 端口 19428 被其他程序占用：%s\n' "$CMD"
      read -n 1 -s -r -p '按任意键关闭'; exit 1
    fi
  done
fi

if [ ! -f "$BRIDGE/config.local.json" ]; then node "$BRIDGE/import-ai-config.js" --quiet >/dev/null 2>&1 || true; fi
nohup node "$BRIDGE/server.js" >>"$LOGFILE" 2>&1 &
PID=$!
echo "$PID" > "$PIDFILE"
sleep 0.8
if ! kill -0 "$PID" 2>/dev/null; then printf '✗ From Here 启动失败。\n日志：%s\n' "$LOGFILE"; tail -30 "$LOGFILE" 2>/dev/null || true; read -n 1 -s -r -p '按任意键关闭'; exit 1; fi
if command -v curl >/dev/null 2>&1 && curl -fsS --max-time 2 http://127.0.0.1:19428/api/health >/dev/null 2>&1; then
  printf '✓ From Here 已在后台运行。\n'
  printf '  现在可以关闭这个窗口，在 Chrome 点击 From Here 图标。\n'
else
  printf '○ Bridge 已启动（PID %s），正在初始化。\n' "$PID"
  printf '  如果扩展稍后仍无法连接，请运行 Support/Diagnose.command。\n'
fi
printf '\n日志：%s\n' "$LOGFILE"
sleep 1
