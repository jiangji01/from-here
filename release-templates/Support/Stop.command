#!/bin/bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/.from-here/scripts/runtime-env.sh"
PIDFILE="$ROOT/.from-here/bridge/.data/bridge.pid"
printf '\n● From Here · Stop\n\n'
if [ -f "$PIDFILE" ]; then PID=$(cat "$PIDFILE" 2>/dev/null || true); if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then kill "$PID" 2>/dev/null || true; printf '✓ 已停止 From Here（PID %s）。\n' "$PID"; else printf '○ From Here 当前没有运行。\n'; fi; rm -f "$PIDFILE"; else printf '○ From Here 当前没有运行。\n'; fi
sleep 1
