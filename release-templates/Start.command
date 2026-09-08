#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
source "$ROOT/.from-here/scripts/runtime-env.sh"
BRIDGE="$ROOT/.from-here/bridge"
DATA="$BRIDGE/.data"
PIDFILE="$DATA/bridge.pid"
LOGFILE="$DATA/bridge.log"
mkdir -p "$DATA"
printf '\n● From Here 1.1.1\n\n'
if ! command -v node >/dev/null 2>&1; then printf '✗ From Here Runtime 不完整：找不到 Node.js。请重新下载当前 Release。\n'; read -n 1 -s -r -p '按任意键关闭'; exit 1; fi
if ! command -v ncm-cli >/dev/null 2>&1; then printf '✗ From Here Runtime 不完整：找不到网易云 ncm-cli。请重新下载当前 Release。\n'; read -n 1 -s -r -p '按任意键关闭'; exit 1; fi

printf '○ 检查网易云搜索能力…\n'
NCM_PROBE=$(ncm-cli search song --keyword '周杰伦 晴天' --userInput 'From Here 启动检查' 2>&1 || true)
if printf '%s' "$NCM_PROBE" | grep -Eq 'API key 未设置|App ID|privateKey|PrivateKey|configure'; then
  printf '○ 检测到这台 Mac 的网易云 API 配置不可用，尝试恢复现有授权…\n'
  FROM_HERE_ROOT="$ROOT" bash "$ROOT/.from-here/scripts/configure-netease.sh" || true
  NCM_PROBE=$(ncm-cli search song --keyword '周杰伦 晴天' --userInput 'From Here 启动检查' 2>&1 || true)
fi
if printf '%s' "$NCM_PROBE" | grep -Eq '^\[错误\]|API key 未设置|unknown command|未配置|配置没有完成'; then
  printf '✗ 网易云搜索链尚未恢复，From Here 不会带着坏掉的召回继续启动。\n'
  printf '%s\n' "$NCM_PROBE" | tail -8
  printf '\n请运行 Support/Connect NetEase.command 完成网易云授权后，再双击 Start.command。\n'
  read -n 1 -s -r -p '按任意键关闭'; exit 1
fi
printf '✓ 网易云搜索可用\n'
if ncm-cli login --check >/dev/null 2>&1; then
  printf '✓ 网易云账号授权有效\n'
else
  printf '○ 网易云账号授权需要续期，尝试自动刷新…\n'
  ncm-cli login --check >/dev/null 2>&1 || true
  if ncm-cli login --check >/dev/null 2>&1; then printf '✓ 网易云账号授权已恢复\n'; else printf '○ 搜索可用；账号推荐能力暂未授权，From Here 仍可使用搜索召回。\n'; fi
fi
ncm-cli config set player orpheus >/dev/null 2>&1 || true

# Stop only a previously recorded From Here process.
if [ -f "$PIDFILE" ]; then
  OLD_PID=$(cat "$PIDFILE" 2>/dev/null || true)
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then kill "$OLD_PID" 2>/dev/null || true; sleep 0.4; fi
fi

if command -v lsof >/dev/null 2>&1; then
  for PID in $(lsof -tiTCP:19428 -sTCP:LISTEN 2>/dev/null); do
    CMD=$(ps -p "$PID" -o command= 2>/dev/null || true)
    HEALTH=$(curl -fsS --max-time 1 http://127.0.0.1:19428/api/health 2>/dev/null || true)
    if printf '%s' "$CMD" | grep -q "${BRIDGE}/server.js" || \
       printf '%s' "$CMD" | grep -Eq '/From-Here-v[^/]+-macOS/\.from-here/bridge/server\.js|/from-here-v[^/]+/bridge/server\.js' || \
       printf '%s' "$HEALTH" | grep -q '"app":"from-here"'; then
      printf '○ 发现已有 From Here 正在运行，正在切换到 1.1.1…\n'
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
