#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
PARENT="$(dirname "$ROOT")"

# Source checkouts do not bundle the macOS runtime. For realistic branch testing,
# reuse the newest extracted official From Here release beside this checkout when
# available, instead of silently falling back to an old global ncm-cli.
RUNTIME_ENV=""
if [ -f "$ROOT/.from-here/scripts/runtime-env.sh" ]; then
  RUNTIME_ENV="$ROOT/.from-here/scripts/runtime-env.sh"
else
  RELEASE_DIR=$(ls -dt "$PARENT"/From-Here-v*-macOS 2>/dev/null | head -1 || true)
  if [ -n "$RELEASE_DIR" ] && [ -f "$RELEASE_DIR/.from-here/scripts/runtime-env.sh" ]; then
    RUNTIME_ENV="$RELEASE_DIR/.from-here/scripts/runtime-env.sh"
  fi
fi

if [ -n "$RUNTIME_ENV" ]; then
  source "$RUNTIME_ENV"
  printf '\n● From Here v1.1.1 test branch\n'
  printf 'Runtime：复用正式版自带 Node + ncm-cli\n'
else
  printf '\n● From Here v1.1.1 test branch\n'
  printf 'Runtime：未找到正式版自带 runtime，检查系统环境…\n'
fi

NODE_BIN="${FROM_HERE_NODE_BIN:-$(command -v node 2>/dev/null || true)}"
NCM_BIN="${FROM_HERE_NCM_BIN:-$(command -v ncm-cli 2>/dev/null || true)}"
if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
  printf '✗ 找不到可用 Node.js。请保留已解压的 From-Here-v1.1.0-macOS 正式包后重试。\n'
  read -n 1 -s -r -p "按任意键关闭"; exit 1
fi
if [ -z "$NCM_BIN" ] || [ ! -x "$NCM_BIN" ]; then
  printf '✗ 找不到可用 ncm-cli。请保留已解压的 From-Here-v1.1.0-macOS 正式包后重试。\n'
  read -n 1 -s -r -p "按任意键关闭"; exit 1
fi

# The current Bridge requires the modern ncm-cli command surface. A stale global
# binary can start successfully but then fail every real recall with
# "unknown command user/search", producing meaningless recommendation tests.
if ! "$NCM_BIN" search song --help >/dev/null 2>&1 || ! "$NCM_BIN" user --help >/dev/null 2>&1; then
  printf '✗ 当前 ncm-cli 版本不兼容：缺少 search / user 命令。\n'
  printf '  请把已解压的 From-Here-v1.1.0-macOS 正式包放在这个测试目录旁边，再重新运行。\n'
  printf '  当前 ncm-cli：%s\n' "$NCM_BIN"
  read -n 1 -s -r -p "按任意键关闭"; exit 1
fi

export FROM_HERE_NCM_BIN="$NCM_BIN"
cd "$ROOT/bridge" || exit 1
printf '保持这个窗口开启。Chrome 点击扩展图标会打开 Side Panel。\n\n'
if command -v lsof >/dev/null 2>&1; then
  for PID in $(lsof -tiTCP:19428 -sTCP:LISTEN 2>/dev/null); do
    CMD=$(ps -p "$PID" -o command= 2>/dev/null || true)
    HEALTH=$(curl -fsS --max-time 1 http://127.0.0.1:19428/api/health 2>/dev/null || true)
    if printf '%s' "$CMD" | grep -Eq 'from-here[^ ]*/bridge/server\.js|From-Here-v[^/]+-macOS/\.from-here/bridge/server\.js' || \
       printf '%s' "$HEALTH" | grep -q '"app":"from-here"'; then
      printf '发现旧版 From Here，正在切换到 v1.1.1 test branch…\n'
      kill "$PID" 2>/dev/null || true; sleep 0.6
    else
      printf '端口 19428 被其它程序占用：%s\n' "$CMD"; printf '请先释放该端口。\n'; read -n 1 -s -r -p "按任意键关闭"; exit 1
    fi
  done
fi
if [ ! -f config.local.json ]; then "$NODE_BIN" import-ai-config.js --quiet >/dev/null 2>&1 || true; fi
exec "$NODE_BIN" server.js
