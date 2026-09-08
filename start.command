#!/bin/bash
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
PARENT="$(dirname "$ROOT")"
DEV_RUNTIME="$ROOT/.from-here-dev"

printf '\n● From Here v1.1.1 test branch\n'

# Source ZIPs do not carry the official bundled runtime. First try to reuse any
# extracted official release in common nearby locations; if none exists, create
# an isolated source-test ncm-cli under this checkout. Never silently use a stale
# global ncm-cli that lacks the command surface required by the Bridge.
RUNTIME_ENV=""
RELEASE_DIR=""
CANDIDATE_ROOTS=("$ROOT" "$PARENT" "$HOME/Downloads" "$HOME/Desktop" "$HOME")
for BASE in "${CANDIDATE_ROOTS[@]}"; do
  [ -d "$BASE" ] || continue
  FOUND=$(find "$BASE" -maxdepth 2 -type f -path '*/From-Here-v*-macOS*/.from-here/scripts/runtime-env.sh' -print 2>/dev/null | head -1 || true)
  if [ -n "$FOUND" ]; then
    RUNTIME_ENV="$FOUND"
    RELEASE_DIR="$(cd "$(dirname "$FOUND")/../../.." && pwd)"
    break
  fi
done

if [ -n "$RUNTIME_ENV" ]; then
  source "$RUNTIME_ENV"
  printf 'Runtime：复用正式版自带 Node + ncm-cli\n'
  [ -n "$RELEASE_DIR" ] && printf '  %s\n' "$RELEASE_DIR"
else
  printf 'Runtime：未找到正式版 runtime，使用隔离的测试 runtime\n'
fi

NODE_BIN="${FROM_HERE_NODE_BIN:-$(command -v node 2>/dev/null || true)}"
if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
  printf '✗ 找不到可用 Node.js。请保留已解压的正式版 From Here 后重试。\n'
  read -n 1 -s -r -p "按任意键关闭"; exit 1
fi

ncm_supports_required_commands(){
  local bin="$1" out_user out_search
  [ -n "$bin" ] && [ -x "$bin" ] || return 1
  out_user=$("$bin" user --help 2>&1 || true)
  out_search=$("$bin" search --help 2>&1 || true)
  if printf '%s\n%s' "$out_user" "$out_search" | grep -Eqi "unknown command|unknown option|not a command|command not found"; then return 1; fi
  printf '%s' "$out_user" | grep -Eqi 'favorite|history|user' || return 1
  printf '%s' "$out_search" | grep -Eqi 'song|search' || return 1
  return 0
}

NCM_BIN="${FROM_HERE_NCM_BIN:-}"
if ! ncm_supports_required_commands "$NCM_BIN"; then
  GLOBAL_NCM=$(command -v ncm-cli 2>/dev/null || true)
  if ncm_supports_required_commands "$GLOBAL_NCM"; then
    NCM_BIN="$GLOBAL_NCM"
    printf '✓ 系统 ncm-cli 命令能力符合要求\n'
  else
    LOCAL_NCM="$DEV_RUNTIME/ncm/node_modules/.bin/ncm-cli"
    if ! ncm_supports_required_commands "$LOCAL_NCM"; then
      NPM_BIN=$(command -v npm 2>/dev/null || true)
      if [ -z "$NPM_BIN" ]; then
        printf '✗ 当前没有兼容 ncm-cli，且找不到 npm 用于创建隔离测试 runtime。\n'
        printf '  最简单的办法：把正式版 From Here 解压到 Downloads 后重新运行。\n'
        read -n 1 -s -r -p "按任意键关闭"; exit 1
      fi
      printf '○ 正在为这个测试分支准备兼容的 ncm-cli（只写入当前测试目录）…\n'
      mkdir -p "$DEV_RUNTIME/ncm"
      if ! "$NPM_BIN" install --prefix "$DEV_RUNTIME/ncm" @music163/ncm-cli >/dev/null 2>&1; then
        printf '✗ 无法准备测试 runtime。请检查网络，或保留正式版 From Here 解压目录后重试。\n'
        read -n 1 -s -r -p "按任意键关闭"; exit 1
      fi
    fi
    if ! ncm_supports_required_commands "$LOCAL_NCM"; then
      printf '✗ 安装后的 ncm-cli 仍缺少 From Here 需要的 user/search 命令，停止测试以避免产生错误推荐。\n'
      read -n 1 -s -r -p "按任意键关闭"; exit 1
    fi
    NCM_BIN="$LOCAL_NCM"
    printf '✓ 测试 ncm-cli 已就绪\n'
  fi
fi

export FROM_HERE_NCM_BIN="$NCM_BIN"
printf 'ncm-cli：%s\n' "$FROM_HERE_NCM_BIN"

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
